import { AiProviderError } from "@/lib/server/ai";
import {
  CoachThreadInterruptedError,
} from "@/lib/server/ai/coach-session";
import { sendCoachMessage } from "@/lib/server/chat";
import { deviceCookieHeaders, resolveDeviceId } from "@/lib/server/device";
import type { CoachConstraints } from "@/lib/coach-types";

export async function POST(request: Request) {
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
    currentPlan?: unknown;
    constraints?: unknown;
    profile?: unknown;
  };

  const threadId =
    typeof record.threadId === "string" ? record.threadId.trim() : "";
  const content =
    typeof record.content === "string" ? record.content.trim() : "";

  if (!threadId) {
    return Response.json({ error: "threadId is required." }, { status: 400 });
  }
  if (!content) {
    return Response.json({ error: "Message content is required." }, { status: 400 });
  }

  const provider =
    typeof record.provider === "string" ? record.provider : undefined;

  const profile =
    record.profile &&
    typeof record.profile === "object" &&
    !Array.isArray(record.profile)
      ? (record.profile as { goal?: string; equipment?: string[]; targetMuscle?: string })
      : undefined;

  const constraints =
    record.constraints &&
    typeof record.constraints === "object" &&
    !Array.isArray(record.constraints)
      ? (record.constraints as CoachConstraints)
      : undefined;

  try {
    const result = await sendCoachMessage({
      threadId,
      content,
      providerId: provider,
      deviceId: device.deviceId,
      profile,
      currentPlan: record.currentPlan,
      constraints,
    });
    return Response.json(result, { headers: deviceCookieHeaders(device) });
  } catch (error) {
    if (error instanceof CoachThreadInterruptedError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AiProviderError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to process coach message:", error);
    return Response.json(
      { error: "Something went wrong while processing your message." },
      { status: 500 },
    );
  }
}