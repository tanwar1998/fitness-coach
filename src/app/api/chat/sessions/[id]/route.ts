import { deleteSession } from "@/lib/server/chat";
import { resolveDeviceId } from "@/lib/server/device";

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/chat/sessions/[id]">,
) {
  const { id } = await context.params;
  const device = resolveDeviceId(request);
  const deleted = await deleteSession(id, device.deviceId);
  if (!deleted) {
    return Response.json({ error: "Chat session not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
