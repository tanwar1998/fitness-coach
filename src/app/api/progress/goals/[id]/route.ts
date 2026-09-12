import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { resolveDeviceId } from "@/lib/server/device";
import { computeProgress } from "@/lib/progress-math";

interface GoalRow {
  id: string;
  device_id: string;
  name: string;
  category: string;
  unit: string;
  current_value: string | number;
  target_value: string | number;
  weekly_days: string;
  progress: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface CheckInRow {
  id: string;
  value: string | number;
  created_at: Date;
}

function toGoal(r: GoalRow, checkins: CheckInRow[]) {
  return {
    id: r.id,
    userId: r.device_id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    current: Number(r.current_value),
    target: Number(r.target_value),
    weekly: r.weekly_days,
    progress: r.progress,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    history: checkins.map((c) => ({
      id: c.id,
      date: c.created_at.toISOString(),
      value: Number(c.value),
    })),
  };
}

async function loadGoal(
  goalId: string,
  deviceId: string,
): Promise<ReturnType<typeof toGoal> | null> {
  const rows = await query<GoalRow>(
    "SELECT * FROM goals WHERE id = $1 AND device_id = $2",
    [goalId, deviceId],
  );
  const goal = rows[0];
  if (!goal) return null;

  const checkins = await query<CheckInRow>(
    `SELECT id, value, created_at FROM goal_checkins
      WHERE goal_id = $1 ORDER BY created_at ASC`,
    [goalId],
  );
  return toGoal(goal, checkins);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);
  const body = await request.json();

  const rows = await query<GoalRow>(
    "SELECT * FROM goals WHERE id = $1 AND device_id = $2",
    [id, deviceId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const goal = rows[0];
  const now = new Date().toISOString();

  if (body.status !== undefined) {
    const statuses = ["active", "achieved", "archived"];
    if (!statuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await query(
      "UPDATE goals SET status = $1, updated_at = $2 WHERE id = $3 AND device_id = $4",
      [body.status, now, id, deviceId],
    );
    const updated = await loadGoal(id, deviceId);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }

  if (body.value !== undefined) {
    const value = Number(body.value);
    const progress = computeProgress(
      Number(goal.current_value),
      Number(goal.target_value),
      value,
    );
    const status = progress >= 100 ? "achieved" : "active";

    const checkInId = `chk_${randomUUID().slice(0, 8)}`;
    await query(
      `INSERT INTO goal_checkins (id, goal_id, value, created_at, source)
       VALUES ($1, $2, $3, $4, 'manual')`,
      [checkInId, id, value, now],
    );

    await query(
      "UPDATE goals SET progress = $1, status = $2, updated_at = $3 WHERE id = $4 AND device_id = $5",
      [progress, status, now, id, deviceId],
    );

    const checkin = { id: checkInId, date: now, value };
    const updated = await loadGoal(id, deviceId);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ...updated, checkIn: checkin });
  }

  return NextResponse.json({ error: "value or status is required" }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);

  await query("DELETE FROM goals WHERE id = $1 AND device_id = $2", [
    id,
    deviceId,
  ]);

  return NextResponse.json({ ok: true });
}