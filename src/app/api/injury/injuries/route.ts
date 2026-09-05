import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";

export async function GET(request: Request) {
  const { deviceId } = resolveDeviceId(request);
  const rows = await query<{
    id: string;
    device_id: string;
    region: string;
    type: string;
    severity: string;
    status: string;
    pain_score: number | null;
    pain_trigger_movements: string | null;
    notes: string | null;
    reported_at: string;
    updated_at: string;
    cleared_at: string | null;
  }>(
    "SELECT * FROM injuries WHERE device_id = $1 ORDER BY updated_at DESC",
    [deviceId],
  );

  const injuries = rows.map((r) => ({
    id: r.id,
    userId: r.device_id,
    region: r.region,
    type: r.type,
    severity: r.severity,
    status: r.status,
    painScore: r.pain_score ?? undefined,
    painTriggerMovements: r.pain_trigger_movements
      ? JSON.parse(r.pain_trigger_movements)
      : undefined,
    notes: r.notes ?? undefined,
    reportedAt: r.reported_at,
    updatedAt: r.updated_at,
    clearedAt: r.cleared_at ?? undefined,
    medicalGuidanceShown: r.status === "severe",
  }));

  return NextResponse.json(injuries);
}

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const body = await request.json();

  const id = `inj_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await query(
    `INSERT INTO injuries (id, device_id, region, type, severity, status, pain_score, pain_trigger_movements, notes, reported_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      deviceId,
      body.region,
      body.type,
      body.severity,
      body.status ?? "active",
      body.painScore ?? null,
      body.painTriggerMovements
        ? JSON.stringify(body.painTriggerMovements)
        : null,
      body.notes ?? null,
      now,
      now,
    ],
  );

  const injury = {
    id,
    userId: deviceId,
    region: body.region,
    type: body.type,
    severity: body.severity,
    status: body.status ?? "active",
    painScore: body.painScore,
    painTriggerMovements: body.painTriggerMovements,
    notes: body.notes,
    reportedAt: now,
    updatedAt: now,
    clearedAt: undefined,
    medicalGuidanceShown: body.severity === "severe",
  };

  return NextResponse.json(injury, {
    status: 201,
    headers: deviceCookieHeaders({ deviceId, setCookie }),
  });
}
