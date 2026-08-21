import { getVideos } from "@/lib/server/videos";

export async function GET() {
  const result = await getVideos();
  return Response.json(result, {
    status: result.videos.length > 0 ? 200 : 502,
  });
}
