import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import {
  buildCoachGraph,
  ensureCoachModelRegistered,
} from "./graph";
import { getPostgresSaver } from "./checkpointer";
import {
  canonicalizePlan,
  DEFAULT_CONSTRAINTS,
  plansEqual,
} from "./plan";
import type { CoachConstraints, CoachQuestion, WorkoutPlan, CoachTurnResult } from "@/lib/coach-types";

/**
 * DB-free orchestration of the coaching graph: starts a thread, resumes an
 * interrupted one, and normalizes the result. Chat persistence (`chat_sessions`
 * / `chat_messages`) lives in `src/lib/server/chat.ts`, which calls this module.
 */

export class CoachThreadInterruptedError extends Error {
  constructor(threadId: string) {
    super(
      `Coach thread "${threadId}" is paused waiting for an answer. Resume it with POST /api/coach/answer instead.`,
    );
    this.name = "CoachThreadInterruptedError";
  }
}

export class CoachNoPendingQuestionError extends Error {
  constructor(threadId: string) {
    super(`Coach thread "${threadId}" has no pending question to answer.`);
    this.name = "CoachNoPendingQuestionError";
  }
}

export class CoachThreadMissingError extends Error {
  constructor(threadId: string) {
    super(`Coach thread "${threadId}" does not exist yet. Start it with POST /api/coach/message.`);
    this.name = "CoachThreadMissingError";
  }
}

interface ThreadState {
  exists: boolean;
  values: Record<string, unknown>;
  interrupted: boolean;
  pendingQuestion: CoachQuestion | null;
}

function toCoachQuestion(value: unknown): CoachQuestion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CoachQuestion>;
  if (typeof candidate.question !== "string" || !candidate.question.trim()) {
    return null;
  }
  const action =
    candidate.action === "ask_question" || candidate.action === "ask_options"
      ? candidate.action
      : "ask_question";
  const options = Array.isArray(candidate.options)
    ? candidate.options.filter(
        (option): option is string => typeof option === "string",
      )
    : [];
  return { action, question: candidate.question.trim(), options };
}

async function readThreadState(
  graph: ReturnType<typeof buildCoachGraph>,
  config: { configurable: { thread_id: string } },
): Promise<ThreadState> {
  let checkpoint;
  try {
    checkpoint = await graph.getState(config);
  } catch {
    return { exists: false, values: {}, interrupted: false, pendingQuestion: null };
  }

  const values = (checkpoint?.values ?? {}) as Record<string, unknown>;
  const next = (checkpoint?.next ?? []) as unknown[];
  const tasks = (checkpoint?.tasks ?? []) as {
    interrupts?: { value?: unknown }[];
  }[];
  const pendingQuestion = toCoachQuestion(tasks[0]?.interrupts?.[0]?.value);

  return {
    exists: Object.keys(values).length > 0 || next.length > 0,
    values,
    interrupted: pendingQuestion != null,
    pendingQuestion,
  };
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is number =>
      typeof entry === "number" && Number.isInteger(entry),
  );
}

function buildTurnResult(
  threadId: string,
  after: ThreadState,
  planBefore: WorkoutPlan | null,
): CoachTurnResult {
  const pending = after.pendingQuestion;
  const interrupted = after.interrupted;
  const currentPlan =
    after.values.currentPlan != null
      ? (after.values.currentPlan as WorkoutPlan)
      : null;

  const reply = interrupted
    ? pending?.question ?? ""
    : typeof after.values.output === "string"
      ? after.values.output
      : "";

  const planChanged =
    planBefore != null && currentPlan != null && !plansEqual(planBefore, currentPlan);

  return {
    threadId,
    reply,
    action: interrupted && pending ? pending.action : "finish",
    question: pending?.question ?? null,
    options: pending?.options ?? [],
    referencedExerciseIds: toNumberArray(after.values.referencedExerciseIds),
    currentPlan,
    planChanged,
    interrupted,
    yieldedToHuman: after.values.yieldedToHuman === true,
  };
}

/** Local (server-timezone) date as YYYY-MM-DD, used to stamp seeded plans. */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

let compiledWithSaver: Promise<ReturnType<typeof buildCoachGraph>> | null = null;

/** The production graph, compiled once with the Postgres checkpointer. */
export async function getCoachGraph(): Promise<ReturnType<typeof buildCoachGraph>> {
  if (!compiledWithSaver) {
    compiledWithSaver = createGraphWithPostgresSaver().catch((error) => {
      compiledWithSaver = null;
      throw error;
    });
  }
  return compiledWithSaver;
}

async function createGraphWithPostgresSaver() {
  const saver: BaseCheckpointSaver = await getPostgresSaver();
  return buildCoachGraph(saver);
}

export interface InvokeCoachMessageInput {
  threadId: string;
  content: string;
  providerId?: string;
  profile?: { goal?: string; equipment?: string[]; targetMuscle?: string } | null;
  currentPlan?: unknown;
  constraints?: CoachConstraints;
}

export interface SendCoachMessageResult {
  turn: CoachTurnResult;
  threadState: ThreadState;
}

/**
 * Run the graph for a new user message. Seeding (currentPlan / constraints)
 * only applies when the thread does not exist yet, so replan results on a live
 * thread are never clobbered by a stale client copy.
 */
export async function invokeCoachMessage(
  input: InvokeCoachMessageInput,
): Promise<SendCoachMessageResult> {
  await ensureCoachModelRegistered();
  const graph = await getCoachGraph();
  const config = { configurable: { thread_id: input.threadId } };

  const before = await readThreadState(graph, config);
  if (before.interrupted) {
    throw new CoachThreadInterruptedError(input.threadId);
  }

  const seedPlan = canonicalizePlan(input.currentPlan, localDateString());
  const planBefore =
    before.exists
      ? (before.values.currentPlan as WorkoutPlan | null) ?? null
      : seedPlan;

  const graphInput: Record<string, unknown> = {
    messages: [new HumanMessage(input.content)],
    providerId: input.providerId?.trim() ?? "",
    profile: input.profile ?? null,
  };
  if (!before.exists) {
    graphInput.currentPlan = planBefore;
    graphInput.constraints = input.constraints ?? DEFAULT_CONSTRAINTS;
  }

  await graph.invoke(graphInput, config);

  const after = await readThreadState(graph, config);
  return { turn: buildTurnResult(input.threadId, after, planBefore), threadState: after };
}

/**
 * Resume an interrupted thread with the user's answer, driving the loop forward
 * (check-in answers, ask_question/ask_options replies) via Command({ resume }).
 */
export async function resumeCoachAnswer(
  input: { threadId: string; answer: string; providerId?: string },
): Promise<SendCoachMessageResult> {
  await ensureCoachModelRegistered();
  const graph = await getCoachGraph();
  const config = { configurable: { thread_id: input.threadId } };

  const before = await readThreadState(graph, config);
  if (!before.exists) {
    throw new CoachThreadMissingError(input.threadId);
  }
  if (!before.interrupted) {
    throw new CoachNoPendingQuestionError(input.threadId);
  }

  const planBefore = (before.values.currentPlan as WorkoutPlan | null) ?? null;

  await graph.invoke(new Command({ resume: input.answer }), config);

  const after = await readThreadState(graph, config);
  return { turn: buildTurnResult(input.threadId, after, planBefore), threadState: after };
}