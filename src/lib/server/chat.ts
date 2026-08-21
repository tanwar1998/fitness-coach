import { randomUUID } from "node:crypto";
import { query } from "./db";
import { resolveProvider } from "./ai";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  provider?: string;
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
  };
}

async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await query<MessageRow>(
    `SELECT id, session_id, role, content, provider, created_at
       FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows.map(toChatMessage);
}

async function getSession(sessionId: string): Promise<ChatSession | null> {
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

export async function sendMessage(
  sessionId: string,
  content: string,
  providerId: string | undefined,
  deviceId: string,
): Promise<ChatSession> {
  const session = await getSession(sessionId);
  if (!session || session.deviceId !== deviceId) {
    throw new Error(`Chat session "${sessionId}" not found.`);
  }

  const userMessageId = createId();
  await query(
    `INSERT INTO chat_messages (id, session_id, role, content)
     VALUES ($1, $2, 'user', $3)`,
    [userMessageId, sessionId, content],
  );

  if (session.messages.length === 0) {
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

  const history = [
    ...session.messages,
    { id: userMessageId, role: "user" as const, content, createdAt: Date.now() },
  ].map((message) => ({ role: message.role, content: message.content }));

  const provider = resolveProvider(providerId);
  const reply = await provider.generateReply({ messages: history });

  const assistantMessageId = createId();
  await query(
    `INSERT INTO chat_messages (id, session_id, role, content, provider)
     VALUES ($1, $2, 'assistant', $3, $4)`,
    [assistantMessageId, sessionId, reply, provider.id],
  );

  await query(
    `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );

  const refreshed = await getSession(sessionId);
  if (!refreshed) {
    throw new Error(`Chat session "${sessionId}" could not be loaded after update.`);
  }
  return refreshed;
}
