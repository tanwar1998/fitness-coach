import { query } from "@/lib/server/db";
import {
  loadLogs,
  logWorkout,
  undoWorkoutLog,
  type GoalUpdate,
  type LogWorkoutResult,
  type UndoWorkoutResult,
  type WorkoutLogView,
} from "@/lib/server/workout-logs";
import {
  fetchDailyLog,
  fetchNutritionTargets,
  type DailyLog,
  type NutritionTargets,
} from "@/lib/server/nutrition";
import { computeStats, type ProgressStats } from "@/lib/server/progress-stats";
import { todayISOLocal } from "@/lib/server/nutrition";
import type { GuardrailVerdict } from "./intents";

/**
 * Tools the coaching graph exposes to its intent nodes.
 *
 * Every function here is a thin wrapper over an EXISTING service so business
 * logic is never duplicated: the workout tools call the same
 * `src/lib/server/workout-logs.ts` module the Progress API routes use, and the
 * context loader reads the same tables/helpers the pages already read.
 *
 * All functions take the device id as `userId` (this app has no accounts).
 */

// ---------------------------------------------------------------------------
// load_context
// ---------------------------------------------------------------------------

export interface CoachUserContext {
  userId: string;
  /** Active + achieved goals with their current progress. */
  goals: {
    id: string;
    name: string;
    category: string;
    unit: string;
    current: number;
    target: number;
    progress: number;
    status: string;
  }[];
  stats: ProgressStats;
  /** Today's logged meal summary + targets, when available. */
  nutrition: {
    date: string;
    summary: DailyLog["summary"];
    targets: NutritionTargets;
  } | null;
  /** Active/healing injuries the coach must respect. */
  injuries: { region: string; status: string; severity: string }[];
  /** Most recent completed workout (for "did I train today?" answers). */
  lastWorkout: WorkoutLogView | null;
  /** True when the user already logged a workout today. */
  loggedToday: boolean;
  summaryText: string;
}

interface GoalContextRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_value: string | number;
  target_value: string | number;
  progress: number;
  status: string;
}

interface InjuryContextRow {
  region: string;
  status: string;
  severity: string;
}

export async function loadUserContext(
  userId: string,
  now: Date = new Date(),
): Promise<CoachUserContext> {
  // Each read is best-effort: a single failing table must not break the chat.
  const [goalRows, logs, nutrition, injuries] = await Promise.all([
    query<GoalContextRow>(
      `SELECT id, name, category, unit, current_value, target_value, progress, status
         FROM goals
        WHERE device_id = $1 AND status <> 'archived'
        ORDER BY created_at ASC`,
      [userId],
    ).catch(() => [] as GoalContextRow[]),
    loadLogs(userId, now).catch(() => ({ logs: [], stats: computeStats([], now) })),
    loadNutritionContext(userId),
    query<InjuryContextRow>(
      `SELECT region, status, severity FROM injuries
        WHERE device_id = $1 AND status <> 'cleared'
        ORDER BY updated_at DESC`,
      [userId],
    ).catch(() => [] as InjuryContextRow[]),
  ]);

  const goals = goalRows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    current: Number(row.current_value),
    target: Number(row.target_value),
    progress: row.progress,
    status: row.status,
  }));

  const todayKey = now.toISOString().split("T")[0];
  const lastWorkout = logs.logs.length > 0 ? logs.logs[logs.logs.length - 1] : null;

  const context: CoachUserContext = {
    userId,
    goals,
    stats: logs.stats,
    nutrition,
    injuries,
    lastWorkout,
    loggedToday: logs.logs.some(
      (log) => log.completedAt.slice(0, 10) === todayKey,
    ),
    summaryText: "",
  };

  context.summaryText = formatUserContext(context);
  return context;
}

async function loadNutritionContext(
  userId: string,
): Promise<CoachUserContext["nutrition"]> {
  try {
    const date = todayISOLocal();
    const [log, targets] = await Promise.all([
      fetchDailyLog(userId, date),
      fetchNutritionTargets(userId),
    ]);
    return { date, summary: log.summary, targets };
  } catch {
    return null;
  }
}

/** Compact, token-cheap rendering of the context for the prompts. */
export function formatUserContext(context: CoachUserContext): string {
  const lines: string[] = [];

  lines.push(
    `Streak: ${context.stats.streak} day(s) · workouts completed: ${context.stats.workoutsCompleted} · this week: ${context.stats.weeklyDaysThisWeek} day(s).`,
  );

  if (context.loggedToday) {
    lines.push("The user already logged a workout today.");
  }

  if (context.lastWorkout) {
    const w = context.lastWorkout;
    lines.push(
      `Last workout: ${w.goal} / ${w.level} / ${w.durationMinutes} min / ${w.exerciseCount} exercises, logged ${w.completedAt.slice(0, 10)} (id ${w.id}).`,
    );
  }

  lines.push(
    context.goals.length > 0
      ? `Goals:\n${context.goals
          .map(
            (g) =>
              `- ${g.name} (${g.category}): ${g.progress}% — ${g.current} → ${g.target} ${g.unit} [${g.status}]`,
          )
          .join("\n")}`
      : "Goals: none set.",
  );

  lines.push(
    context.injuries.length > 0
      ? `Injuries to respect:\n${context.injuries
          .map((i) => `- ${i.region} (${i.severity}, ${i.status})`)
          .join("\n")}`
      : "Injuries: none reported.",
  );

  if (context.nutrition) {
    const { summary, targets, date } = context.nutrition;
    lines.push(
      `Nutrition ${date}: ${Math.round(summary.kcal)}/${targets.kcal} kcal, protein ${Math.round(summary.protein)}/${targets.proteinG} g.`,
    );
  }

  return lines.join("\n\n");
}

// ---------------------------------------------------------------------------
// generate_workout
// ---------------------------------------------------------------------------

export interface WorkoutDraftInput {
  goal: string;
  durationMinutes: number;
  level: string;
  preset: string;
  exercises?: { name: string; sets?: number }[];
  focus?: string | null;
  avoid?: string | null;
}

/**
 * Rules-based workout draft (the generator logic mirrored, not the AI): the
 * intent node asks the planner model for structure, then this normalizes it
 * into the shape `logWorkout` expects.
 */
export function buildWorkoutDraft(input: WorkoutDraftInput) {
  return {
    id: `ai_${Date.now().toString(36)}`,
    goal: input.goal,
    level: input.level,
    durationMinutes: Math.round(input.durationMinutes),
    preset: input.preset,
    exercises: (input.exercises ?? []).map((exercise, index) => ({
      key: `ai-${index}`,
      name: exercise.name,
      sets: exercise.sets ?? 3,
    })),
  };
}

// ---------------------------------------------------------------------------
// log_or_edit_workout
// ---------------------------------------------------------------------------

export interface LoggedWorkoutSummary {
  log: WorkoutLogView | null;
  goalUpdates: GoalUpdate[];
  stats: ProgressStats;
}

/** Write a completed workout and fan the result out to every mapped goal. */
export async function logWorkoutTool(
  userId: string,
  workout: Parameters<typeof logWorkout>[1],
): Promise<LoggedWorkoutSummary> {
  const result: LogWorkoutResult = await logWorkout(userId, workout);
  return {
    log: result.log,
    goalUpdates: result.goalUpdates,
    stats: result.stats,
  };
}

/** Undo a workout log, reverting the goal progress it created. */
export async function undoWorkoutTool(
  userId: string,
  logId?: string | null,
): Promise<UndoWorkoutResult> {
  let targetId = logId?.trim() || null;

  if (!targetId) {
    // "undo my last workout" — resolve to the most recent *undoable* log.
    const { logs } = await loadLogs(userId);
    const undoable = [...logs].reverse().find((log) => log.undoable);
    if (!undoable) {
      throw new Error(
        "There is no workout logged today that can be undone. Only same-day logs can be reverted.",
      );
    }
    targetId = undoable.id;
  }

  return undoWorkoutLog(userId, targetId);
}

// ---------------------------------------------------------------------------
// progress_goals
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  stats: ProgressStats;
  goals: CoachUserContext["goals"];
  recentWorkouts: WorkoutLogView[];
}

export async function progressGoalsTool(
  userId: string,
): Promise<ProgressSnapshot> {
  const [{ stats, logs }, context] = await Promise.all([
    loadLogs(userId),
    loadUserContext(userId),
  ]);
  return {
    stats,
    goals: context.goals,
    recentWorkouts: logs.slice(-5).reverse(),
  };
}

// ---------------------------------------------------------------------------
// nutrition_qa
// ---------------------------------------------------------------------------

export async function nutritionTool(userId: string): Promise<{
  today: DailyLog;
  targets: NutritionTargets;
}> {
  const date = todayISOLocal();
  const [today, targets] = await Promise.all([
    fetchDailyLog(userId, date),
    fetchNutritionTargets(userId),
  ]);
  return { today, targets };
}

// ---------------------------------------------------------------------------
// formatting helpers used by respond
// ---------------------------------------------------------------------------

export function formatLoggedWorkout(summary: LoggedWorkoutSummary): string {
  const updated = summary.goalUpdates.filter((g) => g.status === "updated");
  const unchanged = summary.goalUpdates.filter((g) => g.status === "no_change");

  const lines = [`Logged it — streak is now ${summary.stats.streak} day(s).`];

  if (updated.length > 0) {
    lines.push(
      `Goals updated:\n${updated
        .map((g) => `- ${g.goalName}: ${g.value} ${g.unit} (${g.reason})`)
        .join("\n")}`,
    );
  }
  if (unchanged.length > 0) {
    lines.push(
      `No change:\n${unchanged.map((g) => `- ${g.goalName}: ${g.reason}`).join("\n")}`,
    );
  }
  if (summary.log) {
    lines.push(`You can undo this from Progress, or ask me to undo it now.`);
  }
  return lines.join("\n\n");
}

export function formatGuardrail(verdict: GuardrailVerdict): string {
  switch (verdict.verdict) {
    case "block":
      return `That's outside what I can safely coach you on. I'm flagging it for a human coach — please speak with a qualified professional (a doctor, physiotherapist, or registered dietitian) before acting on it.`;
    case "soften":
      return `I can share general guidance, but please treat it as a starting point, not medical advice:\n\n${verdict.note}`.trim();
    default:
      return "";
  }
}
