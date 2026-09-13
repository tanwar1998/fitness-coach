import type { GeneratedExercise } from "@/lib/workout-generator";
import data from "@/data/warmup-cooldown.json";

export type WorkoutPhase = "main" | "warmup" | "cooldown";

interface PoolExercise {
  id: number;
  name: string;
  description: string;
  area: string[];
}

const WARMUP_POOL: PoolExercise[] = (data.warmup ?? []) as PoolExercise[];
const COOLDOWN_POOL: PoolExercise[] = (data.cooldown ?? []) as PoolExercise[];

const AREA_LABELS: Record<string, string> = {
  upper: "Upper body",
  lower: "Lower body",
  core: "Core",
  full: "Full body",
  calf: "Calves",
  hamstring: "Hamstrings",
  back: "Back",
  hip: "Hips",
  glute: "Glutes",
  chest: "Chest",
  arm: "Arms",
};

/** Small deterministic string hash so phase selection is stable per workout. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function labelsFor(area: string[]): string[] {
  const labels = area.map((a) => AREA_LABELS[a] ?? a);
  return [...new Set(labels)];
}

/**
 * Build warm-up or cool-down exercises from the local wger-derived pools,
 * seeded by the workout id so a regenerated workout gets a different mix.
 * Phase exercises never duplicate a main-session exercise by name.
 */
export function buildPhaseExercises(
  phase: "warmup" | "cooldown",
  mainExerciseNames: string[],
  seed: string,
  count = 2,
): GeneratedExercise[] {
  if (count <= 0) return [];
  const pool = phase === "warmup" ? WARMUP_POOL : COOLDOWN_POOL;
  const mainLower = new Set(
    mainExerciseNames.map((name) => name.toLowerCase().trim()),
  );
  const usable = pool.filter(
    (exercise) => !mainLower.has(exercise.name.toLowerCase().trim()),
  );
  if (usable.length === 0) return [];

  const start = hashString(`${phase}-${seed}`) % usable.length;
  const picked = [
    ...usable.slice(start),
    ...usable.slice(0, start),
  ].slice(0, count);

  return picked.map((exercise, index) => ({
    key: `${phase}-${index}-${exercise.id}-${seed.slice(-5)}`,
    exerciseId: `${phase}_${exercise.id}`,
    name: exercise.name,
    source: "curated" as const,
    category: phase === "warmup" ? "Warm-up" : "Cool-down",
    muscleLabels: labelsFor(exercise.area).slice(0, 3),
    movementPatternLabel: "",
    sets: 1,
    reps: phase === "warmup" ? "30s" : "45s",
    restSeconds: 15,
    targetLoadPercent: 0,
    showLoad: false,
    phase,
  }));
}