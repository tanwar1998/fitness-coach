import { createSession, listSessions } from "@/lib/server/chat";
import { deviceCookieHeaders, resolveDeviceId } from "@/lib/server/device";

export async function GET(request: Request) {
  const device = resolveDeviceId(request);
  const sessions = await listSessions(device.deviceId);
  return Response.json({ sessions }, { headers: deviceCookieHeaders(device) });
}

export async function POST(request: Request) {
  const device = resolveDeviceId(request);
  const session = await createSession(device.deviceId);
  return Response.json(
    { session },
    { status: 201, headers: deviceCookieHeaders(device) },
  );
}
