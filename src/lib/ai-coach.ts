import type { CoachTurnResult, WorkoutPlan } from "@/lib/coach-types";
import type { GeneratedWorkout } from "@/lib/workout-generator";

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

export class ApiCallError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiCallError";
    this.status = status;
  }
}

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
    throw new ApiCallError(message, response.status);
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

/**
 * Convert a generated workout into the plan payload the coach can seed from.
 * wger exercise ids survive, curated ("ex-…") ids are omitted and the server
 * resolves them by name.
 */
export function workoutToPlanInput(workout: GeneratedWorkout): WorkoutPlan {
  return {
    date: workout.createdAt.slice(0, 10),
    adjustedReason: null,
    items: workout.exercises.map((exercise) => ({
      exerciseId: /^\d+$/.test(exercise.exerciseId.trim())
        ? Number(exercise.exerciseId)
        : 0,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      notes: [
        exercise.restSeconds ? `${exercise.restSeconds}s rest` : "",
        exercise.targetLoadPercent
          ? `${exercise.targetLoadPercent}% 1RM load`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  };
}

/**
 * Run a message through the plan-aware coach loop
 * (POST /api/coach/message). Seeding the current plan only matters on a
 * thread's first message — the server ignores it afterwards.
 */
export async function sendCoachMessage(
  sessionId: string,
  content: string,
  opts?: {
    provider?: string;
    currentPlan?: unknown;
    constraints?: unknown;
  },
): Promise<{ session: ChatSession; turn: CoachTurnResult }> {
  return parseResponse<{ session: ChatSession; turn: CoachTurnResult }>(
    await fetch("/api/coach/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: sessionId,
        content,
        provider: opts?.provider,
        currentPlan: opts?.currentPlan,
        constraints: opts?.constraints,
      }),
    }),
  );
}

/**
 * Answer the coach's pending question (check-in or ask_question/ask_options)
 * via POST /api/coach/answer. Each resume consumes one pending question.
 */
export async function sendCoachAnswer(
  sessionId: string,
  answer: string,
  opts?: { provider?: string },
): Promise<{ session: ChatSession; turn: CoachTurnResult }> {
  return parseResponse<{ session: ChatSession; turn: CoachTurnResult }>(
    await fetch("/api/coach/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: sessionId,
        answer,
        provider: opts?.provider,
      }),
    }),
  );
}
