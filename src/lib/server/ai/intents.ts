import { z } from "zod";

/**
 * Intents the v2 coach graph can route to. One graph node handles each.
 *  - generate_workout     ask for / rebuild a training session
 *  - log_or_edit_workout  record a finished workout, undo or edit a logged one
 *  - progress_goals       questions about goals, streaks, stats, history
 *  - nutrition_qa         food, macros, meal timing, calories
 *  - general_chat         everything else coach-related
 *  - confirm_pending_action  a reply to the graph's pending confirmation
 */
export const INTENTS = [
  "generate_workout",
  "log_or_edit_workout",
  "progress_goals",
  "nutrition_qa",
  "general_chat",
  "confirm_pending_action",
] as const;

export type CoachIntent = (typeof INTENTS)[number];

export const intentSchema = z.object({
  intent: z.enum(INTENTS),
  /** 0..1 — how sure the router is. Low confidence falls back to chat. */
  confidence: z.number().min(0).max(1),
  /** Short human-readable reason, useful for tracing/debugging. */
  reasoning: z.string(),
});

export type IntentClassification = z.infer<typeof intentSchema>;

/** Confidence below this is treated as general_chat instead of the guess. */
export const MIN_ROUTER_CONFIDENCE = 0.5;

/**
 * What the write-intent node wants to do. Produced by the planner model and
 * validated here before any database write happens.
 *
 * Deliberately a FLAT object rather than a discriminated union: Gemini's
 * `response_schema` rejects the `const` keyword that zod emits for unions
 * ("Unknown name \"const\" ... Cannot find field"), which made the log/undo
 * path silently classify every completed workout as "none". Payload fields are
 * optional in the schema and validated/normalized in the node.
 */
export const workoutActionSchema = z.object({
  action: z.enum(["log_workout", "undo_workout", "none"]),
  goal: z
    .enum(["strength", "hypertrophy", "endurance", "full_body", "mobility"])
    .optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  durationMinutes: z.number().int().min(1).max(300).optional(),
  preset: z
    .enum(["full", "barbell", "dumbbell", "kettlebell", "cable", "home", "bodyweight"])
    .optional(),
  exercises: z
    .array(
      z.object({
        name: z.string().min(1),
        sets: z.number().int().min(1).max(20).optional(),
      }),
    )
    .optional(),
  logId: z.string().optional(),
});

export type WorkoutAction = z.infer<typeof workoutActionSchema>;

/** Coaching guardrail verdict produced by the safety node. */
export const guardrailSchema = z.object({
  /**
   * safe     – answer normally
   * soften   – keep the answer but add safety framing/limits
   * block    – do not deliver the advice; hand off to a human
   */
  verdict: z.enum(["safe", "soften", "block"]),
  /** short tag, e.g. "injury", "extreme_diet", "medical", "none" */
  category: z.string(),
  /** What the responder should do differently (empty when safe). */
  note: z.string(),
});

export type GuardrailVerdict = z.infer<typeof guardrailSchema>;
