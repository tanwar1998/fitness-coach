import { Badge } from "@/components/Badge";
import VideosExplorer from "@/components/videos/VideosExplorer";
import { getVideos } from "@/lib/server/videos";
import type { VideoItem } from "@/lib/videos";

export default async function VideosPage() {
  let videos: VideoItem[] = [];
  let error: string | null = null;
  try {
    ({ videos, error } = await getVideos());
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load videos";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="relative overflow-hidden rounded-sm border border-foreground/25 bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="relative">
          <h1 className="font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            Video Library
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Watch exercise demonstrations with detailed form guides and
            technique tips.
          </p>
        </div>
      </div>

      <VideosExplorer initialVideos={videos} initialError={error} />
    </div>
  );
}
