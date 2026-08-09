import { createSession, listSessions } from "@/lib/server/chat";

export async function GET() {
  const sessions = await listSessions();
  return Response.json({ sessions });
}

export async function POST() {
  const session = await createSession();
  return Response.json({ session }, { status: 201 });
}
