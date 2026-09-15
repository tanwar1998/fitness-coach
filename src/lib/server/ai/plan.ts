import { z } from "zod";
import { getExerciseIndex } from "./exercise-retrieval";
import type { CoachConstraints, WorkoutPlan } from "@/lib/coach-types";

/**
 * Plan/constraint domain logic for the coaching graph. Everything here is pure
 * and unit-testable; the graph only calls these helpers and never inlines the
 * "should we adjust?" or "how long does this plan take?" logic.
 */

export const workoutItemSchema = z.object({
  exerciseId: z.number().int().nonnegative(),
  name: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.string().min(1),
  notes: z.string(),
});

/** Structured output shape the replan step produces (and validates against). */
export const workoutPlanSchema = z.object({
  date: z.string().min(1),
  items: z.array(workoutItemSchema).min(1),
  adjustedReason: z.string().nullable(),
});

export const constraintsSchema = z.object({
  energy: z.enum(["low", "normal", "high"]).nullable(),
  painFlag: z.boolean(),
  painNote: z.string().nullable(),
  timeAvailableMin: z.number().nullable(),
});

export type WorkoutPlanSchema = z.infer<typeof workoutPlanSchema>;

export const DEFAULT_CONSTRAINTS: CoachConstraints = {
  energy: null,
  painFlag: false,
  painNote: null,
  timeAvailableMin: null,
};

/** Rough minutes a plan "assumes" (each working set + rest ≈ 3 minutes). */
export function planAssumesMinutes(plan: WorkoutPlan | null): number {
  if (!plan || plan.items.length === 0) return 0;
  const workingSets = plan.items.reduce(
    (sum, item) => sum + Math.max(1, Math.round(item.sets)),
    0,
  );
  return Math.max(10, workingSets * 3);
}

/**
 * Decide whether today's constraints warrant touching the plan. Only low
 * energy, an explicit pain flag, or meaningfully less available time than the
 * plan assumes triggers a replan — a normal check-in leaves the plan alone.
 */
export function planNeedsAdjustment(
  plan: WorkoutPlan | null,
  constraints: CoachConstraints,
): boolean {
  if (!plan || plan.items.length === 0) return false;
  if (constraints.energy === "low") return true;
  if (constraints.painFlag === true) return true;
  if (constraints.timeAvailableMin != null) {
    return constraints.timeAvailableMin < planAssumesMinutes(plan);
  }
  return false;
}

/** Map a free-text energy answer ("low", "I'm exhausted", ...) to a level. */
export function normalizeEnergy(answer: unknown): CoachConstraints["energy"] {
  const value = String(answer ?? "").trim().toLowerCase();
  if (/low|tired|fatigue|exhausted|drained|beat\b/.test(value)) return "low";
  if (/high|great|energ|pumped|good/.test(value)) return "high";
  return "normal";
}

/** Interpret the pain yes/no answer (accepts yes/no and casual variants). */
export function answerIsYes(answer: unknown): boolean {
  const value = String(answer ?? "").trim().toLowerCase();
  return (
    value.startsWith("y") ||
    /yes|yeah|yep|sure|hurts?|pain|sore/.test(value)
  );
}

/**
 * Parse a free-text time answer ("30 min", "an hour", "half", "no change")
 * into minutes, or null when nothing usable was said.
 */
export function parseTimeMinutes(input: unknown): number | null {
  const text = String(input ?? "").trim().toLowerCase();
  if (!text) return null;
  if (/no|none|n\/a|same|usual|normal|unlimited|as long/.test(text)) return null;

  const hours = text.match(/(\d+(?:\.\d+)?)\s*(hrs?|hour|hours)\b/);
  if (hours) return Math.round(Number(hours[1]) * 60);

  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(mins?|minute|minutes)\b/);
  if (minutes) return Math.max(1, Math.round(Number(minutes[1])));

  if (/half\s*(an\s*)?hour|30\s*min/.test(text)) return 30;

  const bare = text.match(/^(\d{1,3})$/);
  if (bare) return Math.max(1, Number(bare[1]));

  return null;
}

/** Build the retrieval query used to find low-impact alternatives. */
export function buildConstraintsQuery(
  constraints: CoachConstraints,
  plan: WorkoutPlan | null,
): string {
  const parts = ["Adjust today's workout for:"];
  if (constraints.energy === "low") {
    parts.push("- Energy is low — prefer gentler, lower-volume options.");
  } else if (constraints.energy === "high") {
    parts.push("- Energy is high.");
  }
  if (constraints.painFlag) {
    parts.push(
      constraints.painNote
        ? `- Pain/soreness reported: ${constraints.painNote}. Prefer low-impact alternatives that avoid the affected area.`
        : "- Pain/soreness reported — prefer low-impact alternatives that avoid the affected area.",
    );
  }
  if (constraints.timeAvailableMin != null) {
    parts.push(`- Only about ${constraints.timeAvailableMin} minutes available.`);
  }
  if (plan && plan.items.length > 0) {
    parts.push(`- Exercises currently in the plan: ${plan.items.map((i) => i.name).join(", ")}`);
  }
  return parts.join("\n");
}

/** True when two plans are structurally identical (used for planChanged). */
export function plansEqual(a: WorkoutPlan | null, b: WorkoutPlan | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.date === b.date &&
    a.adjustedReason === b.adjustedReason &&
    a.items.length === b.items.length &&
    a.items.every(
      (item, index) =>
        item.exerciseId === b.items[index].exerciseId &&
        item.sets === b.items[index].sets &&
        item.reps === b.items[index].reps &&
        item.notes === b.items[index].notes &&
        item.name === b.items[index].name,
    )
  );
}

/**
 * Deterministic safety-net adjustment used when the model output is unusable.
 * It only scales volume (never swaps exercises) and always explains itself, so
 * an unexplained replan can never slip through even on LLM failure.
 */
export function adjustPlanForConstraints(
  plan: WorkoutPlan,
  constraints: CoachConstraints,
): WorkoutPlan {
  const reasons: string[] = [];
  if (constraints.energy === "low") reasons.push("low energy");
  if (constraints.painFlag) {
    reasons.push(
      constraints.painNote
        ? `reported "${constraints.painNote}"`
        : "reported pain/soreness",
    );
  }

  let items = plan.items.map((item) => ({ ...item }));

  const scaleDown = constraints.energy === "low" || constraints.painFlag;
  if (scaleDown) {
    items = items.map((item) => ({
      ...item,
      sets: Math.max(2, Math.round(item.sets) - 1),
      notes: item.notes
        ? `${item.notes} · lighter`
        : "lighter today",
    }));
  }

  if (constraints.timeAvailableMin != null) {
    const budget = Math.max(1, constraints.timeAvailableMin);
    const kept: typeof items = [];
    let remaining = budget;
    for (const item of items) {
      const itemMinutes = Math.max(2, Math.round(item.sets)) * 3;
      if (remaining < itemMinutes && kept.length > 0) break;
      kept.push(item);
      remaining -= itemMinutes;
    }
    if (kept.length > 0 && kept.length < items.length) {
      items = kept;
    }
    reasons.push(`fitted into ${constraints.timeAvailableMin} minutes`);
  }

  const adjustedReason =
    reasons.length > 0
      ? `Adjusted today's plan (${reasons.join("; ")}): lowered volume to keep it manageable.`
      : null;

  return { ...plan, items, adjustedReason };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve a client-supplied exercise name (or partial id) to a wger index id.
 * Returns 0 when unresolvable — the UI renders by name, so an unmatched legacy
 * exercise still displays fine.
 */
export function resolveExerciseId(name: string, exerciseId?: unknown): number {
  if (typeof exerciseId === "number" && Number.isFinite(exerciseId)) {
    return Math.max(0, Math.round(exerciseId));
  }
  if (typeof exerciseId === "string" && /^[0-9]+$/.test(exerciseId.trim())) {
    return Math.max(0, Number(exerciseId.trim()));
  }

  const index = getExerciseIndex();
  if (!index) return 0;

  const target = normalizeName(name);
  if (!target) return 0;

  const exact = index.find((item) => normalizeName(item.name) === target);
  if (exact) return exact.id;

  const partial = index.find(
    (item) => target.length >= 4 && normalizeName(item.name).includes(target),
  );
  return partial?.id ?? 0;
}

/**
 * Canonicalize an untrusted plan payload (e.g. the client's GeneratedWorkout)
 * into a valid WorkoutPlan: coerces types, resolves exercise ids by name, and
 * rejects malformed entries. Returns null when nothing usable was supplied.
 */
export function canonicalizePlan(payload: unknown, fallbackDate: string): WorkoutPlan | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as {
    date?: unknown;
    adjustedReason?: unknown;
    items?: unknown;
  };
  if (!Array.isArray(raw.items) || raw.items.length === 0) return null;

  const items: WorkoutPlan["items"] = [];
  for (const rawItems of raw.items) {
    if (!rawItems || typeof rawItems !== "object") continue;
    const rawItem = rawItems as {
      name?: unknown;
      sets?: unknown;
      reps?: unknown;
      notes?: unknown;
      exerciseId?: unknown;
    };
    if (typeof rawItem.name !== "string" || !rawItem.name.trim()) continue;
    const sets = typeof rawItem.sets === "number" && rawItem.sets > 0
      ? Math.round(rawItem.sets)
      : typeof rawItem.sets === "string" && /^[0-9]+$/.test(rawItem.sets)
        ? Number(rawItem.sets)
        : 1;
    const reps =
      typeof rawItem.reps === "string" && rawItem.reps.trim()
        ? rawItem.reps.trim()
        : "8-12";
    const notes =
      typeof rawItem.notes === "string" ? rawItem.notes.trim() : "";
    const exerciseId = resolveExerciseId(
      rawItem.name.trim(),
      rawItem.exerciseId,
    );

    items.push({
      exerciseId,
      name: rawItem.name.trim(),
      sets: Math.max(1, sets),
      reps,
      notes,
    });
  }

  if (items.length === 0) return null;

  const parsed = workoutPlanSchema.safeParse({
    date: typeof raw.date === "string" && raw.date ? raw.date : fallbackDate,
    items,
    adjustedReason:
      typeof raw.adjustedReason === "string" ? raw.adjustedReason : null,
  });

  return parsed.success ? parsed.data : null;
}