import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Streaming failure tests.
 *
 * A provider can die after it has already emitted part of an answer. The route
 * must tell the client to discard that partial text (`reset`) and still finish
 * the response with `error` + `done` — never leave the request hanging.
 */

const state = vi.hoisted(() => ({
  tokenBeforeThrow: true,
  session: { deviceId: "dev-1" } as { deviceId: string } | null,
  error: null as Error | null,
}));

function failingGraph() {
  return {
    async *stream() {
      if (state.tokenBeforeThrow) {
        yield [
          { content: "partial answer" },
          { langgraph_node: "general_chat" },
        ];
      }
      throw state.error ?? new Error("provider failed mid-stream");
    },
    async getState() {
      return { tasks: [], values: {} };
    },
  };
}

vi.mock("@/lib/server/device", () => ({
  resolveDeviceId: () => ({ deviceId: "dev-1" }),
}));

vi.mock("@/lib/server/ai", () => ({
  AiProviderError: class AiProviderError extends Error {},
  resolveProvider: () => ({ id: "gemini", label: "Google Gemini" }),
}));

vi.mock("@/lib/server/ai/config", () => ({
  isSseEnabled: () => true,
}));

vi.mock("@/lib/server/ai/coach-session-v2", () => ({
  getCoachGraphV2: async () => failingGraph(),
  checkpointerBackend: () => "memory",
}));

vi.mock("@/lib/server/ai/graph-v2", () => ({
  graphV2Config: (threadId: string) => ({ configurable: { thread_id: threadId } }),
}));

vi.mock("@/lib/server/chat", () => ({
  getSession: async () => state.session,
}));

import { POST } from "./route";

function parseFrames(body: string): { event: string; data: string }[] {
  return body
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      return {
        event: lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "",
        data: lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "",
      };
    });
}

async function stream(threadId = "thread-1"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/coach/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, content: "hello" }),
    }),
  );
}

beforeEach(() => {
  state.tokenBeforeThrow = true;
  state.session = { deviceId: "dev-1" };
  state.error = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/coach/stream mid-stream failure", () => {
  it("emits reset before error when tokens were already sent", async () => {
    const response = await stream();
    const frames = parseFrames(await response.text());

    expect(frames.map((frame) => frame.event)).toEqual([
      "meta",
      "token",
      "reset",
      "error",
      "done",
    ]);
    expect(frames[1].data).toBe("partial answer");
    expect(JSON.parse(frames[3].data).message).toMatch(/mid-stream/);
    expect(frames[4].data).toBe("[DONE]");
  });

  it("does not emit reset when the failure happens before any token", async () => {
    state.tokenBeforeThrow = false;

    const response = await stream();
    const frames = parseFrames(await response.text());

    expect(frames.map((frame) => frame.event)).toEqual([
      "meta",
      "error",
      "done",
    ]);
  });

  it("resolves the request instead of hanging when the provider throws", async () => {
    state.error = new Error("socket hang up");

    const response = await stream();
    const body = await response.text();

    expect(body).toContain("event: done");
    expect(console.error).toHaveBeenCalledOnce();
  });
});
