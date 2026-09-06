import { getVideos } from "@/lib/server/videos";

export async function GET() {
  try {
    const result = await getVideos();
    return Response.json(result, {
      status: result.videos.length > 0 ? 200 : 502,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load videos";
    return Response.json({ videos: [], error: message }, { status: 502 });
  }
}
