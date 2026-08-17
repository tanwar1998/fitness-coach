"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";

interface Video {
  id: number;
  uuid: string;
  exercise: number;
  exercise_uuid: string;
  video: string;
  is_main: boolean;
  size: number;
  duration: string;
  width: number;
  height: number;
  codec: string;
  codec_long: string;
  license_author: string;
  author_history: string[];
}

interface ExerciseInfo {
  id: number;
  uuid: string;
  category: { id: number; name: string };
  muscles: { id: number; name: string; name_en: string }[];
  images: { image: string; thumbnails: { small: string; medium: string } | null; is_main: boolean }[];
  translations: { id: number; name: string; language: number }[];
}

interface VideoApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Video[];
}

interface ExerciseApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ExerciseInfo[];
}

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

function getExerciseName(exercise: ExerciseInfo | undefined): string {
  if (!exercise) return "Unknown Exercise";
  const en = exercise.translations.find((t) => t.language === 2);
  if (en) return en.name;
  if (exercise.translations.length > 0) return exercise.translations[0].name;
  return "Unknown Exercise";
}

function getExerciseImage(exercise: ExerciseInfo | undefined): string | null {
  if (!exercise || exercise.images.length === 0) return null;
  const main = exercise.images.find((img) => img.is_main);
  if (main) return main.thumbnails?.medium || main.image;
  const first = exercise.images[0];
  return first.thumbnails?.medium || first.image;
}

function getExerciseCategory(exercise: ExerciseInfo | undefined): string {
  return exercise?.category?.name || "";
}

function VideoCard({
  video,
  exercise,
  isSelected,
  onSelect,
}: {
  video: Video;
  exercise: ExerciseInfo | undefined;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const name = getExerciseName(exercise);
  const imageUrl = getExerciseImage(exercise);
  const category = getExerciseCategory(exercise);

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
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
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
        <h3 className="truncate font-semibold">{name}</h3>
        <div className="mt-1 flex items-center gap-2">
          {category && (
            <Badge variant="primary" className="text-xs">
              {category}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {video.width}×{video.height}
          </span>
        </div>
        {exercise && exercise.muscles.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {exercise.muscles
              .slice(0, 3)
              .map((m) => m.name_en || m.name)
              .join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}

function VideoDetail({
  video,
  exercise,
}: {
  video: Video;
  exercise: ExerciseInfo | undefined;
}) {
  const name = getExerciseName(exercise);
  const category = getExerciseCategory(exercise);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full overflow-hidden bg-black">
        <video
          key={video.uuid}
          controls
          preload="metadata"
          className="w-full"
          poster={getExerciseImage(exercise) || undefined}
        >
          <source src={video.video} />
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {category && <Badge variant="primary">{category}</Badge>}
              <Badge variant="secondary">{video.width}×{video.height}</Badge>
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
            <p className="mt-1 text-lg font-bold">{video.width}×{video.height}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Codec
            </p>
            <p className="mt-1 text-lg font-bold">{video.codec_long || video.codec}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              File Size
            </p>
            <p className="mt-1 text-lg font-bold">{formatSize(video.size)}</p>
          </div>
        </div>

        {exercise && exercise.muscles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Primary Muscles
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {exercise.muscles.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2"
                >
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">{m.name_en || m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {video.author_history.length > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            Contributed by: {video.author_history.join(", ")}
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

export default function VideosPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [exercises, setExercises] = useState<Map<number, ExerciseInfo>>(new Map());
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loading = !initialLoadComplete;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [videoRes, exerciseRes] = await Promise.all([
        fetch("https://wger.de/api/v2/video/?limit=100&format=json"),
        fetch("https://wger.de/api/v2/exerciseinfo/?language=2&limit=1000&format=json"),
      ]);

      if (cancelled) return;

      const [videoData, exerciseData]: [VideoApiResponse, ExerciseApiResponse] = await Promise.all([
        videoRes.json(),
        exerciseRes.json(),
      ]);

      if (cancelled) return;

      setVideos(videoData.results);
      setNextUrl(videoData.next);

      const map = new Map<number, ExerciseInfo>();
      for (const ex of exerciseData.results) {
        map.set(ex.id, ex);
      }
      setExercises(map);
      setError(null);
      setInitialLoadComplete(true);
    }

    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to load videos");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchMore = useCallback(async (url: string) => {
    setLoadingMore(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: VideoApiResponse = await res.json();
      setVideos((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more videos");
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!observerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextUrl && !loadingMore) {
          fetchMore(nextUrl);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [nextUrl, loadingMore, fetchMore]);

  const filteredVideos = videos.filter((video) => {
    if (!debouncedQuery) return true;
    const exercise = exercises.get(video.exercise);
    const name = getExerciseName(exercise).toLowerCase();
    return name.includes(debouncedQuery.toLowerCase());
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="primary" className="mb-4">
          Exercise Videos
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Video Library
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Watch exercise demonstrations with detailed form guides and technique tips.
        </p>
      </div>

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

      {error && (
        <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-danger/30 bg-danger/10 px-5 py-4 text-center text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Videos</h2>
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
                    exercise={exercises.get(video.exercise)}
                    isSelected={selectedVideo?.id === video.id}
                    onSelect={() => setSelectedVideo(video)}
                  />
                ))}
            <div ref={observerRef} className="h-4" />
            {loadingMore && (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading more...</div>
            )}
            {!loading && filteredVideos.length === 0 && (
              <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border">
                <p className="text-center text-muted-foreground">No videos found</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-lg font-semibold">Player</h2>
          <div className="mt-4">
            {selectedVideo ? (
              <VideoDetail
                video={selectedVideo}
                exercise={exercises.get(selectedVideo.exercise)}
              />
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
    </div>
  );
}
