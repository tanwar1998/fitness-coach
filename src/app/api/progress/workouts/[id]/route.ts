import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { resolveDeviceId } from "@/lib/server/device";
import { computeProgress } from "@/lib/progress-math";
import { computeStats } from "@/lib/server/progress-stats";

interface LogRow {
  completed_on: string;
}

interface GoalRow {
  id: string;
  current_value: string | number;
  target_value: string | number;
}

function todayUtcKey(): string {
  return new Date().toISOString().split("T")[0];
}

async function recomputeGoal(goalId: string): Promise<{
  id: string;
  progress: number;
  status: string;
}> {
  const goals = await query<GoalRow>(
    `SELECT id, current_value, target_value FROM goals WHERE id = $1`,
    [goalId],
  );
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);

  const rows = await query<LogRow>(
    `SELECT to_char(completed_on, 'YYYY-MM-DD') AS completed_on
       FROM workout_logs WHERE id = $1 AND device_id = $2`,
    [id, deviceId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Workout log not found" }, { status: 404 });
  }

  const log = rows[0];
  if (log.completed_on !== todayUtcKey()) {
    return NextResponse.json(
      {
        error:
          "This workout happened on an earlier day and can no longer be undone. Streak and history are kept as logged.",
      },
      { status: 409 },
    );
  }

  const affected = await query<{ goal_id: string }>(
    `SELECT DISTINCT goal_id FROM goal_checkins
      WHERE workout_log_id = $1 AND source = 'workout'`,
    [id],
  );

  await query(
    `DELETE FROM goal_checkins WHERE workout_log_id = $1 AND source = 'workout'`,
    [id],
  );
  await query(
    `DELETE FROM workout_logs WHERE id = $1 AND device_id = $2`,
    [id, deviceId],
  );

  const goals: { id: string; progress: number; status: string }[] = [];
  for (const row of affected) {
    goals.push(await recomputeGoal(row.goal_id));
  }

  const remaining = await query<{ completed_on: string }>(
    `SELECT to_char(completed_on, 'YYYY-MM-DD') AS completed_on
       FROM workout_logs WHERE device_id = $1 ORDER BY completed_at ASC`,
    [deviceId],
  );

  return NextResponse.json({
    ok: true,
    stats: computeStats(remaining.map((r) => ({ completedOn: r.completed_on }))),
    goals,
  });
}