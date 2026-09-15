import { AiProviderError } from "@/lib/server/ai";
import {
  CoachNoPendingQuestionError,
  CoachThreadMissingError,
} from "@/lib/server/ai/coach-session";
import { sendCoachAnswer } from "@/lib/server/chat";
import { deviceCookieHeaders, resolveDeviceId } from "@/lib/server/device";

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
    answer?: unknown;
    provider?: unknown;
  };

  const threadId =
    typeof record.threadId === "string" ? record.threadId.trim() : "";
  const answer =
    typeof record.answer === "string" ? record.answer.trim() : "";

  if (!threadId) {
    return Response.json({ error: "threadId is required." }, { status: 400 });
  }
  if (!answer) {
    return Response.json({ error: "Answer is required." }, { status: 400 });
  }

  const provider =
    typeof record.provider === "string" ? record.provider : undefined;

  try {
    const result = await sendCoachAnswer({
      threadId,
      answer,
      providerId: provider,
      deviceId: device.deviceId,
    });
    return Response.json(result, { headers: deviceCookieHeaders(device) });
  } catch (error) {
    if (
      error instanceof CoachThreadMissingError ||
      (error instanceof Error && error.message.includes("not found"))
    ) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CoachNoPendingQuestionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AiProviderError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    console.error("Failed to answer coach question:", error);
    return Response.json(
      { error: "Something went wrong while answering your question." },
      { status: 500 },
    );
  }
}