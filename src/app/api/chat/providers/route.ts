import { getDefaultProviderId, listProviders } from "@/lib/server/ai";

export async function GET() {
  return Response.json({
    providers: listProviders(),
    default: getDefaultProviderId(),
  });
}
