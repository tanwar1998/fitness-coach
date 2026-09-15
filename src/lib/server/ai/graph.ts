import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  Annotation,
  END,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import {
  formatRetrievedExercises,
  retrieveExercises,
  type CoachProfile,
  type RetrievedExercise,
} from "./exercise-retrieval";
import { extractJson } from "./parse-json";
import { SYSTEM_PROMPT } from "./system-prompt";
import {
  adjustPlanForConstraints,
  answerIsYes,
  buildConstraintsQuery,
  normalizeEnergy,
  parseTimeMinutes,
  planNeedsAdjustment,
  plansEqual,
  workoutPlanSchema,
} from "./plan";
import type { CoachConstraints, CoachQuestion, WorkoutPlan } from "@/lib/coach-types";
import { AiProviderError, type AiMessage } from "./types";

/**
 * The structured output the coach node produces. Models are instructed (see
 * SYSTEM_PROMPT) to reply with this JSON envelope so the graph can recover the
 * plain-text reply, the action to take next, and pointers to the retrieved
 * exercises it actually used.
 */
export interface CoachTurn {
  reply: string;
  referenced_exercise_ids: number[];
  action?: "ask_question" | "ask_options" | "finish";
  options?: string[];
}

/**
 * The LangGraph state shared by the coaching graph. Messages use LangChain's
 * standard `BaseMessage` objects; the app's lightweight `{ role, content }`
 * shape is converted at the boundary by the services that persist chat rows.
 */
const CoachState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  providerId: Annotation<string>(),
  retrievedExercises: Annotation<RetrievedExercise[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  referencedExerciseIds: Annotation<number[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  profile: Annotation<CoachProfile | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** The current day's workout plan, seeded from the client when available. */
  currentPlan: Annotation<WorkoutPlan | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Signals collected during the daily check-in. */
  constraints: Annotation<CoachConstraints>({
    reducer: (_left, right) => right,
  }),
  checkedIn: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  /** True once a replan attempt has been made, so constraints don't
   *  re-trigger the adjustment on every later message. */
  replanApplied: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  /** Set by coachNode when it wants to ask the user something; consumed by
   *  humanNode via interrupt(). */
  pendingQuestion: Annotation<CoachQuestion | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Set by replanNode; coachNode must surface it before continuing. */
  pendingPlanAnnouncement: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  /** Final assistant text produced by the graph. */
  output: Annotation<string>(),
  requiresHuman: Annotation<boolean>(),
});

type CoachStateType = typeof CoachState.State;

/** Provider implementations register their chat-model adapters here. */
let modelForProvider:
  | ((providerId: string) => {
      invoke(input: BaseMessage[]): Promise<string>;
      displayName: string;
    })
  | null = null;

export interface CoachModel {
  invoke(messages: BaseMessage[]): Promise<string>;
  displayName: string;
}

export function registerCoachModel(
  resolver: (providerId: string) => CoachModel,
): void {
  modelForProvider = resolver;
}

export function resolveCoachModel(providerId: string): CoachModel {
  if (!modelForProvider) {
    throw new AiProviderError(
      "The LangGraph coaching graph has no registered chat model. This is a server configuration error; no AI provider likely had its key configured in time.",
    );
  }
  return modelForProvider(providerId);
}

/**
 * Deterministic safety gate. Because the app's providers are plain REST chat
 * adapters that return a single string (they cannot emit tool calls), we detect
 * out-of-scope topics here so the human hand-off path actually fires.
 */
const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  /(see|visit|call|go to|need to see) (a |the |my )?(doctor|physio|physiotherapist|er|emergency|hospital|gp|specialist)/i,
  /(is|was) it (serious|normal|safe)\b/i,
  /(could|couldn't|might|may) be (a )?(fractur|broken|injur)/i,
  /(feels?|is) (broken|sprained|fractured|dislocated)/i,
  /(chest pain|shortness of breath|difficulty breathing|can.t breathe)\b/i,
  /(seizure|passing out|blacked out|fainted?|overdos|poisoning|suicid)\b/i,
  /(numb|tingling|can.t move|unable to move|severe pain|sharp pain|worst pain)\b/i,
  /(my|the) (shoulder|knee|back|ankle|wrist|neck|elbow|hip) (hurts?|is painful|is swollen|is numb)\b/i,
  /(diagnos|prescri|medication|drug interaction)\b/i,
];

function requiresHumanReview(messages: AiMessage[]): boolean {
  const text = messages.map((message) => message.content).join("\n");
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text));
}

function toAiMessage(message: BaseMessage): AiMessage {
  return {
    role: message._getType() === "ai" ? "assistant" : "user",
    content:
      typeof message.content === "string" ? message.content : String(message.content),
  };
}

/**
 * Retrieval-augmented generation step. Builds a query from the latest user
 * message plus known profile info and writes the top matches to state so the
 * coach node is grounded in real exercises. Best-effort: if the index is
 * missing or embeddings fail, the coach still answers (un-grounded).
 */
async function retrieveExercisesNode(
  state: CoachStateType,
): Promise<Partial<CoachStateType>> {
  const userMessages = state.messages.filter(
    (message) => message._getType() === "human",
  );
  const latestUserMessage =
    userMessages.length > 0 ? toAiMessage(userMessages[userMessages.length - 1]).content : "";

  try {
    const retrieved = await retrieveExercises(latestUserMessage, {
      topK: 6,
      profile: state.profile ?? undefined,
    });
    return { retrievedExercises: retrieved };
  } catch (error) {
    console.error("Exercise retrieval failed; continuing un-grounded:", error);
    return { retrievedExercises: [] };
  }
}

/**
 * Daily check-in, once per session (guarded by checkedIn). Uses the same
 * interrupt-based question mechanism as coachNode's ask_question/ask_options,
 * so the whole flow survives server restarts via the checkpointer. Runs with
 * no side effects before its first interrupt, so replay on resume is safe.
 */
async function checkInNode(
  state: CoachStateType,
): Promise<Partial<CoachStateType>> {
  if (state.checkedIn === true) {
    return { checkedIn: true };
  }

  const energyAnswer = await interrupt({
    action: "ask_options",
    question: "How's your energy today?",
    options: ["low", "normal", "high"],
  });

  const painAnswer = await interrupt({
    action: "ask_options",
    question: "Does anything hurt today?",
    options: ["yes", "no"],
  });

  const painFlag = answerIsYes(painAnswer);
  let painNote: string | null = null;
  if (painFlag) {
    const note = await interrupt({
      action: "ask_question",
      question: "Where does it hurt? Give me a quick note on the area and how it feels.",
    });
    painNote = String(note ?? "").trim() || null;
  }

  const timeAnswer = await interrupt({
    action: "ask_question",
    question:
      'About how much time do you have for your workout today? (e.g. "30 min", or "as usual")',
  });

  return {
    checkedIn: true,
    constraints: {
      energy: normalizeEnergy(energyAnswer),
      painFlag,
      painNote,
      timeAvailableMin: parseTimeMinutes(timeAnswer),
    },
  };
}

const REPLAN_PROMPT = `You are FitPulse's plan-adjustment step. Today's workout plan must be updated based on the user's check-in, but this is a TARGETED EDIT — keep every exercise that is still fine, and only change what the constraints require. This is NOT a full plan regeneration.

You receive JSON context with "currentPlan" and "constraints", plus a list called "Low-impact alternatives from the exercise library" to choose replacements from.

Rules:
- Keep each unaffected exercise exactly as-is (same exerciseId, name, sets, reps, notes).
- Low energy -> reduce sets or drop the hardest exercise(s).
- Pain/soreness -> swap the offending exercise(s) for a low-impact alternative from the alternatives list that avoids the affected area (e.g. Back Squat -> Leg Press for knee soreness).
- Reduced time -> drop trailing exercises or reduce volume so the plan fits the available minutes (assume roughly 3 minutes per working set).
- Any new exerciseId you introduce MUST come from the alternatives list, matched to its exact id and name. Never invent ids.
- "date" stays the same as currentPlan.

Reply with ONLY one JSON object (no markdown, no code fences, no surrounding text):
{
  "date": "<same date as currentPlan>",
  "items": [
    { "exerciseId": 0, "name": "...", "sets": 3, "reps": "8-12", "notes": "..." }
  ],
  "adjustedReason": "Short, specific explanation, e.g. 'Swapped back squat for leg press — you flagged knee soreness.'"
}

The "adjustedReason" field is REQUIRED and must be non-empty and specific. Never leave it blank.`;

/**
 * Validate a model-produced revised plan: keep the original date, require a
 * specific adjustedReason, and reject invented exercise ids. Returns null when
 * the output is unusable (the caller then falls back deterministically).
 */
function validateRevisedPlan(
  plan: WorkoutPlan,
  revised: WorkoutPlan,
  alternatives: RetrievedExercise[],
): WorkoutPlan | null {
  const reason = revised.adjustedReason?.trim();
  if (!reason) return null;

  const allowedIds = new Set(alternatives.map((exercise) => exercise.id));
  const carryoverIds = new Set(plan.items.map((item) => item.exerciseId));

  const plausible = revised.items.every(
    (item) =>
      item.exerciseId === 0 ||
      allowedIds.has(item.exerciseId) ||
      carryoverIds.has(item.exerciseId),
  );
  if (!plausible) return null;

  return { ...revised, date: plan.date, adjustedReason: reason };
}

/**
 * Replan step: runs only when planNeedsAdjustment says today's constraints
 * warrant it. Re-queries the exercise library with a constraints-built query,
 * asks the model for a targeted edit (structured-output emulation, since the
 * providers are plain-REST adapters), and never lets an unexplained replan
 * through — a deterministic scaling fallback covers model failures.
 */
async function replanNode(
  state: CoachStateType,
): Promise<Partial<CoachStateType>> {
  const plan = state.currentPlan;
  if (!plan || !planNeedsAdjustment(plan, state.constraints)) {
    return { replanApplied: true };
  }

  const providerId = state.providerId || "gemini";
  const model = resolveCoachModel(providerId);

  let alternatives: RetrievedExercise[] = [];
  try {
    alternatives = await retrieveExercises(
      buildConstraintsQuery(state.constraints, plan),
      { topK: 6, profile: state.profile ?? undefined },
    );
  } catch (error) {
    console.error(
      "Replan retrieval failed; scaling from the in-context library instead:",
      error,
    );
    alternatives = state.retrievedExercises ?? [];
  }

  const messages: BaseMessage[] = [
    new SystemMessage(REPLAN_PROMPT),
    new SystemMessage(
      alternatives.length > 0
        ? `Low-impact alternatives from the exercise library:\n${formatRetrievedExercises(
            alternatives,
          )}`
        : "No low-impact alternatives are retrievable right now — scale volume only.",
    ),
    new HumanMessage(
      JSON.stringify({ currentPlan: plan, constraints: state.constraints }, null, 2),
    ),
  ];

  let revised: WorkoutPlan | null = null;
  try {
    const raw = await model.invoke(messages);
    const parsed = workoutPlanSchema.safeParse(extractJson<WorkoutPlan>(raw));
    if (parsed.success) {
      revised = validateRevisedPlan(plan, parsed.data, alternatives);
    }
  } catch (error) {
    console.error("Replan model call failed; using the deterministic fallback:", error);
  }

  const next = revised ?? adjustPlanForConstraints(plan, state.constraints);

  // Never write an unexplained or no-op replan: leave currentPlan untouched and
  // just mark the attempt as done so constraints don't re-trigger it.
  if (!next.adjustedReason?.trim() || plansEqual(plan, next)) {
    return { replanApplied: true };
  }

  return {
    replanApplied: true,
    currentPlan: next,
    pendingPlanAnnouncement: next.adjustedReason,
    retrievedExercises: alternatives,
  };
}

async function agentNode(
  state: CoachStateType,
): Promise<Partial<CoachStateType>> {
  const providerId = state.providerId || "gemini";
  const model = resolveCoachModel(providerId);

  const historyMessages = state.messages.filter(
    (message) => message._getType() !== "system",
  );

  // Gate on the latest incoming turn (the message the user just sent), so a
  // past out-of-scope query that was already handed to a human doesn't keep
  // re-triggering the hand-off on every follow-up.
  const lastMessage = historyMessages[historyMessages.length - 1];
  if (
    lastMessage &&
    lastMessage._getType() === "human" &&
    requiresHumanReview([toAiMessage(lastMessage)])
  ) {
    return {
      requiresHuman: true,
      pendingQuestion: null,
      pendingPlanAnnouncement: null,
    };
  }

  const messages: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];

  // Ground the coach in the exercises retrieved for this turn, formatted
  // compactly (name — category — primary muscles — one-line description).
  const retrievedExercises = state.retrievedExercises ?? [];
  if (retrievedExercises.length > 0) {
    messages.push(
      new SystemMessage(
        `Retrieved exercise library for this turn:\n${formatRetrievedExercises(
          retrievedExercises,
        )}`,
      ),
    );
  }

  // Right after a replan, the coach must explicitly surface why the plan
  // changed before it continues the conversation.
  if (state.pendingPlanAnnouncement) {
    messages.push(
      new SystemMessage(
        `The user's workout plan for today was JUST updated. Lead your reply by clearly telling the user this exact reason, in your own words:\n"${state.pendingPlanAnnouncement}"\nThen continue with your normal coaching answer.`,
      ),
    );
  }

  if (state.currentPlan) {
    messages.push(
      new SystemMessage(
        `Today's workout plan:\n${JSON.stringify(state.currentPlan.items, null, 2)}`,
      ),
    );
  }

  messages.push(
    new SystemMessage(
      `Today's constraints:\n${JSON.stringify(state.constraints)}`,
    ),
  );

  messages.push(...historyMessages, new HumanMessage(`(provider: ${model.displayName})`));

  const content = await model.invoke(messages);

  const trimmed = content.trim();
  if (!trimmed) {
    throw new AiProviderError(`${model.displayName} returned an empty response.`);
  }

  return parseCoachTurn(trimmed, retrievedExercises, model.displayName);
}

/**
 * Unwrap the model's JSON envelope; fall back to raw text when parsing fails.
 * ask_question / ask_options turn into a pendingQuestion that routes the graph
 * to the interrupting human node and surfaces the same question to the UI.
 */
function parseCoachTurn(
  raw: string,
  retrievedExercises: RetrievedExercise[],
  providerLabel: string,
): Pick<
  CoachStateType,
  | "messages"
  | "output"
  | "referencedExerciseIds"
  | "pendingQuestion"
  | "pendingPlanAnnouncement"
  | "requiresHuman"
> {
  const parsed = extractJson<CoachTurn>(raw);
  const reply = (parsed?.reply ?? "").trim();
  const content = reply || raw;

  const action =
    parsed?.action === "ask_question" || parsed?.action === "ask_options"
      ? parsed.action
      : "finish";
  const options = Array.isArray(parsed?.options)
    ? parsed.options.filter(
        (option): option is string =>
          typeof option === "string" && option.trim().length > 0,
      )
    : [];

  let referencedExerciseIds = Array.isArray(parsed?.referenced_exercise_ids)
    ? parsed.referenced_exercise_ids
    : [];

  // Only keep ids the coach could genuinely point at — everything else is a
  // hallucination and would produce dead exercise cards in the UI.
  const validIds = new Set(retrievedExercises.map((exercise) => exercise.id));
  referencedExerciseIds = referencedExerciseIds.filter((id) => validIds.has(id));

  if (!reply && parsed) {
    console.warn(
      `[${providerLabel}] replied with a JSON envelope missing a non-empty "reply"; falling back to raw text.`,
    );
  }

  return {
    messages: [new AIMessage({ content })],
    output: content,
    referencedExerciseIds,
    pendingQuestion:
      action === "finish"
        ? null
        : { action, question: content, options },
    pendingPlanAnnouncement: null,
    requiresHuman: false,
  };
}

async function fallbackNode(state: CoachStateType): Promise<Partial<CoachStateType>> {
  const reply =
    state.requiresHuman === true
      ? `That’s beyond what I can safely coach you on. I’ve flagged your message for a human coach — please get in touch with a qualified professional (a doctor, physiotherapist, or licensed dietitian) before continuing.`
      : `I couldn’t finish a safe answer to that. Please rephrase your question, and if this is about an injury or a medical condition, reach out to a qualified professional.`;
  return {
    messages: [new AIMessage({ content: reply })],
    output: reply,
    requiresHuman: false,
  };
}

/**
 * Route after the daily check-in: only touches the plan when today's signals
 * warrant it (and only once per session). Otherwise the coach talks directly.
 */
function routeAfterCheckin(state: CoachStateType): "replan" | "coach" {
  if (
    state.replanApplied !== true &&
    planNeedsAdjustment(state.currentPlan, state.constraints)
  ) {
    return "replan";
  }
  return "coach";
}

/**
 * Route after the coach superstep:
 * - requires a human reviewer (safety gate) -> fallback
 * - else when the coach asked a question -> human (interrupt loop)
 * - otherwise -> END (final reply is in state.output)
 */
function routeAfterCoach(state: CoachStateType): string {
  if (state.requiresHuman === true) {
    return "fallback";
  }
  if (state.pendingQuestion != null) {
    return "human";
  }
  return END;
}

/**
 * The shared LangGraph workflow behind the AI Coach. Every provider runs
 * through the same graph; the loop is:
 *
 *   START → retrieve_exercises → checkin → routeAfterCheckin
 *       → [ replan → coach | coach ] → routeAfterCoach
 *       → [ human (interrupt) → coach | fallback | END ]
 *
 * The graph must be compiled with a checkpointer (PostgresSaver in production)
 * so interrupt pauses survive restarts and resuming works via Command({ resume }).
 */
export function buildCoachGraph(checkpointer?: BaseCheckpointSaver) {
  const graph = new StateGraph(CoachState)
    .addNode("retrieve_exercises", retrieveExercisesNode)
    .addNode("checkin", checkInNode)
    .addNode("replan", replanNode)
    .addNode("coach", agentNode)
    .addNode("human", humanNode)
    .addNode("fallback", fallbackNode)
    .addEdge(START, "retrieve_exercises")
    .addEdge("retrieve_exercises", "checkin")
    .addConditionalEdges("checkin", routeAfterCheckin, {
      replan: "replan",
      coach: "coach",
    })
    .addEdge("replan", "coach")
    .addConditionalEdges("coach", routeAfterCoach, {
      human: "human",
      fallback: "fallback",
      [END]: END,
    })
    .addEdge("human", "coach")
    .addEdge("fallback", END);

  return graph.compile({ checkpointer });
}

async function humanNode(state: CoachStateType): Promise<Partial<CoachStateType>> {
  const pending = state.pendingQuestion ?? {
    action: "ask_question" as const,
    question: "What would you like to do next?",
    options: [],
  };
  const answer = await interrupt(pending);
  const text = String(answer ?? "").trim();
  return { messages: [new HumanMessage(text || "(no reply)")] };
}

/**
 * Ensure a provider→model resolver is registered exactly once before the first
 * run. Imported dynamically to avoid a module-load-time circular dependency
 * (the resolver imports the provider registry, which lives next to the graph).
 */
let modelResolutionPromise: Promise<void> | null = null;
export async function ensureCoachModelRegistered(): Promise<void> {
  if (modelForProvider) return;
  if (!modelResolutionPromise) {
    modelResolutionPromise = import("./multiplexed-model")
      .then(({ registerCoachModelResolver }) => registerCoachModelResolver())
      .then(() => undefined)
      .catch((error) => {
        modelResolutionPromise = null;
        throw error;
      });
  }
  await modelResolutionPromise;
}