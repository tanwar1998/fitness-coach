"use client";

import type { GeneratedWorkout } from "@/lib/workout-generator";

const KEY = "fitpulse:workout-history";
const MAX_ENTRIES = 20;

export type WorkoutStatus = "draft" | "started";

export interface WorkoutHistoryEntry {
  workout: GeneratedWorkout;
  status: WorkoutStatus;
  startedAt?: string;
}

function safeParse(value: string | null): WorkoutHistoryEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is WorkoutHistoryEntry =>
        entry &&
        typeof entry === "object" &&
        typeof entry.workout === "object" &&
        typeof entry.workout.id === "string" &&
        typeof entry.status === "string",
    );
  } catch {
    return [];
  }
}

export function loadHistory(): WorkoutHistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY));
}

function persist(entries: WorkoutHistoryEntry[]) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    );
  } catch {
    // storage full or unavailable — ignore
  }
}

/** Add a generated workout to history, newest first. Replaces by id. */
export function upsertWorkout(workout: GeneratedWorkout): WorkoutHistoryEntry[] {
  const fresh: WorkoutHistoryEntry = { workout, status: "draft" };
  const prev = loadHistory().filter(
    (entry) => entry.workout.id !== workout.id,
  );
  const entries = [fresh, ...prev].slice(0, MAX_ENTRIES);
  persist(entries);
  return entries;
}

/** Mark a workout as started (kept for later "learn preferences" analysis). */
export function markStarted(id: string): WorkoutHistoryEntry[] {
  const entries = loadHistory().map(
    (entry): WorkoutHistoryEntry => {
      if (entry.workout.id !== id) return entry;
      return {
        workout: entry.workout,
        status: "started",
        startedAt: new Date().toISOString(),
      };
    },
  );
  persist(entries);
  return entries;
}

/** Remove a single entry from history. */
export function removeFromHistory(id: string): WorkoutHistoryEntry[] {
  const entries = loadHistory().filter((entry) => entry.workout.id !== id);
  persist(entries);
  return entries;
}