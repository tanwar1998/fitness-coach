import { cacheLife, cacheTag } from "next/cache";
import type { VideoItem } from "@/lib/videos";

const WGER_BASE = "https://wger.de/api/v2";

interface WgerVideo {
  id: number;
  uuid: string;
  exercise: number;
  video: string;
  size: number;
  duration: string;
  width: number;
  height: number;
  codec: string;
  codec_long: string;
  author_history: string[];
}

interface WgerExerciseInfo {
  id: number;
  category: { id: number; name: string };
  muscles: { id: number; name: string; name_en: string }[];
  images: {
    image: string;
    thumbnails: { small: string; medium: string } | null;
    is_main: boolean;
  }[];
  translations: { name: string; language: number }[];
}

interface WgerListResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

async function fetchWgerJson<T>(path: string): Promise<T> {
  const response = await fetch(`${WGER_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`wger API error ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

function exerciseName(exercise: WgerExerciseInfo | undefined): string {
  if (!exercise) return "Unknown Exercise";
  const en = exercise.translations.find((t) => t.language === 2);
  if (en?.name) return en.name;
  return exercise.translations[0]?.name || "Unknown Exercise";
}

function exerciseImage(exercise: WgerExerciseInfo | undefined): string | null {
  if (!exercise || exercise.images.length === 0) return null;
  const main = exercise.images.find((img) => img.is_main) ?? exercise.images[0];
  return main.thumbnails?.medium || main.image;
}

export interface VideosResult {
  videos: VideoItem[];
  error: string | null;
}

async function fetchVideosFromWger(): Promise<VideosResult> {
  const errors: string[] = [];
  let videoData: WgerListResponse<WgerVideo> | null = null;
  let exerciseData: WgerListResponse<WgerExerciseInfo> | null = null;

  try {
    videoData = await fetchWgerJson<WgerListResponse<WgerVideo>>(
      "/video/?limit=100&format=json",
    );
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause : undefined;
    errors.push(
      err instanceof Error
        ? `${err.message}${cause ? ` [${cause.name}: ${cause.message}]` : ""}`
        : "Failed to load videos",
    );
  }

  try {
    exerciseData = await fetchWgerJson<WgerListResponse<WgerExerciseInfo>>(
      "/exerciseinfo/?language=2&limit=1000&format=json",
    );
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause : undefined;
    errors.push(
      err instanceof Error
        ? `${err.message}${cause ? ` [${cause.name}: ${cause.message}]` : ""}`
        : "Failed to load exercise info",
    );
  }

  if (!videoData) {
    return { videos: [], error: errors.join("; ") || "Failed to load videos" };
  }

  const exercises = new Map<number, WgerExerciseInfo>();
  if (exerciseData) {
    for (const ex of exerciseData.results) {
      exercises.set(ex.id, ex);
    }
  }

  const videos: VideoItem[] = videoData.results.map((video) => {
    const exercise = exercises.get(video.exercise);
    return {
      id: video.id,
      uuid: video.uuid,
      video: video.video,
      duration: video.duration,
      width: video.width,
      height: video.height,
      size: video.size,
      codec: video.codec,
      codecLong: video.codec_long,
      authorHistory: video.author_history ?? [],
      name: exerciseName(exercise),
      category: exercise?.category?.name || "",
      muscles: (exercise?.muscles ?? [])
        .slice(0, 3)
        .map((m) => m.name_en || m.name),
      image: exerciseImage(exercise),
    };
  });

  return { videos, error: errors.length > 0 ? errors.join("; ") : null };
}

export async function getVideos(): Promise<VideosResult> {
  "use cache";
  cacheLife("days");
  cacheTag("wger");

  const result = await fetchVideosFromWger();
  if (result.videos.length === 0 && result.error) {
    // Throw so a failed fetch is never cached — "use cache" only stores
    // successful results. An uncached failure is retried live on the next
    // request instead of being served for the whole cache lifetime.
    throw new Error(result.error);
  }
  return result;
}
