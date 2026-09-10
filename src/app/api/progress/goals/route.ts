import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";

interface GoalRow {
  id: string;
  device_id: string;
  name: string;
  category: string;
  unit: string;
  current_value: number;
  target_value: number;
  weekly_days: string;
  progress: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CheckInRow {
  id: string;
  goal_id: string;
  value: number;
  created_at: string;
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    history: checkins.map((c) => ({
      id: c.id,
      date: c.created_at,
      value: Number(c.value),
    })),
  };
}

export async function GET(request: Request) {
  const { deviceId } = resolveDeviceId(request);

  const goals = await query<GoalRow>(
    "SELECT * FROM goals WHERE device_id = $1 ORDER BY created_at DESC",
    [deviceId],
  );

  const checkins = await query<CheckInRow>(
    `SELECT g.id AS goal_id, c.id, c.value, c.created_at
     FROM goals g
     JOIN goal_checkins c ON c.goal_id = g.id
     WHERE g.device_id = $1
     ORDER BY c.created_at ASC`,
    [deviceId],
  );

  const byGoal = new Map<string, CheckInRow[]>();
  for (const c of checkins) {
    const list = byGoal.get(c.goal_id) ?? [];
    list.push(c);
    byGoal.set(c.goal_id, list);
  }

  return NextResponse.json(goals.map((g) => toGoal(g, byGoal.get(g.id) ?? [])));
}

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const body = await request.json();

  if (!body.name || body.current === undefined || body.target === undefined) {
    return NextResponse.json({ error: "name, current and target are required" }, { status: 400 });
  }

  const id = `goal_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await query(
    `INSERT INTO goals (id, device_id, name, category, unit, current_value, target_value, weekly_days, progress, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      deviceId,
      body.name,
      body.category ?? "Custom",
      body.unit ?? "kg",
      body.current,
      body.target,
      body.weekly ?? "3",
      body.progress ?? 0,
      body.status ?? "active",
      now,
      now,
    ],
  );

  const checkInId = `chk_${randomUUID().slice(0, 8)}`;
  await query(
    "INSERT INTO goal_checkins (id, goal_id, value, created_at) VALUES ($1, $2, $3, $4)",
    [checkInId, id, body.current, now],
  );

  const goal = {
    id,
    userId: deviceId,
    name: body.name,
    category: body.category ?? "Custom",
    unit: body.unit ?? "kg",
    current: body.current,
    target: body.target,
    weekly: body.weekly ?? "3",
    progress: body.progress ?? 0,
    status: body.status ?? "active",
    createdAt: now,
    updatedAt: now,
    history: [{ id: checkInId, date: now, value: body.current }],
  };

  return NextResponse.json(goal, {
    status: 201,
    headers: deviceCookieHeaders({ deviceId, setCookie }),
  });
}