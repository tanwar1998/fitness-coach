import { Badge } from "@/components/Badge";
import VideosExplorer from "@/components/videos/VideosExplorer";
import { getVideos } from "@/lib/server/videos";

export default async function VideosPage() {
  const { videos, error } = await getVideos();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-lime/15 blur-[80px]"
        />
        <div className="relative">
          <Badge variant="primary" className="mb-4">
            Exercise Videos
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
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
