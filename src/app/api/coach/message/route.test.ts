import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * All-providers-fail contract for the JSON coach endpoint.
 *
 * The user must get a clean, stable error (no upstream detail, no stack frame)
 * and the request must finish. Operators must still get the provider detail in
 * the server log.
 */

const state = vi.hoisted(() => ({
  failure: null as Error | null,
}));

vi.mock("@/lib/server/ai", () => {
  class AiProviderError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AiProviderError";
    }
  }
  return { AiProviderError };
});

vi.mock("@/lib/server/ai/coach-session", () => ({
  CoachThreadInterruptedError: class CoachThreadInterruptedError extends Error {},
}));

vi.mock("@/lib/server/chat", () => ({
  sendCoachMessage: async () => {
    throw state.failure;
  },
}));

vi.mock("@/lib/server/device", () => ({
  resolveDeviceId: () => ({ deviceId: "dev-1" }),
  deviceCookieHeaders: () => ({}),
}));

import { AiProviderError } from "@/lib/server/ai";
import { POST } from "./route";

function request(): Request {
  return new Request("http://localhost/api/coach/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId: "thread-1", content: "hello" }),
  });
}

function loggedText(): string {
  return vi
    .mocked(console.error)
    .mock.calls.map((args) =>
      args
        .map((arg) =>
          arg instanceof Error
            ? arg.message
            : typeof arg === "string"
              ? arg
              : JSON.stringify(arg),
        )
        .join(" "),
    )
    .join("\n");
}

beforeEach(() => {
  state.failure = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/coach/message when every provider fails", () => {
  it("returns a clean 503 without upstream detail", async () => {
    state.failure = new AiProviderError(
      "Gemini API error 500: upstream exploded (account=secret)",
    );

    const response = await POST(request());
    const body = (await response.json()) as { error: string };
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/all ai providers are unavailable/i);
    expect(serialized).not.toMatch(/Gemini|upstream exploded|account=secret|stack|at \w/i);
  });

  it("logs the provider detail on the server", async () => {
    state.failure = new AiProviderError(
      "Gemini API error 500: upstream exploded; DeepSeek API error 429: rate limited",
    );

    await POST(request());

    expect(console.error).toHaveBeenCalledOnce();
    const text = loggedText();
    expect(text).toMatch(/Gemini API error 500: upstream exploded/);
    expect(text).toMatch(/DeepSeek API error 429: rate limited/);
    expect(text).toMatch(/requestedProvider/);
  });

  it("still returns a clean 500 for a non-provider failure", async () => {
    state.failure = new Error("database connection refused");

    const response = await POST(request());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Something went wrong while processing your message.");
    expect(JSON.stringify(body)).not.toMatch(/database connection refused/);
    expect(loggedText()).toMatch(/database connection refused/);
  });
});
