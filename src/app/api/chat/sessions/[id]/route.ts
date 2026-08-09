import { deleteSession } from "@/lib/server/chat";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/chat/sessions/[id]">,
) {
  const { id } = await context.params;
  const deleted = await deleteSession(id);
  if (!deleted) {
    return Response.json({ error: "Chat session not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
