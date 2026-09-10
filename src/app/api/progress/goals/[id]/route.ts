import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { resolveDeviceId } from "@/lib/server/device";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);
  const body = await request.json();

  const rows = await query<{
    id: string;
    name: string;
    category: string;
    unit: string;
    current_value: number;
    target_value: number;
    weekly_days: string;
    progress: number;
    status: string;
  }>(
    "SELECT * FROM goals WHERE id = $1 AND device_id = $2",
    [id, deviceId],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const goal = rows[0];
  const now = new Date().toISOString();

  if (body.value !== undefined) {
    const value = Number(body.value);
    const total = Math.abs(goal.target_value - goal.current_value);
    const done = Math.abs(value - goal.current_value);
    const progress = total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100));
    const status = progress >= 100 ? "achieved" : "active";

    const checkInId = `chk_${randomUUID().slice(0, 8)}`;
    await query(
      "INSERT INTO goal_checkins (id, goal_id, value, created_at) VALUES ($1, $2, $3, $4)",
      [checkInId, id, value, now],
    );

    await query(
      "UPDATE goals SET progress = $1, status = $2, updated_at = $3 WHERE id = $4 AND device_id = $5",
      [progress, status, now, id, deviceId],
    );

    return NextResponse.json({
      id,
      userId: deviceId,
      name: goal.name,
      category: goal.category,
      unit: goal.unit,
      current: Number(goal.current_value),
      target: Number(goal.target_value),
      weekly: goal.weekly_days,
      progress,
      status,
      createdAt: now,
      updatedAt: now,
      history: [],
      checkIn: { id: checkInId, date: now, value },
    });
  }

  return NextResponse.json({ error: "value is required" }, { status: 400 });
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