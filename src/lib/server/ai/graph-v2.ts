import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { Runnable } from "@langchain/core/runnables";
import {
  Annotation,
  END,
  START,
  StateGraph,
  interrupt,
  messagesStateReducer,
} from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import {
  getStructuredModel,
  getRoleModel,
  invokeModel,
  logAnsweredModel,
  resolveRoleConfig,
} from "@/ai/models";
import {
  guardrailSchema,
  intentSchema,
  MIN_ROUTER_CONFIDENCE,
  workoutActionSchema,
  type CoachIntent,
  type GuardrailVerdict,
  type IntentClassification,
  type WorkoutAction,
} from "./intents";
import {
  buildWorkoutDraft,
  formatGuardrail,
  formatLoggedWorkout,
  loadUserContext,
  logWorkoutTool,
  nutritionTool,
  progressGoalsTool,
  undoWorkoutTool,
  type CoachUserContext,
  type LoggedWorkoutSummary,
} from "./tools";
import { CHAT_SYSTEM_PROMPT } from "./system-prompt";
import { tracingRunConfig } from "./config";
import type { CoachAction, CoachConstraints, WorkoutPlan } from "@/lib/coach-types";

/**
 * AI coach graph v2 — intent-routed, tool-backed, guardrailed.
 *
 *   START → load_context → router
 *     router ⇢ generate_workout | log_or_edit_workout | progress_goals
 *            | nutrition_qa | general_chat
 *     each intent → guardrail → respond → END
 *
 * Write intents call interrupt() before touching the database, so no saved plan
 * is changed and no workout is logged without the user confirming it.
 *
 * This graph runs alongside the original coach graph (./graph.ts) and is only
 * used when COACH_GRAPH_MODE=langgraph (see ./config.ts).
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface PendingAction {
  /** What the user is being asked to confirm. */
  kind: "log_workout" | "undo_workout" | "change_plan";
  /** Human-readable confirmation prompt shown in the UI. */
  question: string;
  /** The validated action to run once the user says yes. */
  payload: WorkoutAction;
}

const CoachGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => messagesStateReducer(left, right),
    default: () => [],
  }),
  /** Device id — this app has no accounts, so it doubles as the user id. */
  userId: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  providerId: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  /** Client-supplied coaching profile (goal/equipment/target muscle). */
  profile: Annotation<unknown>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Today's plan, preserved across turns so the UI never loses it. */
  currentPlan: Annotation<WorkoutPlan | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  constraints: Annotation<CoachConstraints | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Everything the coach knows about the user for this turn. */
  userContext: Annotation<CoachUserContext | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Router output. */
  intent: Annotation<CoachIntent>({
    reducer: (_left, right) => right,
    default: () => "general_chat" as CoachIntent,
  }),
  intentConfidence: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  guardrailVerdict: Annotation<GuardrailVerdict | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  pendingAction: Annotation<PendingAction | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Structured result of a write intent (goal updates etc.). */
  toolResult: Annotation<LoggedWorkoutSummary | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Final assistant text produced by the graph. */
  output: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  /** Action the conversational nodes want the UI to take after this turn. */
  answerAction: Annotation<CoachAction>({
    reducer: (_left, right) => right,
    default: () => "finish" as CoachAction,
  }),
  /** Fixed choices when the conversational node asked an `ask_options` question. */
  answerOptions: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  requiresHuman: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
});

type State = typeof CoachGraphState.State;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestUserText(state: State): string {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const message = state.messages[i];
    if (message._getType() === "human") {
      return typeof message.content === "string"
        ? message.content
        : String(message.content);
    }
  }
  return "";
}

function messageText(message: BaseMessage): string {
  return typeof message.content === "string"
    ? message.content
    : String(message.content);
}

function historyForPrompt(state: State, limit = 12): string {
  return state.messages
    .filter((m) => m._getType() === "human" || m._getType() === "ai")
    .slice(-limit)
    .map((m) => `${m._getType() === "ai" ? "Coach" : "User"}: ${messageText(m)}`)
    .join("\n");
}

/** Text of the model reply regardless of whether it streamed chunks. */
function responseText(response: BaseMessage): string {
  const content = response.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof part === "object" && part && "text" in part
            ? String((part as { text?: unknown }).text ?? "")
            : "",
      )
      .join("")
      .trim();
  }
  return String(content ?? "").trim();
}

/** Parse a "yes/no" style confirmation answer. */
export function isAffirmative(answer: unknown): boolean {
  const value = String(answer ?? "").trim().toLowerCase();
  if (!value) return false;
  if (/^(no|n|nope|nah|cancel|stop|don'?t|do not|never)/.test(value)) return false;
  return /^(y|yes|yeah|yep|sure|ok|okay|confirm|go ahead|do it|please do|yup)\b/.test(
    value,
  );
}

// ---------------------------------------------------------------------------
// load_context
// ---------------------------------------------------------------------------

async function loadContextNode(state: State): Promise<Partial<State>> {
  const userId = state.userId;
  const context = await loadUserContext(userId);
  // Reset per-turn answer metadata so a previous turn's question cannot leak
  // into a turn whose node writes `output` directly (e.g. generate_workout).
  return { userContext: context, answerAction: "finish", answerOptions: [] };
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

const ROUTER_PROMPT = `You are the intake router for FitPulse, a fitness coaching app.
Classify the user's latest message into exactly one intent:

- generate_workout: they want a workout, routine, or training plan created, or an existing plan rebuilt/changed.
- log_or_edit_workout: they are reporting that they finished/started/skipped a workout, or asking to undo, delete, or edit a workout they logged.
- progress_goals: they ask about their goals, progress, streak, stats, history, or whether they trained.
- nutrition_qa: food, calories, macros, protein, meal timing, diet.
- general_chat: anything else coach-related (form questions, motivation, general advice).
- confirm_pending_action: they are replying yes/no/ok to a question the coach just asked to confirm an action.

Use the user context to disambiguate (e.g. "log it" after a plan was proposed = confirm_pending_action).
Set confidence to 0..1. If you are unsure, use general_chat with a low confidence.`;

/**
 * Deterministic safety net for router-model failures. A timeout must not turn
 * "I finished my workout, log it" into a chat answer that merely *claims* the
 * workout was logged.
 */
export function heuristicIntent(text: string): CoachIntent {
  const value = text.toLowerCase();

  // Explicit undo/delete requests.
  if (
    /\b(undo|delete|remove|cancel)\b[\s\S]*\b(workout|log|session|entry)\b/.test(value)
  ) {
    return "log_or_edit_workout";
  }

  // Past-tense questions ("did I log…", "how was my run?") ask about progress,
  // not about writing a new log. Keep this before the log/track matcher below.
  const asksAboutPast =
    /^\s*(did|have|has|was|were)\b/.test(value) ||
    /\bhow (was|were|did)\b/.test(value);
  if (
    asksAboutPast &&
    /\b(workout|run|training|session|log|week|target|progress|streak|lift|class)\b/.test(
      value,
    )
  ) {
    return "progress_goals";
  }

  // Reporting a completed/skipped/started session.
  if (
    /\b(i|we)\b[\s\S]*\b(finished|completed|did|done with|just did|got through|skipped|started)\b[\s\S]*\b(workout|session|training|lift|run|ride|class)\b/.test(
      value,
    )
  ) {
    return "log_or_edit_workout";
  }
  if (/\b(log|record|track)\b[\s\S]*\b(workout|session|it)\b/.test(value)) {
    return "log_or_edit_workout";
  }
  if (
    /\b(workout|training|routine|plan)\b/.test(value) &&
    /\b(create|make|build|generate|give|need|want|design|new|another)\b/.test(value)
  ) {
    return "generate_workout";
  }
  if (
    /\b(protein|calories?|kcal|macros?|meals?|diets?|nutrition|eat|eating|foods?)\b/.test(
      value,
    )
  ) {
    return "nutrition_qa";
  }
  if (
    /\b(goals?|progress|streak|stats|statistics|history|trained|weekly|targets?)\b/.test(
      value,
    ) ||
    /\b(this|last|past) week\b/.test(value)
  ) {
    return "progress_goals";
  }
  return "general_chat";
}

export interface ClassifyIntentOptions {
  /** A pending confirmation short-circuits the model entirely. */
  hasPendingAction?: boolean;
  /** Extra user context folded into the prompt. */
  context?: string;
  /**
   * Override the router model. Tests pass a mock here; production omits it and
   * the gateway's role model (with its fallback chain) is used.
   */
  model?: Runnable<BaseLanguageModelInput, unknown>;
}

/**
 * Classify one user message into a coach intent with the router model, falling
 * back to {@link heuristicIntent} when the model is unavailable or its
 * confidence is too low.
 *
 * Exported so the router accuracy harness can exercise the exact production
 * path without building the whole graph.
 */
export async function classifyIntent(
  text: string,
  options: ClassifyIntentOptions = {},
): Promise<{ intent: CoachIntent; confidence: number }> {
  if (options.hasPendingAction) {
    return { intent: "confirm_pending_action", confidence: 1 };
  }

  const config = resolveRoleConfig("router");
  const model =
    options.model ??
    getStructuredModel("router", intentSchema, { name: "classify_intent" });

  const prompt = [
    singleTurn([
      ROUTER_PROMPT,
      `Context:\n${options.context ?? "No user context available."}`,
      `Latest user message:\n${text || "(empty message)"}`,
    ]),
  ];
  try {
    const result = (await invokeModel(model, prompt)) as IntentClassification;
    logAnsweredModel("router", config.primary, config.model, {
      intent: result.intent,
      confidence: result.confidence,
    });

    if (!result || result.confidence < MIN_ROUTER_CONFIDENCE) {
      return {
        intent: "general_chat",
        confidence: result?.confidence ?? 0,
      };
    }
    return { intent: result.intent, confidence: result.confidence };
  } catch (error) {
    // Routing failures must never break the chat: fall back to a deterministic
    // classifier instead of defaulting every message to general_chat.
    console.error("Router failed; using deterministic intent heuristic:", error);
    return { intent: heuristicIntent(text), confidence: 0.3 };
  }
}

async function routerNode(state: State): Promise<Partial<State>> {
  const result = await classifyIntent(latestUserText(state), {
    hasPendingAction: state.pendingAction != null,
    context: state.userContext?.summaryText,
  });
  return { intent: result.intent, intentConfidence: result.confidence };
}

// ---------------------------------------------------------------------------
// generate_workout
// ---------------------------------------------------------------------------

const WORKOUT_PLAN_PROMPT = `You are FitPulse's workout generator.
Build a single training session that fits the user's request and their context.

Return ONLY JSON: {"goal": "strength|hypertrophy|endurance|full_body|mobility", "durationMinutes": 30, "level": "beginner|intermediate|advanced", "preset": "full|barbell|dumbbell|kettlebell|cable|home|bodyweight", "exercises": [{"name": "Exercise name", "sets": 3}], "summary": "one short sentence"}

Rules:
- Respect the user's available time, equipment and experience level from their message/context.
- Never program an exercise that loads an injured region listed in the context.
- Keep exercise count realistic for the duration (~5 min per exercise).
- Do not invent injury or medical advice.`;

interface WorkoutPlanResponse {
  goal: string;
  durationMinutes: number;
  level: string;
  preset: string;
  exercises: { name: string; sets?: number }[];
  summary?: string;
}

function profileForPrompt(state: State): string {
  const lines: string[] = [];
  if (state.profile) lines.push(`Profile: ${JSON.stringify(state.profile)}`);
  if (state.constraints) {
    lines.push(`Today's constraints: ${JSON.stringify(state.constraints)}`);
  }
  return lines.join("\n");
}

async function generateWorkoutNode(state: State): Promise<Partial<State>> {
  const config = resolveRoleConfig("planner");
  const model = getRoleModel("planner");

  const raw = await invokeModel(model, [
    singleTurn([
      WORKOUT_PLAN_PROMPT,
      `User context:\n${state.userContext?.summaryText ?? "unknown"}`,
      profileForPrompt(state),
      `Request:\n${latestUserText(state)}`,
    ]),
  ]);

  const text = responseText(raw as BaseMessage);
  logAnsweredModel("planner", config.primary, config.model, { node: "generate_workout" });

  const parsed = normalizeWorkoutPlan(safeJson<WorkoutPlanResponse>(text));
  const draft = buildWorkoutDraft({
    goal: parsed.goal,
    durationMinutes: parsed.durationMinutes,
    level: parsed.level,
    preset: parsed.preset,
    exercises: parsed.exercises,
  });

  const exerciseList =
    draft.exercises.length > 0
      ? draft.exercises.map((e, i) => `${i + 1}. ${e.name} — ${e.sets} sets`).join("\n")
      : "(no exercises generated)";

  const reply = `Here's a ${draft.durationMinutes}-minute ${draft.goal.replace("_", " ")} session for you:\n\n${exerciseList}\n\nTell me when you've finished it and I'll log it to your Progress.`;

  // Generating a plan does not touch the database, so there is nothing to
  // confirm here. The user asking to log it later goes through
  // log_or_edit_workout, which pauses on interrupt() before writing.
  return {
    output: reply,
    messages: [new AIMessage({ content: reply })],
    pendingAction: null,
  };
}

const WORKOUT_GOALS = [
  "strength",
  "hypertrophy",
  "endurance",
  "full_body",
  "mobility",
] as const;
const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
const EQUIPMENT_PRESETS = [
  "full",
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "home",
  "bodyweight",
] as const;

function pickEnum<T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Coerce untrusted planner output into a valid, typed workout plan. */
function normalizeWorkoutPlan(raw: WorkoutPlanResponse | null) {
  const duration =
    typeof raw?.durationMinutes === "number" && Number.isFinite(raw.durationMinutes)
      ? Math.min(300, Math.max(5, Math.round(raw.durationMinutes)))
      : 30;

  const exercises = Array.isArray(raw?.exercises)
    ? raw.exercises
        .filter((e) => e && typeof e.name === "string" && e.name.trim())
        .map((e) => ({
          name: e.name.trim(),
          sets:
            typeof e.sets === "number" && e.sets > 0
              ? Math.min(20, Math.round(e.sets))
              : 3,
        }))
    : [];

  return {
    goal: pickEnum(WORKOUT_GOALS, raw?.goal, "full_body"),
    level: pickEnum(EXPERIENCE_LEVELS, raw?.level, "intermediate"),
    preset: pickEnum(EQUIPMENT_PRESETS, raw?.preset, "full"),
    durationMinutes: duration,
    exercises,
  };
}

// ---------------------------------------------------------------------------
// log_or_edit_workout
// ---------------------------------------------------------------------------

const WORKOUT_ACTION_PROMPT = `You are FitPulse's workout-bookkeeping step.
Decide what the user wants done to their workout log and return ONLY JSON.

- {"action":"log_workout","goal":"strength|hypertrophy|endurance|full_body|mobility","level":"beginner|intermediate|advanced","durationMinutes":30,"preset":"full|barbell|dumbbell|kettlebell|cable|home|bodyweight","exercises":[{"name":"...","sets":3}]}
  when they report finishing a workout.
- {"action":"undo_workout","logId":null} when they want to undo/delete a logged workout. Use null unless they named a specific log.
- {"action":"none"} when it is not actually a workout-logging request.

Only pick log_workout when the user's message clearly says they trained/completed/started a session.`;

/** Coerce the model's untrusted log fields into what `logWorkout` expects. */
function normalizeLogPayload(action: WorkoutAction) {
  return {
    goal: pickEnum(WORKOUT_GOALS, action.goal, "full_body"),
    level: pickEnum(EXPERIENCE_LEVELS, action.level, "intermediate"),
    durationMinutes:
      typeof action.durationMinutes === "number" &&
      Number.isFinite(action.durationMinutes)
        ? Math.min(300, Math.max(1, Math.round(action.durationMinutes)))
        : 30,
    preset: pickEnum(EQUIPMENT_PRESETS, action.preset, "full"),
    exercises: Array.isArray(action.exercises)
      ? action.exercises
          .filter(
            (exercise) =>
              exercise &&
              typeof exercise.name === "string" &&
              exercise.name.trim(),
          )
          .map((exercise) => ({
            name: exercise.name.trim(),
            sets:
              typeof exercise.sets === "number" && exercise.sets > 0
                ? Math.min(20, Math.round(exercise.sets))
                : 3,
          }))
      : [],
  };
}

/** Models sometimes emit the literal string "null" for an absent log id. */
function optionalLogId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  return lowered === "null" || lowered === "undefined" || lowered === "none"
    ? null
    : trimmed;
}

/**
 * Classification only — this node never calls `interrupt()`.
 *
 * LangGraph re-runs an interrupted node from the top when it resumes, so mixing
 * the model call and the confirmation in one node made the classification run
 * twice and occasionally flip to "none" after the user had already confirmed.
 * The action is persisted here and the confirmation happens in the next node.
 */
async function logOrEditWorkoutNode(state: State): Promise<Partial<State>> {
  const config = resolveRoleConfig("planner");
  const model = getStructuredModel("planner", workoutActionSchema, {
    name: "workout_action",
  });

  let action: WorkoutAction;
  try {
    action = (await invokeModel(model, [
      singleTurn([
        WORKOUT_ACTION_PROMPT,
        `User context:\n${state.userContext?.summaryText ?? "unknown"}`,
        `User message:\n${latestUserText(state)}`,
      ]),
    ])) as WorkoutAction;
    logAnsweredModel("planner", config.primary, config.model, {
      node: "log_or_edit_workout",
      action: action.action,
    });
  } catch (error) {
    console.error("Workout action classification failed:", error);
    action = { action: "none" };
  }

  if (action.action === "none") {
    const reply =
      "I didn't catch which workout you mean. Tell me what you finished (and roughly how long) and I'll log it for you.";
    return {
      output: reply,
      messages: [new AIMessage({ content: reply })],
      pendingAction: null,
    };
  }

  const logPayload =
    action.action === "log_workout" ? normalizeLogPayload(action) : null;

  const question = logPayload
    ? `Confirm: log a ${logPayload.durationMinutes}-minute ${logPayload.goal.replace("_", " ")} session to your Progress? This will update the goals it maps to.`
    : "Confirm: undo your most recent workout log? This reverts the streak and the goal progress it added.";

  const payload: WorkoutAction = logPayload
    ? { action: "log_workout", ...logPayload }
    : { action: "undo_workout", logId: optionalLogId(action.logId) ?? undefined };

  return {
    pendingAction: { kind: action.action, question, payload },
  };
}

/**
 * Confirmation gate. Nothing is written before `interrupt()` returns "yes";
 * the graph pauses here and the UI shows `pendingAction.question`.
 */
async function confirmWorkoutActionNode(
  state: State,
): Promise<Partial<State>> {
  const pending = state.pendingAction;
  if (!pending) {
    const reply = "There's nothing waiting for your confirmation right now.";
    return {
      output: reply,
      messages: [new AIMessage({ content: reply })],
      pendingAction: null,
    };
  }

  const answer = await interrupt({
    action: "ask_options",
    question: pending.question,
    options: ["Yes, do it", "No, cancel"],
  });

  if (!isAffirmative(answer)) {
    const reply = "No problem — I haven't changed anything.";
    return {
      output: reply,
      messages: [new AIMessage({ content: reply })],
      pendingAction: null,
    };
  }

  try {
    if (pending.payload.action === "log_workout") {
      const logPayload = normalizeLogPayload(pending.payload);
      const summary = await logWorkoutTool(state.userId, {
        id: `ai_${Date.now().toString(36)}`,
        ...logPayload,
        exercises: logPayload.exercises.map((exercise, index) => ({
          key: `ai-${index}`,
          name: exercise.name,
          sets: exercise.sets,
        })),
      });
      const reply = formatLoggedWorkout(summary);
      return {
        toolResult: summary,
        output: reply,
        messages: [new AIMessage({ content: reply })],
        pendingAction: null,
      };
    }

    const result = await undoWorkoutTool(
      state.userId,
      optionalLogId(pending.payload.logId),
    );
    const reply = `Undone. Your streak is now ${result.stats.streak} day(s)${
      result.goals.length > 0
        ? ` and ${result.goals.length} goal(s) were recalculated`
        : ""
    }.`;
    return {
      output: reply,
      messages: [new AIMessage({ content: reply })],
      pendingAction: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    const reply = `I couldn't complete that: ${message}`;
    return {
      output: reply,
      messages: [new AIMessage({ content: reply })],
      pendingAction: null,
    };
  }
}

// ---------------------------------------------------------------------------
// progress_goals / nutrition_qa / general_chat
// ---------------------------------------------------------------------------

async function progressGoalsNode(state: State): Promise<Partial<State>> {
  const snapshot = await progressGoalsTool(state.userId);
  const config = resolveRoleConfig("chat");
  const model = getRoleModel("chat");

  const data = JSON.stringify(
    {
      stats: snapshot.stats,
      goals: snapshot.goals,
      recentWorkouts: snapshot.recentWorkouts.map((w) => ({
        id: w.id,
        goal: w.goal,
        durationMinutes: w.durationMinutes,
        completedAt: w.completedAt,
        updatedGoals: w.updatedGoals.map((g) => g.goalName),
      })),
    },
    null,
    2,
  );

  const raw = await invokeModel(model, [singleTurn([
    CHAT_SYSTEM_PROMPT,
    `Live progress data (the ONLY source of truth — never invent numbers):
${data}`,
    `Conversation so far:
${historyForPrompt(state)}`,
    `User message:
${latestUserText(state)}`,
  ])]);

  logAnsweredModel("chat", config.primary, config.model, { node: "progress_goals" });
  return answerFrom(raw as BaseMessage);
}

async function nutritionQaNode(state: State): Promise<Partial<State>> {
  const { today, targets } = await nutritionTool(state.userId);
  const config = resolveRoleConfig("chat");
  const model = getRoleModel("chat");

  const data = JSON.stringify(
    {
      date: today.date,
      summary: today.summary,
      targets,
      entries: today.entries.map((e) => ({
        name: e.ingredientName,
        kcal: e.kcal,
        protein: e.protein,
      })),
    },
    null,
    2,
  );

  const raw = await invokeModel(model, [singleTurn([
    CHAT_SYSTEM_PROMPT,
    `Today's logged intake and targets:
${data}`,
    `Conversation so far:
${historyForPrompt(state)}`,
    `User message:
${latestUserText(state)}`,
  ])]);

  logAnsweredModel("chat", config.primary, config.model, { node: "nutrition_qa" });
  return answerFrom(raw as BaseMessage);
}

async function generalChatNode(state: State): Promise<Partial<State>> {
  const config = resolveRoleConfig("chat");
  const model = getRoleModel("chat");

  const raw = await invokeModel(model, [singleTurn([
    CHAT_SYSTEM_PROMPT,
    `User context:
${state.userContext?.summaryText ?? "unknown"}`,
    profileForPrompt(state),
    `Conversation so far:
${historyForPrompt(state)}`,
    `User message:
${latestUserText(state)}`,
  ])]);

  logAnsweredModel("chat", config.primary, config.model, { node: "general_chat" });
  return answerFrom(raw as BaseMessage);
}

async function confirmPendingActionNode(): Promise<Partial<State>> {
  // Reaching here without a pending action means the router saw a yes/no with
  // nothing to confirm. Clear any stale flag so the thread cannot get stuck
  // routing every future message back to this node.
  const reply = "There's nothing waiting for your confirmation right now.";
  return {
    output: reply,
    messages: [new AIMessage({ content: reply })],
    pendingAction: null,
  };
}

function answerFrom(raw: BaseMessage): Partial<State> {
  const rawText = responseText(raw);

  // The v2 prompts ask for plain markdown, but a fallback provider (or a model
  // that has seen the legacy prompt) may still answer with the JSON envelope.
  // Never show that envelope to the user: unwrap the `reply` field when present.
  const envelope = safeJson<{
    reply?: unknown;
    action?: unknown;
    options?: unknown;
  }>(rawText);
  const content =
    typeof envelope?.reply === "string" && envelope.reply.trim()
      ? envelope.reply.trim()
      : rawText;

  const action: CoachAction =
    envelope?.action === "ask_question" || envelope?.action === "ask_options"
      ? envelope.action
      : "finish";
  const options = Array.isArray(envelope?.options)
    ? envelope.options.filter(
        (option): option is string =>
          typeof option === "string" && option.trim().length > 0,
      )
    : [];

  return {
    output: content,
    messages: [new AIMessage({ content })],
    answerAction: action,
    answerOptions: options,
  };
}

/**
 * The chat providers add their own system prompt and accept only user/assistant
 * turns, so instructions + context are folded into a single human message
 * instead of stacking SystemMessages (which the adapters reject).
 */
function singleTurn(blocks: string[]): HumanMessage {
  const separator = "\n\n";
  return new HumanMessage(blocks.filter(Boolean).join(separator));
}

function safeJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// guardrail
// ---------------------------------------------------------------------------

const GUARDRAIL_PROMPT = `You are FitPulse's safety reviewer. Read the coach's draft reply and the user's message and decide:
- "block": the reply gives medical diagnosis, injury treatment, or extreme/unsafe dieting advice (e.g. sub-1000 kcal diets, dehydration, training through acute injury, drug protocols).
- "soften": the reply is broadly fine but touches pain, injury, a medical condition, or aggressive fat loss and needs limits + a "see a professional" nudge.
- "safe": neither applies.

Return ONLY JSON: {"verdict":"safe|soften|block","category":"none|medical|injury|extreme_diet|","note":"what to change, empty when safe"}`;

async function guardrailNode(state: State): Promise<Partial<State>> {
  const role = "router"; // cheap model — this is a classification task
  const config = resolveRoleConfig(role);
  const model = getStructuredModel(role, guardrailSchema, {
    name: "guardrail",
  });

  let verdict: GuardrailVerdict;
  try {
    verdict = (await invokeModel(model, [
      singleTurn([
        GUARDRAIL_PROMPT,
        `User message:\n${latestUserText(state)}`,
        `Draft reply:\n${state.output}`,
      ]),
    ])) as GuardrailVerdict;
    logAnsweredModel(role, config.primary, config.model, {
      node: "guardrail",
      verdict: verdict.verdict,
      category: verdict.category,
    });
  } catch (error) {
    // Fail closed on safety-relevant heuristics, open otherwise.
    console.error("Guardrail failed; applying deterministic check:", error);
    verdict = deterministicGuardrail(latestUserText(state), state.output);
  }

  if (verdict.verdict === "safe") {
    return { guardrailVerdict: verdict, requiresHuman: false };
  }

  if (verdict.verdict === "block") {
    // Replace the unsafe answer entirely and hand off to a human.
    const replacement = formatGuardrail(verdict);
    return {
      guardrailVerdict: verdict,
      requiresHuman: true,
      output: replacement,
      messages: [new AIMessage({ content: replacement })],
      answerAction: "finish",
      answerOptions: [],
    };
  }

  // soften: keep the answer, prepend the limits.
  const prefix = formatGuardrail(verdict);
  const softened = prefix ? `${prefix}\n\n${state.output}` : state.output;
  return {
    guardrailVerdict: verdict,
    requiresHuman: false,
    output: softened,
    messages: [new AIMessage({ content: softened })],
  };
}

const UNSAFE_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(chest pain|can'?t breathe|shortness of breath)\b/i, category: "medical" },
  { pattern: /\b(starv|fast(ing)? for \d+ days|under \d{3,4} (kcal|calories))/i, category: "extreme_diet" },
  { pattern: /\b(diagnos|prescrib|medication|steroid cycle)\b/i, category: "medical" },
  { pattern: /\b(train|push|work ?out) through (the )?(pain|injury)\b/i, category: "injury" },
];

/** Regex safety net used only when the guardrail model fails. */
export function deterministicGuardrail(
  userMessage: string,
  draft: string,
): GuardrailVerdict {
  const haystack = `${userMessage}\n${draft}`;
  for (const { pattern, category } of UNSAFE_PATTERNS) {
    if (pattern.test(haystack)) {
      return {
        verdict: "block",
        category,
        note: "Matched a deterministic safety pattern.",
      };
    }
  }
  return { verdict: "safe", category: "none", note: "" };
}

// ---------------------------------------------------------------------------
// respond
// ---------------------------------------------------------------------------

async function respondNode(state: State): Promise<Partial<State>> {
  // output was already finalized by the intent/guardrail nodes; record it as
  // the assistant turn exactly once.
  const content = state.output.trim();
  if (!content) {
    return {};
  }
  const last = state.messages[state.messages.length - 1];
  if (last && last._getType() === "ai" && messageText(last) === content) {
    return {};
  }
  return { messages: [new AIMessage({ content })] };
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function routeFromRouter(state: State): string {
  switch (state.intent) {
    case "generate_workout":
      return "generate_workout";
    case "log_or_edit_workout":
      return "log_or_edit_workout";
    case "progress_goals":
      return "progress_goals";
    case "nutrition_qa":
      return "nutrition_qa";
    case "confirm_pending_action":
      return "confirm_pending_action";
    default:
      return "general_chat";
  }
}

function routeAfterWorkoutAction(state: State): string {
  return state.pendingAction ? "confirm_workout_action" : "guardrail";
}

/**
 * Build (and compile) the v2 coach graph.
 * Pass a checkpointer to persist threads; omit it for in-memory/tests.
 */
export function buildCoachGraphV2(checkpointer?: BaseCheckpointSaver) {
  const graph = new StateGraph(CoachGraphState)
    .addNode("load_context", loadContextNode)
    .addNode("router", routerNode)
    .addNode("generate_workout", generateWorkoutNode)
    .addNode("log_or_edit_workout", logOrEditWorkoutNode)
    .addNode("confirm_workout_action", confirmWorkoutActionNode)
    .addNode("progress_goals", progressGoalsNode)
    .addNode("nutrition_qa", nutritionQaNode)
    .addNode("general_chat", generalChatNode)
    .addNode("confirm_pending_action", confirmPendingActionNode)
    .addNode("guardrail", guardrailNode)
    .addNode("respond", respondNode)
    .addEdge(START, "load_context")
    .addEdge("load_context", "router")
    .addConditionalEdges("router", routeFromRouter, {
      generate_workout: "generate_workout",
      log_or_edit_workout: "log_or_edit_workout",
      progress_goals: "progress_goals",
      nutrition_qa: "nutrition_qa",
      general_chat: "general_chat",
      confirm_pending_action: "confirm_pending_action",
    })
    .addConditionalEdges("log_or_edit_workout", routeAfterWorkoutAction, {
      confirm_workout_action: "confirm_workout_action",
      guardrail: "guardrail",
    })
    .addEdge("generate_workout", "guardrail")
    .addEdge("confirm_workout_action", "guardrail")
    .addEdge("progress_goals", "guardrail")
    .addEdge("nutrition_qa", "guardrail")
    .addEdge("general_chat", "guardrail")
    .addEdge("confirm_pending_action", "guardrail")
    .addEdge("guardrail", "respond")
    .addEdge("respond", END);

  return graph.compile({ checkpointer });
}

export type CoachGraphV2 = ReturnType<typeof buildCoachGraphV2>;

/** Run config for one thread, with optional LangSmith metadata. */
export function graphV2Config(threadId: string, intent?: CoachIntent) {
  return {
    configurable: { thread_id: threadId },
    ...tracingRunConfig({ threadId, intent }),
  };
}

export { };
