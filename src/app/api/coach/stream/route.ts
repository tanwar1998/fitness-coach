import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { resolveDeviceId } from "@/lib/server/device";
import { AiProviderError, resolveProvider } from "@/lib/server/ai";
import { isSseEnabled } from "@/lib/server/ai/config";
import { getCoachGraphV2, checkpointerBackend } from "@/lib/server/ai/coach-session-v2";
import { graphV2Config } from "@/lib/server/ai/graph-v2";
import { getSession } from "@/lib/server/chat";

/**
 * Streaming coach endpoint (Server-Sent Events).
 *
 * Gated behind COACH_SSE_ENABLED=true so the existing JSON endpoints keep
 * serving traffic until the client is switched over.
 *
 * Request:  POST /api/coach/stream
 *           { threadId, content, provider?, resume?: boolean }
 *
 * Events (all `event:`/`data:` JSON frames, message text as plain data):
 *   meta      { threadId, intent }             first frame
 *   token     raw text delta (LangGraph streamMode "messages")
 *   reset     {} discard partial tokens already sent
 *   message   { reply, interrupted, question, options, action, yieldedToHuman }
 *   error     { message }
 *   done      [DONE] sentinel
 *
 * The graph uses `streamMode: "messages"` and each AI chunk's text is forwarded
 * as a `token` event, which is exactly the shape the chat bubble needs.
 *
 * If a provider fails after tokens were already sent, a `reset` frame lets the
 * client discard the partial bubble; `error` + `done` still follow so the
 * request never hangs.
 */

const encoder = new TextEncoder();

function frame(event: string, data: unknown): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return encoder.encode(`event: ${event}\ndata: ${payload}\n\n`);
}

function chunkText(chunk: unknown): string {
  if (!(chunk instanceof AIMessageChunk) && !(chunk as { content?: unknown })?.content) {
    return "";
  }
  const content = (chunk as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof part === "object" && part && "text" in part
            ? String((part as { text?: unknown }).text ?? "")
            : "",
      )
      .join("");
  }
  return "";
}

interface PendingQuestion {
  question: string;
  options: string[];
  action: string;
}

function toPendingQuestion(value: unknown): PendingQuestion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { question?: unknown; options?: unknown; action?: unknown };
  if (typeof candidate.question !== "string" || !candidate.question.trim()) {
    return null;
  }
  return {
    question: candidate.question.trim(),
    options: Array.isArray(candidate.options)
      ? candidate.options.filter((o): o is string => typeof o === "string")
      : [],
    action: candidate.action === "ask_options" ? "ask_options" : "ask_question",
  };
}

export async function POST(request: Request) {
  if (!isSseEnabled()) {
    return Response.json(
      {
        error:
          "Streaming is disabled. Set COACH_SSE_ENABLED=true to enable /api/coach/stream.",
      },
      { status: 404 },
    );
  }

  const device = resolveDeviceId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const record = body as {
    threadId?: unknown;
    content?: unknown;
    provider?: unknown;
    resume?: unknown;
  };

  const threadId = typeof record.threadId === "string" ? record.threadId.trim() : "";
  const content = typeof record.content === "string" ? record.content.trim() : "";

  if (!threadId) {
    return Response.json({ error: "threadId is required." }, { status: 400 });
  }
  if (!content) {
    return Response.json({ error: "Message content is required." }, { status: 400 });
  }

  // Ownership check: the thread must belong to this device.
  const session = await getSession(threadId);
  if (!session || session.deviceId !== device.deviceId) {
    return Response.json({ error: "Chat session not found." }, { status: 404 });
  }

  let providerId: string;
  try {
    providerId = resolveProvider(
      typeof record.provider === "string" ? record.provider : undefined,
    ).id;
  } catch (error) {
    const message = error instanceof AiProviderError ? error.message : "AI provider unavailable.";
    return Response.json({ error: message }, { status: 502 });
  }

  const graph = await getCoachGraphV2();
  const config = graphV2Config(threadId);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(frame(event, data));
      };

      let streamedText = false;

      try {
        send("meta", { threadId, checkpointer: checkpointerBackend() });

        const streamOptions = { ...config, streamMode: "messages" as const };

        // Only the conversational nodes produce user-facing text. Router,
        // planner, and guardrail nodes also invoke models (often with
        // structured/JSON output), and forwarding their chunks would leak raw
        // JSON tokens into the chat bubble.
        const TEXT_STREAM_NODES = new Set([
          "general_chat",
          "progress_goals",
          "nutrition_qa",
        ]);

        // streamMode "messages" yields [messageChunk, metadata] tuples.
        const chunks =
          record.resume === true
            ? await graph.stream(new Command({ resume: content }), streamOptions)
            : await graph.stream(
                {
                  messages: [new HumanMessage(content)],
                  userId: device.deviceId,
                  providerId,
                },
                streamOptions,
              );

        for await (const chunk of chunks) {
          const [message, metadata] = chunk as [
            unknown,
            { langgraph_node?: string } | undefined,
          ];
          if (!metadata?.langgraph_node || !TEXT_STREAM_NODES.has(metadata.langgraph_node)) {
            continue;
          }
          const text = chunkText(message);
          if (text) {
            streamedText = true;
            send("token", text);
          }
        }

        const snapshot = await graph.getState(config);
        const tasks = (snapshot?.tasks ?? []) as { interrupts?: { value?: unknown }[] }[];
        const pending = toPendingQuestion(tasks[0]?.interrupts?.[0]?.value);
        const values = (snapshot?.values ?? {}) as Record<string, unknown>;

        send("message", {
          threadId,
          reply: pending?.question ?? (typeof values.output === "string" ? values.output : ""),
          interrupted: pending != null,
          question: pending?.question ?? null,
          options: pending?.options ?? [],
          action: pending?.action ?? "finish",
          yieldedToHuman: values.requiresHuman === true,
          intent: typeof values.intent === "string" ? values.intent : null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Streaming failed.";
        console.error("Coach stream failed:", error);
        // The bubble may already show part of the answer. Tell the client to
        // throw it away before reporting the failure.
        if (streamedText) send("reset", {});
        send("error", { message });
      } finally {
        send("done", "[DONE]");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
