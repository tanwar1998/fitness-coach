"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import type { VideoItem } from "@/lib/videos";

function formatDuration(dur: string): string {
  const seconds = parseFloat(dur);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function VideoCard({
  video,
  isSelected,
  onSelect,
}: {
  video: VideoItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:shadow-md ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {video.image ? (
          <Image
            src={video.image}
            alt={video.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground/40"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
          {formatDuration(video.duration)}
        </div>
        <div className="absolute left-2 top-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-3">
        <h3 className="truncate font-display font-semibold">{video.name}</h3>
        <div className="mt-1 flex items-center gap-2">
          {video.category && (
            <Badge variant="primary" className="text-xs">
              {video.category}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {video.width}×{video.height}
          </span>
        </div>
        {video.muscles.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {video.muscles.join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}

function VideoDetail({ video }: { video: VideoItem }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full overflow-hidden bg-black">
        <video
          key={video.uuid}
          controls
          preload="metadata"
          className="w-full"
          poster={video.image || undefined}
        >
          <source src={video.video} />
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{video.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {video.category && <Badge variant="primary">{video.category}</Badge>}
              <Badge variant="secondary">
                {video.width}×{video.height}
              </Badge>
              <Badge variant="secondary">{formatDuration(video.duration)}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Duration
            </p>
            <p className="mt-1 text-lg font-bold">{formatDuration(video.duration)}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resolution
            </p>
            <p className="mt-1 text-lg font-bold">
              {video.width}×{video.height}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Codec
            </p>
            <p className="mt-1 text-lg font-bold">{video.codecLong || video.codec}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              File Size
            </p>
            <p className="mt-1 text-lg font-bold">{formatSize(video.size)}</p>
          </div>
        </div>

        {video.muscles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Primary Muscles
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {video.muscles.map((muscle) => (
                <div
                  key={muscle}
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2"
                >
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">{muscle}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {video.authorHistory.length > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            Contributed by: {video.authorHistory.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-video bg-secondary" />
      <div className="p-3">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="mt-2 flex gap-2">
          <div className="h-5 w-14 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

const FETCH_TIMEOUT_MS = 20000;

export default function VideosExplorer({
  initialVideos,
  initialError,
}: {
  initialVideos: VideoItem[];
  initialError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [error, setError] = useState<string | null>(initialError);
  const [retrying, setRetrying] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(
    initialVideos[0] ?? null,
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const retry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch("/api/videos", {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = (await response.json()) as {
        videos: VideoItem[];
        error: string | null;
      };
      if (data.videos.length === 0) {
        throw new Error(data.error || "No videos available right now.");
      }
      setVideos(data.videos);
      setSelectedVideo(data.videos[0]);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "TimeoutError"
          ? "The request timed out. Please try again."
          : err instanceof Error
            ? err.message
            : "Failed to load videos",
      );
    } finally {
      setRetrying(false);
    }
  };

  const filteredVideos = useMemo(() => {
    if (!debouncedQuery) return videos;
    const needle = debouncedQuery.toLowerCase();
    return videos.filter((video) => video.name.toLowerCase().includes(needle));
  }, [videos, debouncedQuery]);

  const loading = videos.length === 0 && !error;

  return (
    <>
      {error && videos.length === 0 && (
        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-danger/30 bg-danger/10 px-5 py-6 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {retrying ? "Retrying..." : "Try again"}
          </button>
        </div>
      )}

      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Input
          label="Search Videos"
          placeholder="Search by exercise name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredVideos.length} video{filteredVideos.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Videos</h2>
            <span className="text-sm text-muted-foreground">
              {filteredVideos.length.toLocaleString()} total
            </span>
          </div>
          <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : filteredVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isSelected={selectedVideo?.id === video.id}
                    onSelect={() => setSelectedVideo(video)}
                  />
                ))}
            {!loading && filteredVideos.length === 0 && (
              <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border">
                <p className="text-center text-muted-foreground">No videos found</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="font-display text-lg font-bold">Player</h2>
          <div className="mt-4">
            {selectedVideo ? (
              <VideoDetail video={selectedVideo} />
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                <p className="text-center text-muted-foreground">
                  Select a video from the list
                  <br />
                  to start watching.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
