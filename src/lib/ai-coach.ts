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
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AiProviderInfo {
  id: string;
  label: string;
  configured: boolean;
}

const API_BASE = "/api/chat";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const data = await response.json();
      if (data && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // keep the generic message when the body is not JSON
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function fetchSessions(): Promise<ChatSession[]> {
  const data = await parseResponse<{ sessions: ChatSession[] }>(
    await fetch(`${API_BASE}/sessions`, { cache: "no-store" }),
  );
  return data.sessions;
}

export async function createSession(): Promise<ChatSession> {
  const data = await parseResponse<{ session: ChatSession }>(
    await fetch(`${API_BASE}/sessions`, { method: "POST" }),
  );
  return data.session;
}

export async function deleteSession(id: string): Promise<void> {
  await parseResponse(
    await fetch(`${API_BASE}/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}

export async function sendMessage(
  sessionId: string,
  content: string,
  provider?: string,
): Promise<ChatSession> {
  const data = await parseResponse<{ session: ChatSession }>(
    await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, provider }),
      },
    ),
  );
  return data.session;
}

export async function fetchProviders(): Promise<{
  providers: AiProviderInfo[];
  default: string;
}> {
  return parseResponse<{ providers: AiProviderInfo[]; default: string }>(
    await fetch(`${API_BASE}/providers`, { cache: "no-store" }),
  );
}
