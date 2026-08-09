import { AiProviderError } from "@/lib/server/ai";
import { sendMessage } from "@/lib/server/chat";

export async function POST(
  request: Request,
  context: RouteContext<"/api/chat/sessions/[id]/messages">,
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const content =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { content?: unknown }).content === "string"
      ? (body as { content: string }).content.trim()
      : "";

  if (!content) {
    return Response.json(
      { error: "Message content is required." },
      { status: 400 },
    );
  }

  const provider =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { provider?: unknown }).provider === "string"
      ? (body as { provider: string }).provider
      : undefined;

  try {
    const session = await sendMessage(id, content, provider);
    return Response.json({ session });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to send chat message:", error);
    return Response.json(
      { error: "Something went wrong while processing your message." },
      { status: 500 },
    );
  }
}
