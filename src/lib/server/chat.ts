import { randomUUID } from "node:crypto";
import { query } from "./db";
import { resolveProvider } from "./ai";
import {
  invokeCoachMessage,
  resumeCoachAnswer,
} from "./ai/coach-session";
import type {
  CoachConstraints,
  CoachTurnResult,
} from "@/lib/coach-types";
import type { CoachProfile } from "./ai/exercise-retrieval";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  provider?: string;
  /** Exercise-library ids the assistant reply referenced (rendered as cards). */
  referencedExerciseIds?: number[];
}

export interface ChatSession {
  id: string;
  title: string;
  deviceId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionRow {
  id: string;
  title: string;
  device_id: string;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  provider: string | null;
  referenced_exercise_ids: unknown;
  created_at: Date;
}

export function createId(): string {
  return randomUUID();
}

export function sessionTitleFromMessage(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length > 40
    ? `${cleaned.slice(0, 40).trim()}…`
    : cleaned || "New chat";
}

function toChatSession(row: SessionRow, messages: ChatMessage[]): ChatSession {
  return {
    id: row.id,
    title: row.title,
    deviceId: row.device_id,
    messages,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
    provider: row.provider ?? undefined,
    referencedExerciseIds: parseReferencedIds(row.referenced_exercise_ids),
  };
}

function parseReferencedIds(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter(
    (value): value is number => typeof value === "number" && Number.isInteger(value),
  );
  return ids.length > 0 ? ids : undefined;
}

async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await query<MessageRow>(
    `SELECT id, session_id, role, content, provider, referenced_exercise_ids, created_at
       FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows.map(toChatMessage);
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const sessionRows = await query<SessionRow>(
    `SELECT id, title, device_id, created_at, updated_at
       FROM chat_sessions
      WHERE id = $1`,
    [sessionId],
  );
  const session = sessionRows[0];
  if (!session) return null;
  return toChatSession(session, await getMessages(sessionId));
}

export async function listSessions(deviceId: string): Promise<ChatSession[]> {
  const sessionRows = await query<SessionRow>(
    `SELECT id, title, device_id, created_at, updated_at
       FROM chat_sessions
      WHERE device_id = $1
      ORDER BY updated_at DESC, created_at DESC`,
    [deviceId],
  );

  const sessions: ChatSession[] = [];
  for (const row of sessionRows) {
    sessions.push(toChatSession(row, await getMessages(row.id)));
  }
  return sessions;
}

export async function createSession(deviceId: string): Promise<ChatSession> {
  const id = createId();
  const rows = await query<SessionRow>(
    `INSERT INTO chat_sessions (id, title, device_id)
     VALUES ($1, 'New chat', $2)
     RETURNING id, title, device_id, created_at, updated_at`,
    [id, deviceId],
  );
  return toChatSession(rows[0], []);
}

export async function deleteSession(
  sessionId: string,
  deviceId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM chat_sessions WHERE id = $1 AND device_id = $2 RETURNING id`,
    [sessionId, deviceId],
  );
  return rows.length > 0;
}

function assertOwnedSession(session: ChatSession | null, deviceId: string): ChatSession {
  if (!session || session.deviceId !== deviceId) {
    throw new Error(`Chat session not found.`);
  }
  return session;
}

async function insertUserMessage(sessionId: string, content: string, isFirst: boolean) {
  const userMessageId = createId();
  await query(
    `INSERT INTO chat_messages (id, session_id, role, content)
     VALUES ($1, $2, 'user', $3)`,
    [userMessageId, sessionId, content],
  );

  if (isFirst) {
    const title = sessionTitleFromMessage(content);
    await query(
      `UPDATE chat_sessions SET title = $2, updated_at = now() WHERE id = $1`,
      [sessionId, title],
    );
  } else {
    await query(
      `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`,
      [sessionId],
    );
  }
}

async function insertAssistantTurn(
  sessionId: string,
  turn: CoachTurnResult,
  providerId: string | undefined,
) {
  const assistantMessageId = createId();
  await query(
    `INSERT INTO chat_messages (id, session_id, role, content, provider, referenced_exercise_ids)
     VALUES ($1, $2, 'assistant', $3, $4, $5::jsonb)`,
    [
      assistantMessageId,
      sessionId,
      turn.reply,
      // When the graph handed the conversation to a human coach, the reply is
      // not an AI answer, so record that instead of the provider id.
      turn.yieldedToHuman
        ? "human"
        : (providerId?.trim() || "coach"),
      JSON.stringify(turn.referencedExerciseIds),
    ],
  );

  await query(
    `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

async function refreshSession(sessionId: string): Promise<ChatSession> {
  const refreshed = await getSession(sessionId);
  if (!refreshed) {
    throw new Error(`Chat session "${sessionId}" could not be loaded after update.`);
  }
  return refreshed;
}

/**
 * Run a new user message through the coaching graph (check-in + ask-answer +
 * replan loop) and persist the resulting transcript. Mirrors the old
 * `sendMessage` contract but returns the plan-aware turn payload too.
 */
export async function sendCoachMessage(args: {
  threadId: string;
  content: string;
  providerId?: string;
  deviceId: string;
  profile?: CoachProfile;
  currentPlan?: unknown;
  constraints?: CoachConstraints;
}): Promise<{ session: ChatSession; turn: CoachTurnResult }> {
  const session = assertOwnedSession(await getSession(args.threadId), args.deviceId);
  const isFirst = session.messages.length === 0;

  const provider = resolveProvider(args.providerId);

  const { turn } = await invokeCoachMessage({
    threadId: args.threadId,
    content: args.content,
    providerId: provider.id,
    profile: args.profile ?? null,
    currentPlan: args.currentPlan,
    constraints: args.constraints,
  });

  await insertUserMessage(args.threadId, args.content, isFirst);
  if (turn.reply) {
    await insertAssistantTurn(args.threadId, turn, provider.id);
  }

  return { session: await refreshSession(args.threadId), turn };
}

/**
 * Answer the graph's pending question (check-in or ask_question/ask_options)
 * via Command({ resume }) and persist the resulting Q&A turn.
 */
export async function sendCoachAnswer(args: {
  threadId: string;
  answer: string;
  providerId?: string;
  deviceId: string;
}): Promise<{ session: ChatSession; turn: CoachTurnResult }> {
  assertOwnedSession(await getSession(args.threadId), args.deviceId);

  const provider = resolveProvider(args.providerId);

  const { turn } = await resumeCoachAnswer({
    threadId: args.threadId,
    answer: args.answer,
    providerId: provider.id,
  });

  await insertUserMessage(args.threadId, args.answer, false);
  if (turn.reply) {
    await insertAssistantTurn(args.threadId, turn, provider.id);
  }

  return { session: await refreshSession(args.threadId), turn };
}

/**
 * Legacy single-shot message flow retained for existing consumers. Runs the
 * exact same plan-aware graph as sendCoachMessage but returns only the session.
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  providerId: string | undefined,
  deviceId: string,
): Promise<ChatSession> {
  const { session } = await sendCoachMessage({
    threadId: sessionId,
    content,
    providerId,
    deviceId,
  });
  return session;
}