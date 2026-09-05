import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { resolveDeviceId } from "@/lib/server/device";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);
  const body = await request.json();

  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = $1"];
  const values: unknown[] = [now];
  let paramIdx = 2;

  if (body.status !== undefined) {
    updates.push(`status = $${paramIdx}`);
    values.push(body.status);
    paramIdx++;
  }
  if (body.severity !== undefined) {
    updates.push(`severity = $${paramIdx}`);
    values.push(body.severity);
    paramIdx++;
  }
  if (body.notes !== undefined) {
    updates.push(`notes = $${paramIdx}`);
    values.push(body.notes);
    paramIdx++;
  }
  if (body.painScore !== undefined) {
    updates.push(`pain_score = $${paramIdx}`);
    values.push(body.painScore);
    paramIdx++;
  }
  if (body.painTriggerMovements !== undefined) {
    updates.push(`pain_trigger_movements = $${paramIdx}`);
    values.push(JSON.stringify(body.painTriggerMovements));
    paramIdx++;
  }
  if (body.status === "cleared") {
    updates.push(`cleared_at = $${paramIdx}`);
    values.push(now);
    paramIdx++;
  }

  values.push(id, deviceId);

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
    `UPDATE injuries SET ${updates.join(", ")} WHERE id = $${paramIdx} AND device_id = $${paramIdx + 1} RETURNING *`,
    values,
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const r = rows[0];
  return NextResponse.json({
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
    medicalGuidanceShown: false,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);

  await query("DELETE FROM injuries WHERE id = $1 AND device_id = $2", [
    id,
    deviceId,
  ]);

  return NextResponse.json({ ok: true });
}
