import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import {
  loadLogs,
  logWorkout,
  undoWorkoutLog,
  WorkoutLogNotUndoableError,
  type WorkoutLogInput,
} from "@/lib/server/workout-logs";
import { computeProgress } from "@/lib/progress-math";

/**
 * Integration tests for the workout-logging service that BOTH the Progress API
 * and the coach graph's log_or_edit_workout tool call.
 *
 * They run against the real Postgres configured in DATABASE_URL (the same
 * database the app uses) and scope everything to a throwaway device id, so no
 * existing user data is touched. If Postgres is unreachable the suite is
 * skipped instead of failing the build.
 */

const DEVICE = `test-${randomUUID().slice(0, 12)}`;

async function dbAvailable(): Promise<boolean> {
  try {
    await query(`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

let available = false;

beforeAll(async () => {
  available = await dbAvailable();
});

afterAll(async () => {
  if (!available) return;
  await query(`DELETE FROM goal_checkins WHERE goal_id IN (SELECT id FROM goals WHERE device_id = $1)`, [DEVICE]);
  await query(`DELETE FROM goals WHERE device_id = $1`, [DEVICE]);
  await query(`DELETE FROM workout_logs WHERE device_id = $1`, [DEVICE]);
});

async function createGoal(input: {
  category: string;
  current: number;
  target: number;
  unit: string;
  name: string;
}): Promise<string> {
  const id = `goal_${randomUUID().slice(0, 8)}`;
  await query(
    `INSERT INTO goals (id, device_id, name, category, unit, current_value, target_value, weekly_days, progress, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '3', 0, 'active')`,
    [id, DEVICE, input.name, input.category, input.unit, input.current, input.target],
  );
  await query(
    `INSERT INTO goal_checkins (id, goal_id, value, source) VALUES ($1, $2, $3, 'manual')`,
    [`chk_${randomUUID().slice(0, 8)}`, id, input.current],
  );
  return id;
}

function workout(overrides: Partial<WorkoutLogInput> = {}): WorkoutLogInput {
  return {
    id: `w_${randomUUID().slice(0, 8)}`,
    goal: "strength",
    level: "intermediate",
    durationMinutes: 30,
    preset: "full",
    exercises: [
      { name: "Barbell Back Squat", sets: 4, movementPatternLabel: "Squat" },
      { name: "Bench Press", sets: 3, movementPatternLabel: "Horizontal Push" },
    ],
    ...overrides,
  };
}

describe("logWorkout / undoWorkoutLog", () => {
  it("updates ALL mapped goals when a workout is logged", async () => {
    if (!available) return;

    const consistencyId = await createGoal({
      name: "Train 3x/week",
      category: "Weekly Consistency",
      unit: "days",
      current: 0,
      target: 3,
    });
    const strengthId = await createGoal({
      name: "Bench 100kg",
      category: "Strength PR",
      unit: "sets",
      current: 0,
      target: 20,
    });
    const enduranceId = await createGoal({
      name: "Run 50km",
      category: "Distance / Endurance",
      unit: "min",
      current: 0,
      target: 300,
    });

    const result = await logWorkout(DEVICE, workout());

    const byGoal = new Map(result.goalUpdates.map((g) => [g.goalId, g]));

    // Weekly consistency counts the new workout day.
    expect(byGoal.get(consistencyId)?.status).toBe("updated");
    // Strength goals accrue the strength sets (4 + 3 = 7).
    expect(byGoal.get(strengthId)?.status).toBe("updated");
    expect(byGoal.get(strengthId)?.value).toBe(7);
    // A strength session must not touch an endurance goal.
    expect(byGoal.get(enduranceId)?.status).toBe("no_change");

    const rows = await query<{ progress: number; status: string }>(
      `SELECT progress, status FROM goals WHERE id = ANY($1)`,
      [[consistencyId, strengthId]],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.progress).toBeGreaterThan(0);
    }

    const expected = computeProgress(0, 20, 7);
    const strengthRow = await query<{ progress: number }>(
      `SELECT progress FROM goals WHERE id = $1`,
      [strengthId],
    );
    expect(strengthRow[0].progress).toBe(expected);

    // Cleanup for the next assertion block.
    await undoWorkoutLog(DEVICE, result.log!.id);
    await query(`DELETE FROM goals WHERE device_id = $1`, [DEVICE]);
  });

  it("undo reverts exactly the goal progress the workout created", async () => {
    if (!available) return;

    const strengthId = await createGoal({
      name: "Squat volume",
      category: "Strength PR",
      unit: "sets",
      current: 0,
      target: 100,
    });

    const logged = await logWorkout(DEVICE, workout());
    const afterLog = await query<{ progress: number }>(
      `SELECT progress FROM goals WHERE id = $1`,
      [strengthId],
    );
    expect(afterLog[0].progress).toBeGreaterThan(0);

    const undone = await undoWorkoutLog(DEVICE, logged.log!.id);

    const afterUndo = await query<{ progress: number }>(
      `SELECT progress FROM goals WHERE id = $1`,
      [strengthId],
    );
    expect(afterUndo[0].progress).toBe(0);
    expect(undone.goals.some((g) => g.id === strengthId)).toBe(true);

    // The log row and its workout-sourced check-ins are gone.
    const logs = await loadLogs(DEVICE);
    expect(logs.logs.find((l) => l.id === logged.log!.id)).toBeUndefined();
    const checkins = await query(
      `SELECT id FROM goal_checkins WHERE workout_log_id = $1`,
      [logged.log!.id],
    );
    expect(checkins).toHaveLength(0);

    await query(`DELETE FROM goals WHERE device_id = $1`, [DEVICE]);
  });

  it("refuses to undo a workout logged on an earlier day", async () => {
    if (!available) return;

    const logged = await logWorkout(DEVICE, workout());
    // Pretend it was logged yesterday.
    await query(`UPDATE workout_logs SET completed_on = (now() AT TIME ZONE 'UTC')::date - 1 WHERE id = $1`, [
      logged.log!.id,
    ]);

    await expect(undoWorkoutLog(DEVICE, logged.log!.id)).rejects.toBeInstanceOf(
      WorkoutLogNotUndoableError,
    );

    await query(`DELETE FROM workout_logs WHERE id = $1`, [logged.log!.id]);
  });
});
