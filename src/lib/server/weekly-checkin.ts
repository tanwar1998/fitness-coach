import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { AiProviderError, resolveProviderFallback } from "@/lib/server/ai";
import type { GenerateReplyInput } from "@/lib/server/ai/types";
import { extractJson } from "@/lib/server/ai/parse-json";
import { computeReadinessScore } from "@/lib/injury-recovery";
import type { DailyCheckIn } from "../../../data";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface WeeklyCheckinStats {
  workouts: number;
  daysTrained: number;
  avgSleepHours: number | null;
  avgSoreness: number | null;
  avgEnergy: number | null;
  readiness: number | null;
  activeInjuries: number;
}

export interface WeeklyCheckin {
  id: string;
  deviceId: string;
  weekStart: string;
  summary: string;
  adjustments: string[];
  stats: WeeklyCheckinStats;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyCheckinStatus {
  today: string;
  weekStart: string;
  latest: WeeklyCheckin | null;
  currentWeek: { weekStart: string; hasCheckin: boolean };
  hasActivity: boolean;
}

interface WeeklyCheckinRow {
  id: string;
  device_id: string;
  week_start: Date | string;
  summary: string;
  adjustments: unknown;
  stats: unknown;
  provider: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

// ------------------------------------------------------------
// Date helpers. All day arithmetic happens on plain YYYY-MM-DD
// strings so the server agrees with the client's local calendar.
// ------------------------------------------------------------

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayLocal(): string {
  return toISODate(new Date());
}

export function isValidISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatISODate(date: Date): string {
  return toISODate(date);
}

/** Return the Monday (week start) of the week containing the given date. */
export function weekStartFor(value: string): string {
  const date = parseISODate(value);
  const day = date.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatISODate(date);
}

// ------------------------------------------------------------
// Row mapping
// ------------------------------------------------------------

function toDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return formatISODate(value);
}

function mapRow(row: WeeklyCheckinRow): WeeklyCheckin {
  const rawStats = (row.stats ?? {}) as Record<string, unknown>;
  const additions = Array.isArray(row.adjustments)
    ? row.adjustments.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  return {
    id: row.id,
    deviceId: row.device_id,
    weekStart: toDateString(row.week_start),
    summary: row.summary,
    adjustments: additions,
    stats: {
      workouts: typeof rawStats.workouts === "number" ? rawStats.workouts : 0,
      daysTrained: typeof rawStats.daysTrained === "number" ? rawStats.daysTrained : 0,
      avgSleepHours:
        typeof rawStats.avgSleepHours === "number" ? rawStats.avgSleepHours : null,
      avgSoreness:
        typeof rawStats.avgSoreness === "number" ? rawStats.avgSoreness : null,
      avgEnergy: typeof rawStats.avgEnergy === "number" ? rawStats.avgEnergy : null,
      readiness: typeof rawStats.readiness === "number" ? rawStats.readiness : null,
      activeInjuries:
        typeof rawStats.activeInjuries === "number" ? rawStats.activeInjuries : 0,
    },
    provider: row.provider,
    createdAt: toISOStringSafe(row.created_at),
    updatedAt: toISOStringSafe(row.updated_at),
  };
}

function toISOStringSafe(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

// ------------------------------------------------------------
// Status / context loading
// ------------------------------------------------------------

async function countActivity(deviceId: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT (
       (SELECT count(*) FROM workout_logs WHERE device_id = $1) +
       (SELECT count(*) FROM daily_checkins WHERE device_id = $1) +
       (SELECT count(*) FROM injuries WHERE device_id = $1) +
       (SELECT count(*) FROM goals WHERE device_id = $1)
     )::integer AS count`,
    [deviceId],
  );
  return Number((rows[0]?.count ?? "0") as string) > 0;
}

export async function loadWeeklyCheckinStatus(
  deviceId: string,
  today = todayLocal(),
): Promise<WeeklyCheckinStatus> {
  const weekStart = weekStartFor(today);

  const [recent, current, hasActivity] = await Promise.all([
    query<WeeklyCheckinRow>(
      `SELECT * FROM weekly_checkins
       WHERE device_id = $1
       ORDER BY week_start DESC
       LIMIT 6`,
      [deviceId],
    ),
    query<WeeklyCheckinRow>(
      `SELECT * FROM weekly_checkins
       WHERE device_id = $1 AND week_start = $2`,
      [deviceId, weekStart],
    ),
    countActivity(deviceId),
  ]);

  return {
    today,
    weekStart,
    latest: recent.length > 0 ? mapRow(recent[0]) : null,
    currentWeek: {
      weekStart,
      hasCheckin: current.length > 0,
    },
    hasActivity,
  };
}

// ------------------------------------------------------------
// Context + prompt
// ------------------------------------------------------------

interface WeeklyContext {
  weekStart: string;
  today: string;
  workouts: {
    date: string;
    goal: string;
    level: string;
    durationMinutes: number;
    exerciseCount: number;
  }[];
  checkIns: DailyCheckIn[];
  goals: { name: string; category: string; progress: number; targetValue: number }[];
  goalCheckIns: { name: string; value: number; date: string }[];
  injuries: { region: string; status: string; severity: string }[];
  readiness: number | null;
}

interface WorkoutLogRow {
  completed_on: Date | string;
  goal: string;
  level: string;
  duration_minutes: number;
  exercise_count: number;
}

interface GoalRow {
  name: string;
  category: string;
  current_value: number;
  target_value: number;
  progress: number;
}

interface GoalCheckInRow {
  name: string;
  value: number;
  date: string;
}

interface InjuryRow {
  region: string;
  status: string;
  severity: string;
}

function average(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return null;
  return Math.round((present.reduce((sum, v) => sum + v, 0) / present.length) * 10) / 10;
}

async function buildContext(
  deviceId: string,
  weekStart: string,
  today: string,
): Promise<WeeklyContext> {
  const [workoutRows, checkinRows, goalRows, goalCheckinRows, injuryRows] =
    await Promise.all([
      query<WorkoutLogRow>(
        `SELECT completed_on, goal, level, duration_minutes, exercise_count
         FROM workout_logs
         WHERE device_id = $1 AND completed_on >= $2 AND completed_on <= $3
         ORDER BY completed_on ASC`,
        [deviceId, weekStart, today],
      ),
      query<{
        id: string;
        date: Date | string;
        soreness_score: number;
        sleep_hours: number | null;
        sleep_quality: number | null;
        stress_level: number | null;
        energy_level: number | null;
        source: string;
      }>(
        `SELECT * FROM daily_checkins
         WHERE device_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC`,
        [deviceId, weekStart, today],
      ),
      query<GoalRow>(
        `SELECT name, category, current_value, target_value, progress
         FROM goals
         WHERE device_id = $1 AND status IN ('active', 'achieved')
         ORDER BY created_at ASC`,
        [deviceId],
      ),
      query<GoalCheckInRow>(
        `SELECT g.name AS name, gc.value AS value, gc.created_at::date AS date
         FROM goal_checkins gc
         JOIN goals g ON g.id = gc.goal_id
         WHERE g.device_id = $1 AND gc.created_at::date >= $2 AND gc.created_at::date <= $3
         ORDER BY gc.created_at ASC`,
        [deviceId, weekStart, today],
      ),
      query<InjuryRow>(
        `SELECT region, status, severity
         FROM injuries
         WHERE device_id = $1 AND status IN ('active', 'healing')
         ORDER BY updated_at DESC`,
        [deviceId],
      ),
    ]);

  const checkInsDesc: DailyCheckIn[] = checkinRows.map((row) => ({
    id: row.id,
    userId: deviceId,
    date: toDateString(row.date),
    sorenessScore: row.soreness_score,
    sleepHours: row.sleep_hours ?? undefined,
    sleepQuality: row.sleep_quality ?? undefined,
    stressLevel: row.stress_level ?? undefined,
    energyLevel: row.energy_level ?? undefined,
    source: row.source === "wearable_sync" ? "wearable_sync" : "manual",
  }));

  const checkInsAsc = [...checkInsDesc].reverse();
  const readiness =
    checkInsDesc.length > 0 ? computeReadinessScore(checkInsDesc).score : null;

  return {
    weekStart,
    today,
    workouts: workoutRows.map((row) => ({
      date: toDateString(row.completed_on),
      goal: row.goal,
      level: row.level,
      durationMinutes: row.duration_minutes,
      exerciseCount: row.exercise_count,
    })),
    checkIns: checkInsAsc,
    goals: goalRows.map((row) => ({
      name: row.name,
      category: row.category,
      progress: row.progress,
      targetValue: row.target_value,
    })),
    goalCheckIns: goalCheckinRows.map((row) => ({
      name: row.name,
      value: row.value,
      date: toDateString(row.date),
    })),
    injuries: injuryRows.map((row) => ({
      region: row.region,
      status: row.status,
      severity: row.severity,
    })),
    readiness,
  };
}

const SYSTEM_PROMPT = `You are FitPulse, a thoughtful and encouraging fitness recovery coach.

Each week you produce one short "weekly check-in" for the user: an honest summary of how their training week went plus 1-4 concrete things to adjust next week.

Your only source of truth is the context you are given. Never invent workouts, check-ins, goals, injuries, or numbers that are not present in the context.

Respond ONLY with a JSON object in exactly this shape, with no markdown, no code fences, and no surrounding text:
{
  "summary": "2-4 sentences summarizing how the week went.",
  "adjustments": ["one short, actionable recommendation", "another short, actionable recommendation"]
}

Guidelines:
- Be specific and cite numbers from the context (e.g. "You trained 3 days this week").
- If there is no training or recovery data, say so kindly and suggest what to log or start with next week.
- If sleep was short, soreness high, or readiness low, recommend a recovery or lighter session rather than pushing harder.
- Never recommend loading an injured area; steer around the listed injuries.
- Keep every adjustment short, specific, and achievable within one week.`;

function buildPrompt(context: WeeklyContext): GenerateReplyInput["messages"] {
  const checkInLines =
    context.checkIns.length > 0
      ? context.checkIns.map((c) => {
          const parts = [
            c.date,
            `soreness ${c.sorenessScore}/5`,
            c.sleepHours != null ? `sleep ${c.sleepHours}h` : "sleep n/a",
            c.stressLevel != null ? `stress ${c.stressLevel}/5` : null,
            c.energyLevel != null ? `energy ${c.energyLevel}/5` : null,
          ].filter(Boolean);
          return `- ${parts.join(", ")}`;
        })
      : ["- none"];

  const lines: string[] = [
    `WEEKLY CHECK-IN CONTEXT (week of ${context.weekStart} through ${context.today}, user id ${"fitpulse-device"}):`,
    "",
    `Workouts logged in the week (${context.workouts.length}):`,
    context.workouts.length > 0
      ? context.workouts
          .map((w) =>
            `- ${w.date}: ${w.goal} / ${w.level} / ${w.durationMinutes} min / ${w.exerciseCount} exercises`,
          )
          .join("\n")
      : "- none",
    "",
    `Daily recovery check-ins in the week (${context.checkIns.length}):`,
    checkInLines.join("\n"),
    `Readiness score for the week: ${context.readiness ?? "n/a"} / 100`,
    "",
    `Goals (active or achieved):`,
    context.goals.length > 0
      ? context.goals.map((g) => `- ${g.name} (${g.category}): ${g.progress}% toward target ${g.targetValue}`).join("\n")
      : "- none",
    "",
    `Goal measurements this week:`,
    context.goalCheckIns.length > 0
      ? context.goalCheckIns.map((g) => `- ${g.date}: ${g.name} = ${g.value}`).join("\n")
      : "- none",
    "",
    `Active injuries:`,
    context.injuries.length > 0
      ? context.injuries.map((i) => `- ${i.region} (${i.status}, ${i.severity})`).join("\n")
      : "- none",
    "",
    `Now write the weekly check-in. Output ONLY the JSON object described above.`,
  ];

  return [
    { role: "user", content: SYSTEM_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}

// ------------------------------------------------------------
// Generation
// ------------------------------------------------------------

interface ParsedCheckin {
  summary?: unknown;
  adjustments?: unknown;
}

function parseCheckin(raw: string): WeeklyCheckin | null {
  const parsed = extractJson<ParsedCheckin>(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const summary =
    typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (!summary) return null;

  const adjustments = Array.isArray(parsed.adjustments)
    ? parsed.adjustments
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return { summary, adjustments } as WeeklyCheckin;
}

async function storeCheckin(
  row: WeeklyCheckin & { weekStart: string; deviceId: string },
): Promise<void> {
  await query(
    `INSERT INTO weekly_checkins (id, device_id, week_start, summary, adjustments, stats, provider, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, now())
     ON CONFLICT (device_id, week_start)
     DO UPDATE SET summary = EXCLUDED.summary,
                   adjustments = EXCLUDED.adjustments,
                   stats = EXCLUDED.stats,
                   provider = EXCLUDED.provider,
                   updated_at = now()`,
    [
      row.id,
      row.deviceId,
      row.weekStart,
      row.summary,
      JSON.stringify(row.adjustments),
      JSON.stringify(row.stats),
      row.provider,
    ],
  );
}

export async function getCheckinForWeek(
  deviceId: string,
  weekStart: string,
): Promise<WeeklyCheckin | null> {
  const rows = await query<WeeklyCheckinRow>(
    `SELECT * FROM weekly_checkins WHERE device_id = $1 AND week_start = $2`,
    [deviceId, weekStart],
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/**
 * Generate (and persist) the weekly check-in for the current week.
 * Skips when a check-in already exists for the week unless `opts.force` is set.
 */
export async function generateCheckin(
  deviceId: string,
  today = todayLocal(),
  opts: { force?: boolean; provider?: string } = {},
): Promise<
  | { checkin: WeeklyCheckin; created: boolean }
  | { providerError: AiProviderError }
  | { unparseable: true }
> {
  const weekStart = weekStartFor(today);

  if (!opts.force) {
    const existing = await getCheckinForWeek(deviceId, weekStart);
    if (existing) {
      return { checkin: existing, created: false };
    }
  }

  const context = await buildContext(deviceId, weekStart, today);

  const providers = resolveProviderFallback(opts.provider);
  if (providers.length === 0) {
    return {
      providerError: new AiProviderError(
        "No AI provider is configured. Add an API key to your environment.",
      ),
    };
  }

  const newRow: WeeklyCheckin & { weekStart: string; deviceId: string } = {
    id: `wc_${randomUUID().slice(0, 8)}`,
    deviceId,
    weekStart,
    summary: "",
    adjustments: [],
    stats: {
      workouts: context.workouts.length,
      daysTrained: new Set(context.workouts.map((w) => w.date)).size,
      avgSleepHours: average(context.checkIns.map((c) => c.sleepHours)),
      avgSoreness: average(context.checkIns.map((c) => c.sorenessScore)),
      avgEnergy: average(context.checkIns.map((c) => c.energyLevel)),
      readiness: context.readiness,
      activeInjuries: context.injuries.length,
    },
    provider: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let lastProviderError: AiProviderError | null = null;

  for (const provider of providers) {
    try {
      let response = await provider.generateReply({
        messages: buildPrompt(context),
      });
      let parsed = parseCheckin(response);

      if (parsed === null) {
        response = await provider.generateReply({
          messages: [
            ...buildPrompt(context),
            {
              role: "user",
              content:
                "Your previous reply was ignored because it wasn't valid JSON. Reply with ONLY a JSON object in exactly this shape, no prose, no code fences:\n{\"summary\":\"...\",\"adjustments\":[\"...\"]}",
            },
          ],
        });
        parsed = parseCheckin(response);
      }

      if (parsed !== null) {
        newRow.summary = parsed.summary;
        newRow.adjustments = parsed.adjustments;
        newRow.provider = provider.id;
        newRow.updatedAt = new Date().toISOString();
        await storeCheckin(newRow);
        const storedRow: WeeklyCheckinRow = {
          id: newRow.id,
          device_id: newRow.deviceId,
          week_start: newRow.weekStart,
          summary: newRow.summary,
          adjustments: newRow.adjustments,
          stats: newRow.stats,
          provider: newRow.provider,
          created_at: newRow.createdAt,
          updated_at: newRow.updatedAt,
        };
        return { checkin: mapRow(storedRow), created: true };
      }
    } catch (error) {
      if (error instanceof AiProviderError) {
        lastProviderError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastProviderError) {
    return { providerError: lastProviderError };
  }

  return { unparseable: true };
}