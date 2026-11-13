import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { computeProgress } from "@/lib/progress-math";
import { computeStats, type ProgressStats } from "@/lib/server/progress-stats";

/**
 * Workout logging + undo, shared by the Progress API routes and the AI coach
 * graph's `log_or_edit_workout` tools. Both callers go through this module so
 * the business rules live in exactly one place:
 *
 *  - finishing a workout inserts a `workout_logs` row and updates EVERY active,
 *    workout-driven goal (`goal_checkins` + `goals.progress`/`status`)
 *  - undo deletes the log and only the `source='workout'` check-ins it created,
 *    then recomputes each affected goal
 */

export interface WorkoutLogRow {
  id: string;
  workout_id: string;
  goal: string;
  level: string;
  duration_minutes: number;
  preset: string;
  exercise_count: number;
  completed_on: string;
  completed_at: Date;
}

export interface GoalRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_value: string | number;
  target_value: string | number;
  weekly_days: string;
  progress: number;
  status: string;
}

interface CheckInRow {
  goal_id: string;
  value: string | number;
}

export interface WorkoutExercise {
  name?: string;
  movementPatternLabel?: string;
  showLoad?: boolean;
  sets?: number;
  key?: string;
}

export interface WorkoutLogInput {
  id: string;
  goal: string;
  level: string;
  durationMinutes: number;
  preset: string;
  exercises: WorkoutExercise[];
}

export interface GoalUpdate {
  goalId: string;
  goalName: string;
  unit: string;
  status: "updated" | "no_change";
  value?: number;
  reason: string;
}

export interface WorkoutLogView {
  id: string;
  workoutId: string;
  goal: string;
  level: string;
  durationMinutes: number;
  preset: string;
  exerciseCount: number;
  completedAt: string;
  undoable: boolean;
  updatedGoals: { goalId: string; goalName: string }[];
}

export interface LogWorkoutResult {
  log: WorkoutLogView | null;
  stats: ProgressStats;
  goalUpdates: GoalUpdate[];
}

export interface UndoWorkoutResult {
  ok: true;
  stats: ProgressStats;
  goals: { id: string; progress: number; status: string }[];
}

const STRENGTH_PATTERNS = new Set([
  "Horizontal Push",
  "Horizontal Pull",
  "Vertical Push",
  "Vertical Pull",
  "Squat",
  "Hinge",
  "Carry",
  "Lunge",
]);

export function todayUtcKey(now: Date = new Date()): string {
  return now.toISOString().split("T")[0];
}

function isStrengthExercise(exercise: WorkoutExercise): boolean {
  if (exercise.showLoad) return true;
  const pattern = exercise.movementPatternLabel;
  if (pattern && STRENGTH_PATTERNS.has(pattern)) return true;
  const name = exercise.name ?? "";
  return /press|push|pull|row|squat|deadlift|hinge|lunge|carry|curl/i.test(name);
}

export async function loadLogs(
  deviceId: string,
  now: Date = new Date(),
): Promise<{ logs: WorkoutLogView[]; stats: ProgressStats }> {
  const rows = await query<WorkoutLogRow>(
    `SELECT id, workout_id, goal, level, duration_minutes, preset, exercise_count,
            to_char(completed_on, 'YYYY-MM-DD') AS completed_on, completed_at
       FROM workout_logs
      WHERE device_id = $1
      ORDER BY completed_at ASC`,
    [deviceId],
  );

  const todayKey = todayUtcKey(now);
  const ids = rows.map((r) => r.id);
  let updatedByLog = new Map<string, { goalId: string; goalName: string }[]>();
  if (ids.length > 0) {
    const updated = await query<{
      workout_log_id: string;
      goal_id: string;
      goal_name: string;
    }>(
      `SELECT gc.workout_log_id, g.id AS goal_id, g.name AS goal_name
         FROM goal_checkins gc
         JOIN goals g ON g.id = gc.goal_id
        WHERE gc.workout_log_id = ANY($1)`,
      [ids],
    );
    updatedByLog = new Map();
    for (const u of updated) {
      const list = updatedByLog.get(u.workout_log_id) ?? [];
      list.push({ goalId: u.goal_id, goalName: u.goal_name });
      updatedByLog.set(u.workout_log_id, list);
    }
  }

  const logs = rows.map((r) => ({
    id: r.id,
    workoutId: r.workout_id,
    goal: r.goal,
    level: r.level,
    durationMinutes: Number(r.duration_minutes),
    preset: r.preset,
    exerciseCount: Number(r.exercise_count),
    completedAt: r.completed_at.toISOString(),
    undoable: r.completed_on === todayKey,
    updatedGoals: updatedByLog.get(r.id) ?? [],
  }));

  return {
    logs,
    stats: computeStats(rows.map((r) => ({ completedOn: r.completed_on })), now),
  };
}

/**
 * Log a completed workout and fan the result out to every active goal.
 * Mirrors the original POST /api/progress/workouts behavior exactly.
 */
export async function logWorkout(
  deviceId: string,
  workout: WorkoutLogInput,
  now: Date = new Date(),
): Promise<LogWorkoutResult> {
  const logId = `log_${randomUUID().slice(0, 8)}`;
  await query(
    `INSERT INTO workout_logs
       (id, device_id, workout_id, goal, level, duration_minutes, preset, exercise_count, completed_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (now() AT TIME ZONE 'UTC')::date)`,
    [
      logId,
      deviceId,
      workout.id,
      workout.goal,
      workout.level ?? "intermediate",
      Math.round(workout.durationMinutes),
      workout.preset ?? "full",
      workout.exercises.length,
    ],
  );

  const goalRows = await query<GoalRow>(
    `SELECT id, name, category, unit, current_value, target_value, weekly_days, progress, status
       FROM goals
      WHERE device_id = $1 AND status = 'active'
      ORDER BY created_at ASC`,
    [deviceId],
  );

  let latestByGoal = new Map<string, number>();
  if (goalRows.length > 0) {
    const goalIds = goalRows.map((g) => g.id);
    const checkins = await query<CheckInRow>(
      `SELECT goal_id, value FROM goal_checkins
        WHERE goal_id = ANY($1)
        ORDER BY created_at ASC`,
      [goalIds],
    );
    latestByGoal = new Map();
    for (const c of checkins) {
      latestByGoal.set(c.goal_id, Number(c.value));
    }
  }

  // Stats already include the log we just inserted, so weekly-days reflects it.
  const { stats } = await loadLogs(deviceId, now);
  const weeklyDaysThisWeek = stats.weeklyDaysThisWeek;

  const goalUpdates: GoalUpdate[] = [];

  const strengthCount = workout.exercises.filter(isStrengthExercise).length;
  const cardioWorkout = workout.goal === "endurance";

  for (const goal of goalRows) {
    const current = Number(goal.current_value);
    const target = Number(goal.target_value);
    const prev = latestByGoal.get(goal.id) ?? current;

    let updated: { value: number; reason: string } | null = null;

    if (goal.category === "Weekly Consistency") {
      updated = {
        value: Math.min(weeklyDaysThisWeek, target),
        reason: "Every completed workout counts toward your weekly days.",
      };
    } else if (goal.category === "Distance / Endurance") {
      if (cardioWorkout) {
        updated = {
          value: prev + Math.round(workout.durationMinutes),
          reason: `Cardio workout added ${Math.round(
            workout.durationMinutes,
          )} minutes toward your endurance target.`,
        };
      } else {
        goalUpdates.push({
          goalId: goal.id,
          goalName: goal.name,
          unit: goal.unit,
          status: "no_change",
          reason: "No cardio work in this workout — no change.",
        });
        continue;
      }
    } else if (goal.category === "Strength PR") {
      if (strengthCount > 0) {
        const sets = workout.exercises
          .filter(isStrengthExercise)
          .reduce((sum, e) => sum + (e.sets ?? 3), 0);
        updated = {
          value: prev + sets,
          reason: `Workout included ${strengthCount} strength ${
            strengthCount === 1 ? "lift" : "lifts"
          } (${sets} total sets).`,
        };
      } else {
        goalUpdates.push({
          goalId: goal.id,
          goalName: goal.name,
          unit: goal.unit,
          status: "no_change",
          reason: "No strength lifts in this workout — no change.",
        });
        continue;
      }
    } else {
      goalUpdates.push({
        goalId: goal.id,
        goalName: goal.name,
        unit: goal.unit,
        status: "no_change",
        reason: "This goal updates from manual check-ins only.",
      });
      continue;
    }

    const value = updated.value;
    const progress = computeProgress(current, target, value);
    const status = progress >= 100 ? "achieved" : "active";
    const checkInId = `chk_${randomUUID().slice(0, 8)}`;

    await query(
      `INSERT INTO goal_checkins (id, goal_id, value, created_at, source, workout_log_id)
       VALUES ($1, $2, $3, now(), 'workout', $4)`,
      [checkInId, goal.id, value, logId],
    );
    await query(
      `UPDATE goals SET progress = $1, status = $2, updated_at = now() WHERE id = $3 AND device_id = $4`,
      [progress, status, goal.id, deviceId],
    );

    goalUpdates.push({
      goalId: goal.id,
      goalName: goal.name,
      unit: goal.unit,
      status: "updated",
      value,
      reason: updated.reason,
    });
  }

  const freshLogs = await loadLogs(deviceId, now);

  return {
    log: freshLogs.logs.find((l) => l.id === logId) ?? null,
    stats: freshLogs.stats,
    goalUpdates,
  };
}

export class WorkoutLogNotFoundError extends Error {
  constructor(id: string) {
    super(`Workout log "${id}" was not found.`);
    this.name = "WorkoutLogNotFoundError";
  }
}

export class WorkoutLogNotUndoableError extends Error {
  constructor() {
    super(
      "This workout happened on an earlier day and can no longer be undone. Streak and history are kept as logged.",
    );
    this.name = "WorkoutLogNotUndoableError";
  }
}

async function recomputeGoal(goalId: string): Promise<{
  id: string;
  progress: number;
  status: string;
}> {
  const goals = await query<{
    id: string;
    current_value: string | number;
    target_value: string | number;
  }>(`SELECT id, current_value, target_value FROM goals WHERE id = $1`, [goalId]);
  const goal = goals[0];
  if (!goal) return { id: goalId, progress: 0, status: "active" };

  const latest = await query<{ value: string | number }>(
    `SELECT value FROM goal_checkins WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [goalId],
  );
  const latestValue = latest.length > 0 ? Number(latest[0].value) : null;

  let progress = 0;
  let status = "active";
  if (latestValue !== null) {
    progress = computeProgress(
      Number(goal.current_value),
      Number(goal.target_value),
      latestValue,
    );
    status = progress >= 100 ? "achieved" : "active";
  }

  await query(
    `UPDATE goals SET progress = $1, status = $2, updated_at = now() WHERE id = $3`,
    [progress, status, goalId],
  );
  return { id: goalId, progress, status };
}

/** Undo a workout log, reverting only the goal check-ins it created. */
export async function undoWorkoutLog(
  deviceId: string,
  logId: string,
  now: Date = new Date(),
): Promise<UndoWorkoutResult> {
  const rows = await query<{ completed_on: string }>(
    `SELECT to_char(completed_on, 'YYYY-MM-DD') AS completed_on
       FROM workout_logs WHERE id = $1 AND device_id = $2`,
    [logId, deviceId],
  );
  if (rows.length === 0) {
    throw new WorkoutLogNotFoundError(logId);
  }
  if (rows[0].completed_on !== todayUtcKey(now)) {
    throw new WorkoutLogNotUndoableError();
  }

  const affected = await query<{ goal_id: string }>(
    `SELECT DISTINCT goal_id FROM goal_checkins
      WHERE workout_log_id = $1 AND source = 'workout'`,
    [logId],
  );

  await query(
    `DELETE FROM goal_checkins WHERE workout_log_id = $1 AND source = 'workout'`,
    [logId],
  );
  await query(`DELETE FROM workout_logs WHERE id = $1 AND device_id = $2`, [
    logId,
    deviceId,
  ]);

  const goals: { id: string; progress: number; status: string }[] = [];
  for (const row of affected) {
    goals.push(await recomputeGoal(row.goal_id));
  }

  const remaining = await query<{ completed_on: string }>(
    `SELECT to_char(completed_on, 'YYYY-MM-DD') AS completed_on
       FROM workout_logs WHERE device_id = $1 ORDER BY completed_at ASC`,
    [deviceId],
  );

  return {
    ok: true,
    stats: computeStats(remaining.map((r) => ({ completedOn: r.completed_on })), now),
    goals,
  };
}
