import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";

export type WearableProvider = "apple_health" | "google_fit";

export const WEARABLE_PROVIDERS: WearableProvider[] = [
  "apple_health",
  "google_fit",
];

export interface WearableMetricInput {
  date: string;
  steps?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  sleepDurationMinutes?: number;
  sleepScore?: number;
}

export interface WearableMetric extends WearableMetricInput {
  id: string;
  provider: WearableProvider;
  createdAt: string;
  updatedAt: string;
}

interface WearableRow {
  id: string;
  device_id: string;
  date: Date | string;
  provider: WearableProvider;
  steps: number | null;
  resting_heart_rate: number | null;
  hrv_ms: number | null;
  sleep_duration_minutes: number | null;
  sleep_score: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(max, Math.max(min, value)));
}

/**
 * Validate and normalize a raw metric row. Returns null when the required
 * `date` is missing/invalid or no usable fields remain.
 */
export function normalizeMetric(
  raw: Record<string, unknown>,
): WearableMetricInput | null {
  const input: WearableMetricInput = { date: "" };

  const date = raw.date ?? raw.Date ?? raw.startDate;
  if (!isISODate(date)) return null;

  const steps = clampNumber(raw.steps, 0, 1_000_000);
  const restingHeartRate = clampNumber(raw.restingHeartRate ?? raw.resting_heart_rate, 30, 220);
  const hrvMs = clampNumber(raw.hrvMs ?? raw.hrv_ms, 0, 300);
  const sleepDurationMinutes = clampNumber(
    raw.sleepDurationMinutes ?? raw.sleep_duration_minutes,
    0,
    1440,
  );
  const sleepScore = clampNumber(raw.sleepScore ?? raw.sleep_score, 0, 100);

  if (
    steps === undefined &&
    restingHeartRate === undefined &&
    hrvMs === undefined &&
    sleepDurationMinutes === undefined &&
    sleepScore === undefined
  ) {
    return null;
  }

  input.date = date;
  if (steps !== undefined) input.steps = steps;
  if (restingHeartRate !== undefined) input.restingHeartRate = restingHeartRate;
  if (hrvMs !== undefined) input.hrvMs = hrvMs;
  if (sleepDurationMinutes !== undefined) {
    input.sleepDurationMinutes = sleepDurationMinutes;
  }
  if (sleepScore !== undefined) input.sleepScore = sleepScore;
  return input;
}

export function normalizeMetrics(
  provider: WearableProvider,
  raw: unknown,
): { metrics: WearableMetricInput[]; errors: string[] } {
  const rows = Array.isArray(raw) ? raw : (raw as { metrics?: unknown })?.metrics;
  if (!Array.isArray(rows)) {
    return { metrics: [], errors: ["No metrics array provided."] };
  }

  const metrics: WearableMetricInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const metric =
      row && typeof row === "object"
        ? normalizeMetric(row as Record<string, unknown>)
        : null;
    if (metric) {
      metrics.push(metric);
    } else {
      errors.push(`Row ${index + 1} skipped: missing a valid date or metrics.`);
    }
  });

  return { metrics, errors };
}

// ------------------------------------------------------------
// Row mapping
// ------------------------------------------------------------

function toDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function toISOStringSafe(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapRow(row: WearableRow): WearableMetric {
  return {
    id: row.id,
    date: toDateString(row.date),
    provider: row.provider,
    steps: row.steps ?? undefined,
    restingHeartRate: row.resting_heart_rate ?? undefined,
    hrvMs: row.hrv_ms ?? undefined,
    sleepDurationMinutes: row.sleep_duration_minutes ?? undefined,
    sleepScore: row.sleep_score ?? undefined,
    createdAt: toISOStringSafe(row.created_at),
    updatedAt: toISOStringSafe(row.updated_at),
  };
}

// ------------------------------------------------------------
// Sync / read
// ------------------------------------------------------------

interface CheckinRow {
  id: string;
  source: string;
  sleep_hours: number | null;
}

/**
 * Upsert wearable metrics for a device and optionally derive daily check-ins
 * (sleep) from them so the recovery/readiness features work with "hands-free"
 * data. Existing manual check-ins are never overwritten.
 */
export async function syncWearableMetrics(
  deviceId: string,
  provider: WearableProvider,
  inputs: WearableMetricInput[],
  deriveCheckIns = true,
): Promise<{ imported: number; checkInsDerived: number; errors: string[] }> {
  let imported = 0;
  let checkInsDerived = 0;
  const errors: string[] = [];

  for (const input of inputs) {
    const id = `wm_${randomUUID().slice(0, 8)}`;
    try {
      await query(
        `INSERT INTO wearable_metrics
           (id, device_id, date, provider, steps, resting_heart_rate, hrv_ms, sleep_duration_minutes, sleep_score, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (device_id, date, provider)
         DO UPDATE SET steps = EXCLUDED.steps,
                       resting_heart_rate = EXCLUDED.resting_heart_rate,
                       hrv_ms = EXCLUDED.hrv_ms,
                       sleep_duration_minutes = EXCLUDED.sleep_duration_minutes,
                       sleep_score = EXCLUDED.sleep_score,
                       updated_at = now()`,
        [
          id,
          deviceId,
          input.date,
          provider,
          input.steps ?? null,
          input.restingHeartRate ?? null,
          input.hrvMs ?? null,
          input.sleepDurationMinutes ?? null,
          input.sleepScore ?? null,
        ],
      );
      imported += 1;
    } catch (error) {
      errors.push(`Row for ${input.date} failed to import.`);
      console.error("Wearable metric import failed:", error);
      continue;
    }

    if (deriveCheckIns && input.sleepDurationMinutes != null) {
      try {
        const existing = await query<CheckinRow>(
          `SELECT id, source, sleep_hours FROM daily_checkins
           WHERE device_id = $1 AND date = $2`,
          [deviceId, input.date],
        );

        if (existing.length === 0) {
          await query(
            `INSERT INTO daily_checkins
              (id, device_id, date, soreness_score, sleep_hours, sleep_quality, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              `chk_${randomUUID().slice(0, 8)}`,
              deviceId,
              input.date,
              3, // neutral soreness baseline; real value comes from manual check-ins
              Math.round((input.sleepDurationMinutes / 60) * 10) / 10,
              input.sleepScore != null
                ? Math.min(5, Math.max(1, Math.round(input.sleepScore / 20)))
                : null,
              "wearable_sync",
            ],
          );
          checkInsDerived += 1;
        } else if (
          existing[0].source === "wearable_sync" &&
          existing[0].sleep_hours == null
        ) {
          await query(
            `UPDATE daily_checkins SET sleep_hours = $1 WHERE id = $2`,
            [
              Math.round((input.sleepDurationMinutes / 60) * 10) / 10,
              existing[0].id,
            ],
          );
          checkInsDerived += 1;
        }
      } catch (error) {
        console.error("Wearable check-in derivation failed:", error);
      }
    }
  }

  return { imported, checkInsDerived, errors };
}

export async function fetchWearableMetrics(
  deviceId: string,
  days = 90,
): Promise<WearableMetric[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceISO = `${since.getUTCFullYear()}-${String(since.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(since.getUTCDate()).padStart(2, "0")}`;

  const rows = await query<WearableRow>(
    `SELECT * FROM wearable_metrics
     WHERE device_id = $1 AND date >= $2
     ORDER BY date DESC`,
    [deviceId, sinceISO],
  );
  return rows.map(mapRow);
}