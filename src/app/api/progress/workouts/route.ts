import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import {
  resolveDeviceId,
  deviceCookieHeaders,
} from "@/lib/server/device";
import { computeProgress } from "@/lib/progress-math";
import { computeStats, type ProgressStats } from "@/lib/server/progress-stats";

interface WorkoutLogRow {
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

interface GoalRow {
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

interface WorkoutExercise {
  name?: string;
  movementPatternLabel?: string;
  showLoad?: boolean;
  sets?: number;
  key: string;
}

interface WorkoutLogInput {
  id: string;
  goal: string;
  level: string;
  durationMinutes: number;
  preset: string;
  exercises: WorkoutExercise[];
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

function todayUtcKey(): string {
  return new Date().toISOString().split("T")[0];
}

function isStrengthExercise(exercise: WorkoutExercise): boolean {
  if (exercise.showLoad) return true;
  const pattern = exercise.movementPatternLabel;
  if (pattern && STRENGTH_PATTERNS.has(pattern)) return true;
  const name = exercise.name ?? "";
  return /press|push|pull|row|squat|deadlift|hinge|lunge|carry|curl/i.test(name);
}

async function loadLogs(deviceId: string) {
  const rows = await query<WorkoutLogRow>(
    `SELECT id, workout_id, goal, level, duration_minutes, preset, exercise_count,
            to_char(completed_on, 'YYYY-MM-DD') AS completed_on, completed_at
       FROM workout_logs
      WHERE device_id = $1
      ORDER BY completed_at ASC`,
    [deviceId],
  );

  const todayKey = todayUtcKey();
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
    stats: computeStats(
      rows.map((r) => ({ completedOn: r.completed_on })),
    ),
  };
}

export async function GET(request: Request) {
  const { deviceId } = resolveDeviceId(request);
  const { logs, stats } = await loadLogs(deviceId);
  return NextResponse.json({ logs, stats });
}

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  let body: { workout?: WorkoutLogInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workout = body.workout;
  if (
    !workout ||
    typeof workout !== "object" ||
    !workout.id ||
    !workout.goal ||
    typeof workout.durationMinutes !== "number" ||
    !Array.isArray(workout.exercises)
  ) {
    return NextResponse.json(
      { error: "workout (id, goal, durationMinutes, exercises) is required" },
      { status: 400 },
    );
  }

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
  const { stats } = await loadLogs(deviceId);
  const weeklyDaysThisWeek = stats.weeklyDaysThisWeek;

  const goalUpdates: {
    goalId: string;
    goalName: string;
    unit: string;
    status: "updated" | "no_change";
    value?: number;
    reason: string;
  }[] = [];

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
    const now = new Date().toISOString();

    await query(
      `INSERT INTO goal_checkins (id, goal_id, value, created_at, source, workout_log_id)
       VALUES ($1, $2, $3, $4, 'workout', $5)`,
      [checkInId, goal.id, value, now, logId],
    );
    await query(
      `UPDATE goals SET progress = $1, status = $2, updated_at = $3 WHERE id = $4 AND device_id = $5`,
      [progress, status, now, goal.id, deviceId],
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

  const freshLogs = await loadLogs(deviceId);

  return NextResponse.json(
    {
      log: freshLogs.logs.find((l) => l.id === logId) ?? null,
      stats: freshLogs.stats as ProgressStats,
      goalUpdates,
    },
    {
      status: 201,
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    },
  );
}