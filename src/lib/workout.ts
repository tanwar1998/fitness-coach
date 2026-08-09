import exercisesList from "@/data/exercisesList.json";

export type ExerciseType = "Strength" | "Cardio";

export type TargetArea = "Full Body" | "Lower Body" | "Upper Body" | "Core";

export type Intensity = "Beginner" | "Intermediate" | "Advanced";

export interface WorkoutOptions {
  duration: number;
  type: ExerciseType;
  targetArea: TargetArea;
  intensity: Intensity;
}

export interface WorkoutBlock {
  name: string;
  description: string;
  du: number;
  re: number;
  isTransition: boolean;
}

export interface WorkoutSection {
  name: string;
  totalSeconds: number;
  blocks: WorkoutBlock[];
}

export interface Workout {
  sections: WorkoutSection[];
  totalSeconds: number;
}

interface ExerciseEntry {
  id: number;
  name: string;
  description: string;
  type?: string[];
  level?: string[];
  area: string[];
}

export const DURATION_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

export const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "Strength", label: "Strength" },
  { value: "Cardio", label: "Cardio" },
];

export const TARGET_AREA_OPTIONS: { value: string; label: string }[] = [
  { value: "Full Body", label: "Full Body" },
  { value: "Lower Body", label: "Lower Body" },
  { value: "Upper Body", label: "Upper Body" },
  { value: "Core", label: "Core" },
];

export const INTENSITY_OPTIONS: { value: string; label: string }[] = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

const warmupPool = exercisesList.warmup as unknown as ExerciseEntry[];
const workoutPool = exercisesList.workout as unknown as ExerciseEntry[];
const cooldownPool = exercisesList.cooldown as unknown as ExerciseEntry[];

const TYPE_MAP: Record<ExerciseType, string> = {
  Strength: "strength",
  Cardio: "cardio",
};

const AREA_MAP: Record<TargetArea, string> = {
  "Full Body": "full",
  "Lower Body": "lower",
  "Upper Body": "upper",
  Core: "core",
};

const LEVEL_MAP: Record<Intensity, string> = {
  Beginner: "beginner",
  Intermediate: "intermediate",
  Advanced: "advanced",
};

const MAIN_PATTERNS: Array<"fun" | "pyramids" | "reversePyramids"> = [
  "reversePyramids",
  "fun",
  "pyramids",
  "fun",
  "reversePyramids",
  "fun",
  "fun",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round5(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function pickDistinct(pool: ExerciseEntry[], count: number) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function filterPool(
  pool: ExerciseEntry[],
  filters: { type?: string; level?: string; area?: string },
) {
  return pool.filter((entry) => {
    if (
      filters.type &&
      entry.type &&
      !entry.type.includes(filters.type)
    ) {
      return false;
    }
    if (
      filters.level &&
      entry.level &&
      !entry.level.includes(filters.level)
    ) {
      return false;
    }
    if (
      filters.area &&
      entry.area &&
      !entry.area.includes(filters.area) &&
      !entry.area.includes("full")
    ) {
      return false;
    }
    return true;
  });
}

function toBlock(entry: ExerciseEntry, du: number, re = 0): WorkoutBlock {
  return {
    name: entry.name,
    description: entry.description,
    du,
    re,
    isTransition: false,
  };
}

function transition(du = 40): WorkoutBlock {
  return { name: "Transition", description: "", du, re: 0, isTransition: true };
}

function buildFunSection(pool: ExerciseEntry[], block: number) {
  const blocks = pickDistinct(pool, 6).map((entry, index) =>
    toBlock(entry, block, index === 5 ? 0 : 20),
  );
  return [...blocks, transition()];
}

function buildPyramidSection(
  pool: ExerciseEntry[],
  block: number,
  direction: "asc" | "desc",
) {
  const pair = pickDistinct(pool, 2);
  const levels = [round5(block * 0.6), block, round5(block * 1.4)];
  const order = direction === "asc" ? levels : [...levels].reverse();

  const blocks: WorkoutBlock[] = [];
  pair.forEach((entry) => {
    order.forEach((seconds, index) => {
      blocks.push(toBlock(entry, seconds, index === 2 ? 0 : 20));
    });
  });
  return [...blocks, transition()];
}

function buildFinisherSection(pool: ExerciseEntry[], count: number, block: number) {
  const blocks = pickDistinct(pool, count).map((entry) => toBlock(entry, block));
  return [...blocks, transition()];
}

export function generateWorkout(options: WorkoutOptions): Workout {
  const type = TYPE_MAP[options.type];
  const area = AREA_MAP[options.targetArea];
  const level = LEVEL_MAP[options.intensity];

  const warmupMatches = filterPool(warmupPool, { area });
  const mainMatches = filterPool(workoutPool, { type, level, area });
  const cooldownMatches = filterPool(cooldownPool, { area });

  const warmCount = clamp(Math.round(options.duration / 5), 3, 9);
  const coolCount = warmCount;
  const finCount = clamp(3 + Math.floor(options.duration / 10), 4, 9);
  const mainCount = Math.max(2, Math.ceil(options.duration / 8));

  const totalSeconds = options.duration * 60;
  const totalBlocks =
    warmCount + 1 + mainCount * 7 + finCount + 1 + coolCount;
  const block = Math.max(10, round5(totalSeconds / totalBlocks));

  const sections: WorkoutSection[] = [];

  const warmup = pickDistinct(warmupMatches, warmCount);
  if (warmup.length > 0) {
    const blocks = [...warmup.map((entry) => toBlock(entry, block)), transition()];
    sections.push({
      name: "warmup",
      totalSeconds: blocks.reduce((sum, b) => sum + b.du, 0),
      blocks,
    });
  }

  let funIndex = 0;
  let pyramidsIndex = 0;
  let reversePyramidsIndex = 0;

  for (let i = 0; i < mainCount; i++) {
    const pattern = MAIN_PATTERNS[i % MAIN_PATTERNS.length];
    let blocks: WorkoutBlock[] = [];
    let name = "";

    if (pattern === "fun") {
      funIndex += 1;
      name = `fun${funIndex}`;
      blocks = buildFunSection(mainMatches, block);
    } else if (pattern === "pyramids") {
      pyramidsIndex += 1;
      name = `pyramids${pyramidsIndex}`;
      blocks = buildPyramidSection(mainMatches, block, "asc");
    } else {
      reversePyramidsIndex += 1;
      name = `reversePyramids${reversePyramidsIndex}`;
      blocks = buildPyramidSection(mainMatches, block, "desc");
    }

    sections.push({
      name,
      totalSeconds: blocks.reduce((sum, b) => sum + b.du, 0),
      blocks,
    });
  }

  const finisher = buildFinisherSection(mainMatches, finCount, block);
  sections.push({
    name: "finisher",
    totalSeconds: finisher.reduce((sum, b) => sum + b.du, 0),
    blocks: finisher,
  });

  const cooldown = pickDistinct(cooldownMatches, coolCount);
  if (cooldown.length > 0) {
    const blocks = cooldown.map((entry) => toBlock(entry, block));
    sections.push({
      name: "cooldown",
      totalSeconds: blocks.reduce((sum, b) => sum + b.du, 0),
      blocks,
    });
  }

  return {
    sections,
    totalSeconds: sections.reduce((sum, s) => sum + s.totalSeconds, 0),
  };
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function titleCase(word: string) {
  const spaced = word.replace(/([a-z0-9])([A-Z0-9])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
