import { HumanMessage } from "@langchain/core/messages";
import { Command, MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { buildCoachGraphV2, graphV2Config, type CoachGraphV2 } from "./graph-v2";
import { getPostgresSaver } from "./checkpointer";
import { wantsPostgresCheckpointer } from "./config";
import {
  CoachNoPendingQuestionError,
  CoachThreadInterruptedError,
} from "./coach-session";
import { plansEqual } from "./plan";
import type {
  CoachAction,
  CoachConstraints,
  CoachTurnResult,
  WorkoutPlan,
} from "@/lib/coach-types";

/**
 * Runtime wrapper around the v2 graph. It exposes the SAME result shape
 * (`CoachTurnResult`) as the legacy coach-session module, so the existing
 * /api/coach/message and /api/coach/answer handlers keep their contract.
 */

let compiledGraph: Promise<CoachGraphV2> | null = null;
let checkpointerKind: "postgres" | "memory" = "memory";

async function resolveCheckpointer(): Promise<BaseCheckpointSaver | undefined> {
  if (!wantsPostgresCheckpointer()) {
    checkpointerKind = "memory";
    return new MemorySaver();
  }
  try {
    checkpointerKind = "postgres";
    return await getPostgresSaver();
  } catch (error) {
    console.error(
      "Postgres checkpointer unavailable for the v2 coach graph; falling back to in-memory (interrupts will not survive a restart):",
      error,
    );
    checkpointerKind = "memory";
    return new MemorySaver();
  }
}

export async function getCoachGraphV2(): Promise<CoachGraphV2> {
  if (!compiledGraph) {
    compiledGraph = resolveCheckpointer()
      .then((saver) => buildCoachGraphV2(saver))
      .catch((error) => {
        compiledGraph = null;
        throw error;
      });
  }
  return compiledGraph;
}

export function checkpointerBackend(): "postgres" | "memory" {
  return checkpointerKind;
}

interface PendingQuestion {
  action: "ask_question" | "ask_options";
  question: string;
  options: string[];
}

function toPendingQuestion(value: unknown): PendingQuestion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PendingQuestion>;
  if (typeof candidate.question !== "string" || !candidate.question.trim()) {
    return null;
  }
  const action =
    candidate.action === "ask_options" ? "ask_options" : "ask_question";
  const options = Array.isArray(candidate.options)
    ? candidate.options.filter((o): o is string => typeof o === "string")
    : [];
  return { action, question: candidate.question.trim(), options };
}

interface ThreadState {
  exists: boolean;
  values: Record<string, unknown>;
  interrupted: boolean;
  pendingQuestion: PendingQuestion | null;
}

async function readState(
  graph: CoachGraphV2,
  threadId: string,
): Promise<ThreadState> {
  const snapshot = await graph.getState(graphV2Config(threadId));
  const values = (snapshot?.values ?? {}) as Record<string, unknown>;
  const next = (snapshot?.next ?? []) as unknown[];
  const tasks = (snapshot?.tasks ?? []) as { interrupts?: { value?: unknown }[] }[];
  const pendingQuestion = toPendingQuestion(tasks[0]?.interrupts?.[0]?.value);

  return {
    exists: Object.keys(values).length > 0 || next.length > 0,
    values,
    interrupted: pendingQuestion != null,
    pendingQuestion,
  };
}

function toTurn(
  threadId: string,
  state: ThreadState,
  planBefore: WorkoutPlan | null = null,
): CoachTurnResult {
  const pending = state.pendingQuestion;
  const output = typeof state.values.output === "string" ? state.values.output : "";
  const intent = typeof state.values.intent === "string" ? state.values.intent : null;
  const currentPlan = (state.values.currentPlan as WorkoutPlan | null) ?? null;

  // A graph interrupt (write confirmation) always wins over whatever the
  // conversational node suggested.
  const suggestedAction: CoachAction =
    state.values.answerAction === "ask_question" ||
    state.values.answerAction === "ask_options"
      ? state.values.answerAction
      : "finish";
  const suggestedOptions = Array.isArray(state.values.answerOptions)
    ? (state.values.answerOptions as unknown[]).filter(
        (option): option is string => typeof option === "string",
      )
    : [];

  const action: CoachAction =
    state.interrupted && pending ? pending.action : suggestedAction;
  const question = state.interrupted
    ? (pending?.question ?? null)
    : action === "finish"
      ? null
      : output;
  const options =
    state.interrupted && pending
      ? pending.options
      : action === "ask_options"
        ? suggestedOptions
        : [];

  return {
    threadId,
    // While paused, the assistant bubble is the confirmation question.
    reply: state.interrupted ? (pending?.question ?? "") : output,
    action,
    question,
    options,
    referencedExerciseIds: [],
    currentPlan,
    // The v2 nodes do not rewrite the saved plan yet, so this only ever flips
    // when a plan was seeded/changed elsewhere.
    planChanged:
      planBefore != null && currentPlan != null && !plansEqual(planBefore, currentPlan),
    interrupted: state.interrupted,
    yieldedToHuman: state.values.requiresHuman === true,
    ...(intent ? { intent } : {}),
  };
}

/**
 * Extend the legacy error classes so the existing API route handlers (which
 * map those classes to 409 responses) keep working when the v2 graph is on.
 * isinstance checks are used by the routes, so inheritance is the contract.
 */
export class CoachThreadInterruptedErrorV2 extends CoachThreadInterruptedError {
  constructor(threadId: string) {
    super(threadId);
    this.name = "CoachThreadInterruptedErrorV2";
  }
}

export class CoachNoPendingQuestionErrorV2 extends CoachNoPendingQuestionError {
  constructor(threadId: string) {
    super(threadId);
    this.name = "CoachNoPendingQuestionErrorV2";
  }
}

export interface InvokeV2Input {
  threadId: string;
  content: string;
  userId: string;
  providerId?: string;
  profile?: unknown;
  currentPlan?: unknown;
  constraints?: CoachConstraints;
}

/** Run one user message through the v2 graph, persisting to the checkpointer. */
export async function invokeCoachMessageV2(
  input: InvokeV2Input,
): Promise<CoachTurnResult> {
  const graph = await getCoachGraphV2();
  const before = await readState(graph, input.threadId);
  if (before.interrupted) {
    throw new CoachThreadInterruptedErrorV2(input.threadId);
  }

  const storedPlan = (before.values.currentPlan as WorkoutPlan | null) ?? null;
  // Like the legacy path, seed the plan/constraints only on the first turn so a
  // stale client copy can never overwrite the thread's live plan.
  const planBefore = before.exists
    ? storedPlan
    : ((input.currentPlan as WorkoutPlan | null) ?? storedPlan);

  const graphInput: Record<string, unknown> = {
    messages: [new HumanMessage(input.content)],
    userId: input.userId,
    providerId: input.providerId ?? "",
    profile: input.profile ?? null,
  };
  if (!before.exists) {
    graphInput.currentPlan = planBefore;
    graphInput.constraints = input.constraints ?? null;
  }

  await graph.invoke(graphInput, graphV2Config(input.threadId));

  return toTurn(
    input.threadId,
    await readState(graph, input.threadId),
    planBefore,
  );
}

/** Resume a thread paused on interrupt() with the user's answer. */
export async function resumeCoachAnswerV2(input: {
  threadId: string;
  answer: string;
  userId: string;
  providerId?: string;
}): Promise<CoachTurnResult> {
  const graph = await getCoachGraphV2();
  const before = await readState(graph, input.threadId);

  if (!before.interrupted) {
    throw new CoachNoPendingQuestionErrorV2(input.threadId);
  }

  const planBefore = (before.values.currentPlan as WorkoutPlan | null) ?? null;

  await graph.invoke(
    new Command({ resume: input.answer }),
    graphV2Config(input.threadId),
  );

  return toTurn(
    input.threadId,
    await readState(graph, input.threadId),
    planBefore,
  );
}

/** Reset the compiled graph (tests / hot reload). */
export function resetCoachGraphV2(): void {
  compiledGraph = null;
  checkpointerKind = "memory";
}
