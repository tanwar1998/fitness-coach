import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";

export async function GET(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const rows = await query<{
    id: string;
    device_id: string;
    date: string;
    soreness_score: number;
    sleep_hours: number | null;
    sleep_quality: number | null;
    stress_level: number | null;
    energy_level: number | null;
    source: string;
  }>(
    "SELECT * FROM daily_checkins WHERE device_id = $1 ORDER BY date DESC LIMIT 30",
    [deviceId],
  );

  const checkIns = rows.map((r) => ({
    id: r.id,
    userId: r.device_id,
    date: r.date,
    sorenessScore: r.soreness_score,
    sleepHours: r.sleep_hours ?? undefined,
    sleepQuality: r.sleep_quality ?? undefined,
    stressLevel: r.stress_level ?? undefined,
    energyLevel: r.energy_level ?? undefined,
    source: r.source,
  }));

  return NextResponse.json(checkIns, {
    headers: deviceCookieHeaders({ deviceId, setCookie }),
  });
}

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const body = await request.json();

  const id = `chk_${randomUUID().slice(0, 8)}`;
  const today = new Date().toISOString().slice(0, 10);

  // Upsert: if there's already a check-in for today, update it
  const existing = await query<{ id: string }>(
    "SELECT id FROM daily_checkins WHERE device_id = $1 AND date = $2",
    [deviceId, today],
  );

  if (existing.length > 0) {
    await query(
      `UPDATE daily_checkins SET soreness_score = $1, sleep_hours = $2, sleep_quality = $3, stress_level = $4, energy_level = $5, source = $6 WHERE id = $7`,
      [
        body.sorenessScore,
        body.sleepHours ?? null,
        body.sleepQuality ?? null,
        body.stressLevel ?? null,
        body.energyLevel ?? null,
        body.source ?? "manual",
        existing[0].id,
      ],
    );

    return NextResponse.json({
      id: existing[0].id,
      userId: deviceId,
      date: today,
      sorenessScore: body.sorenessScore,
      sleepHours: body.sleepHours,
      sleepQuality: body.sleepQuality,
      stressLevel: body.stressLevel,
      energyLevel: body.energyLevel,
      source: body.source ?? "manual",
    });
  }

  await query(
    `INSERT INTO daily_checkins (id, device_id, date, soreness_score, sleep_hours, sleep_quality, stress_level, energy_level, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      deviceId,
      today,
      body.sorenessScore,
      body.sleepHours ?? null,
      body.sleepQuality ?? null,
      body.stressLevel ?? null,
      body.energyLevel ?? null,
      body.source ?? "manual",
    ],
  );

  return NextResponse.json(
    {
      id,
      userId: deviceId,
      date: today,
      sorenessScore: body.sorenessScore,
      sleepHours: body.sleepHours,
      sleepQuality: body.sleepQuality,
      stressLevel: body.stressLevel,
      energyLevel: body.energyLevel,
      source: body.source ?? "manual",
    },
    {
      status: 201,
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    },
  );
}
