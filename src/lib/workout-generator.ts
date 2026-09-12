import {
  EXERCISE_MAP,
  MOVEMENT_PATTERN_LABELS,
  type ExerciseWithContraindications,
} from "@/lib/injury-recovery";
import type { MovementPattern, MuscleGroup } from "../../data";

// ============================================================
// Types
// ============================================================

export type WorkoutGoal = "strength" | "hypertrophy" | "endurance" | "full_body" | "mobility";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type EquipmentKind =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "band"
  | "kettlebell"
  | "box"
  | "bodyweight";
export type EquipmentPreset =
  | "full"
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "home"
  | "bodyweight";

export interface GeneratedExercise {
  key: string;
  exerciseId: string;
  name: string;
  source: "curated" | "wger";
  category?: string;
  muscleLabels: string[];
  movementPatternLabel: string;
  sets: number;
  reps: string;
  restSeconds: number;
  targetLoadPercent?: number;
  showLoad: boolean;
}

export interface GeneratedWorkout {
  id: string;
  goal: WorkoutGoal;
  level: ExperienceLevel;
  durationMinutes: number;
  preset: EquipmentPreset;
  exercises: GeneratedExercise[];
  createdAt: string;
}

export interface BuildOptions {
  goal: WorkoutGoal;
  durationMinutes: number;
  level: ExperienceLevel;
  preset: EquipmentPreset;
}

// ============================================================
// Input options
// ============================================================

export const WORKOUT_GOALS: { value: WorkoutGoal; label: string; hint: string }[] =
  [
    { value: "full_body", label: "Full body", hint: "Balanced mix of everything" },
    { value: "strength", label: "Strength", hint: "Heavy, low reps" },
    { value: "endurance", label: "Cardio", hint: "High reps, short rests" },
    { value: "mobility", label: "Mobility", hint: "Rotations, stability, range of motion" },
  ];

export const WORKOUT_DURATIONS: number[] = [15, 30, 45, 60];

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const EQUIPMENT_PRESETS: {
  value: EquipmentPreset;
  label: string;
  hint: string;
}[] = [
  { value: "full", label: "Full gym", hint: "Barbells to machines" },
  { value: "barbell", label: "Barbells", hint: "Barbells + bodyweight" },
  { value: "dumbbell", label: "Dumbbells", hint: "Dumbbells + bodyweight" },
  { value: "kettlebell", label: "Kettlebells", hint: "Kettlebells + bodyweight" },
  { value: "cable", label: "Cable machines", hint: "Cable stacks + bodyweight" },
  { value: "home", label: "Home setup", hint: "Bands, dumbbells + kettlebells" },
  { value: "bodyweight", label: "No equipment", hint: "Bodyweight only" },
];

// ============================================================
// Equipment mapping for the curated exercise library
// ============================================================

const EQUIPMENT_BY_ID: Record<string, EquipmentKind> = {
  barbell_bench_press: "barbell",
  floor_press: "barbell",
  dumbbell_bench_press: "dumbbell",
  banded_press: "band",
  push_ups: "bodyweight",
  overhead_press: "barbell",
  landmine_press: "barbell",
  dumbbell_lateral_raise: "dumbbell",
  banded_overhead_press: "band",
  barbell_row: "barbell",
  cable_row: "cable",
  chest_supported_row: "machine",
  banded_row: "band",
  pull_up: "bodyweight",
  lat_pulldown: "machine",
  banded_pulldown: "band",
  inverted_row: "bodyweight",
  back_squat: "barbell",
  goblet_squat: "dumbbell",
  leg_press: "machine",
  box_squat: "box",
  bodyweight_squat: "bodyweight",
  deadlift: "barbell",
  romanian_deadlift: "barbell",
  hip_thrust: "barbell",
  kettlebell_swing: "kettlebell",
  glute_bridge: "bodyweight",
  barbell_lunge: "barbell",
  dumbbell_lunge: "dumbbell",
  step_up: "box",
  split_squat: "bodyweight",
  bodyweight_lunge: "bodyweight",
  plank: "bodyweight",
  dead_bug: "bodyweight",
  bird_dog: "bodyweight",
  farmers_walk: "dumbbell",
  single_arm_carry: "dumbbell",
  running: "bodyweight",
  cycling: "machine",
  swimming: "bodyweight",
  walking: "bodyweight",
};

const PRESET_ALLOWS: Record<EquipmentPreset, Set<EquipmentKind>> = {
  full: new Set<EquipmentKind>([
    "barbell",
    "dumbbell",
    "machine",
    "cable",
    "band",
    "kettlebell",
    "box",
    "bodyweight",
  ]),
  barbell: new Set<EquipmentKind>(["barbell", "box", "bodyweight"]),
  dumbbell: new Set<EquipmentKind>(["dumbbell", "box", "bodyweight"]),
  kettlebell: new Set<EquipmentKind>([
    "kettlebell",
    "box",
    "bodyweight",
  ]),
  cable: new Set<EquipmentKind>([
    "cable",
    "machine",
    "box",
    "bodyweight",
  ]),
  home: new Set<EquipmentKind>([
    "dumbbell",
    "band",
    "kettlebell",
    "box",
    "bodyweight",
  ]),
  bodyweight: new Set<EquipmentKind>(["box", "bodyweight"]),
};

/** Real wger equipment names (see src/lib/wger-equipment.json) allowed per preset.
 *  `null` means "any equipment". Used to filter the wger exercise catalog with
 *  real per-exercise equipment data. */
export const PRESET_ALLOWED_EQUIPMENT_NAMES: Record<
  EquipmentPreset,
  Set<string> | null
> = {
  full: null,
  barbell: new Set([
    "Barbell",
    "SZ-Bar",
    "Bench",
    "Incline bench",
    "Gym mat",
    "none (bodyweight exercise)",
  ]),
  dumbbell: new Set([
    "Dumbbell",
    "Gym mat",
    "none (bodyweight exercise)",
  ]),
  kettlebell: new Set([
    "Kettlebell",
    "Gym mat",
    "none (bodyweight exercise)",
  ]),
  cable: new Set([
    "Cable machine",
    "Pull-up bar",
    "Gym mat",
    "none (bodyweight exercise)",
  ]),
  home: new Set([
    "Dumbbell",
    "Kettlebell",
    "Resistance band",
    "Gym mat",
    "Swiss Ball",
    "none (bodyweight exercise)",
  ]),
  bodyweight: new Set([
    "Gym mat",
    "none (bodyweight exercise)",
  ]),
};

export function matchesWgerPreset(
  equipment: { name: string }[],
  preset: EquipmentPreset,
): boolean {
  const allowed = PRESET_ALLOWED_EQUIPMENT_NAMES[preset];
  if (!allowed) return true;
  if (equipment.length === 0) return false;
  return equipment.every((eq) => allowed.has(eq.name));
}

export function equipmentFor(exerciseId: string): EquipmentKind {
  return EQUIPMENT_BY_ID[exerciseId] ?? "bodyweight";
}

export function matchesPreset(exerciseId: string, preset: EquipmentPreset): boolean {
  return PRESET_ALLOWS[preset].has(equipmentFor(exerciseId));
}

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable machine",
  band: "Resistance band",
  kettlebell: "Kettlebell",
  box: "Box / Bench",
  bodyweight: "Bodyweight",
};

/**
 * Display equipment for a generated exercise. Curated exercises show the label
 * of their filter kind (exactly what the equipment preset matched on, so a
 * "Cable machines" workout can never surface "Barbell"), while wger exercises
 * show their real wger equipment tags.
 */
export function equipmentDisplayFor(
  exercise: { exerciseId: string; source: GeneratedExercise["source"] },
  infoEquipment?: { name: string }[],
): string[] {
  if (exercise.source === "wger") {
    return (infoEquipment ?? [])
      .map((e) => (e.name === "none (bodyweight exercise)" ? "Bodyweight" : e.name))
      .filter((name, index, all) => all.indexOf(name) === index);
  }
  return [EQUIPMENT_KIND_LABELS[equipmentFor(exercise.exerciseId)] ?? "Bodyweight"];
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  full_body: "Full body",
};

function muscleLabels(muscles: MuscleGroup[]): string[] {
  return muscles.map((m) => MUSCLE_LABELS[m] ?? m);
}

// ============================================================
// Generation engine
// ============================================================

interface Scheme {
  sets: number;
  reps: string;
  restSeconds: number;
  targetLoadPercent: number;
}

const GOAL_SCHEME: Record<WorkoutGoal, Scheme> = {
  strength: { sets: 4, reps: "4-6", restSeconds: 180, targetLoadPercent: 85 },
  hypertrophy: { sets: 4, reps: "8-12", restSeconds: 90, targetLoadPercent: 75 },
  endurance: { sets: 3, reps: "15-20", restSeconds: 45, targetLoadPercent: 50 },
  full_body: { sets: 3, reps: "8-12", restSeconds: 75, targetLoadPercent: 70 },
  mobility: { sets: 3, reps: "20+", restSeconds: 30, targetLoadPercent: 0 },
};

const LEVEL_SETS: Record<ExperienceLevel, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
};

const PATTERN_PRIORITY: Record<WorkoutGoal, MovementPattern[]> = {
  strength: [
    "squat",
    "hinge",
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
  ],
  hypertrophy: [
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "squat",
    "hinge",
    "lunge",
  ],
  endurance: [
    "squat",
    "hinge",
    "lunge",
    "gait",
    "carry",
    "core_stability",
  ],
  full_body: [
    "squat",
    "horizontal_push",
    "horizontal_pull",
    "hinge",
    "core_stability",
    "lunge",
  ],
  mobility: [
    "rotation",
    "core_stability",
    "gait",
    "carry",
    "horizontal_pull",
    "squat",
    "hinge",
    "lunge",
  ],
};

function exerciseCount(durationMinutes: number, goal: WorkoutGoal): number {
  const minutesPer = {
    strength: 6,
    hypertrophy: 5,
    endurance: 4,
    full_body: 5,
    mobility: 2,
  }[goal];
  return Math.min(12, Math.max(3, Math.round(durationMinutes / minutesPer)));
}

function pickCandidate(
  candidates: ExerciseWithContraindications[],
  goal: WorkoutGoal,
  level: ExperienceLevel,
) {
  const sorted = [...candidates].sort((a, b) => {
    if (goal === "endurance") return a.baseIntensityLoad - b.baseIntensityLoad;
    if (level === "beginner") return a.baseIntensityLoad - b.baseIntensityLoad;
    return b.baseIntensityLoad - a.baseIntensityLoad;
  });
  return sorted[0];
}

export function generateWorkout(opts: BuildOptions): GeneratedWorkout {
  const schemeBase = GOAL_SCHEME[opts.goal];
  const scheme: Scheme = {
    ...schemeBase,
    sets: LEVEL_SETS[opts.level],
  };

  const pool = Object.values(EXERCISE_MAP).filter((e) =>
    matchesPreset(e.id, opts.preset),
  );

  const count = exerciseCount(opts.durationMinutes, opts.goal);
  const priority = PATTERN_PRIORITY[opts.goal];
  const used = new Set<string>();
  const exercises: GeneratedExercise[] = [];
  let step = 0;
  let guard = 0;

  while (exercises.length < count && guard++ < 500) {
    const pattern = priority[step % priority.length];
    step += 1;

    const candidates = pool.filter(
      (e) => e.movementPattern === pattern && !used.has(e.id),
    );
    if (candidates.length === 0) continue;

    const pick = pickCandidate(candidates, opts.goal, opts.level);
    used.add(pick.id);

    exercises.push({
      key: `${pick.id}-${exercises.length}`,
      exerciseId: pick.id,
      name: pick.name,
      source: "curated",
      muscleLabels: muscleLabels(pick.primaryMuscles).slice(0, 3),
      movementPatternLabel: MOVEMENT_PATTERN_LABELS[pick.movementPattern],
      sets: scheme.sets,
      reps: scheme.reps,
      restSeconds: scheme.restSeconds,
      targetLoadPercent: scheme.targetLoadPercent,
      showLoad: equipmentFor(pick.id) !== "bodyweight" && scheme.targetLoadPercent > 0,
    });
  }

  return {
    id: makeId(),
    goal: opts.goal,
    level: opts.level,
    durationMinutes: opts.durationMinutes,
    preset: opts.preset,
    exercises: withRestSecondsToFit(exercises, opts.durationMinutes, opts.goal, schemeBase.restSeconds),
    createdAt: new Date().toISOString(),
  };
}

/** Scale per-exercise rest so the whole plan roughly fits the chosen timebox. */
function withRestSecondsToFit(
  exercises: GeneratedExercise[],
  durationMinutes: number,
  goal: WorkoutGoal,
  schemeRestSeconds: number,
): GeneratedExercise[] {
  if (exercises.length === 0) return exercises;

  const workSeconds = exercises.reduce(
    (sum, e) => sum + e.sets * averageReps(e.reps) * SECONDS_PER_REP[goal],
    0,
  );
  const gaps = exercises.reduce(
    (sum, e) => sum + Math.max(0, e.sets - 1),
    0,
  );
  const restBudget = Math.max(0, durationMinutes * 60 - workSeconds);
  const restSeconds = gaps > 0 ? Math.floor(restBudget / gaps) : 0;
  const clamped = Math.max(15, Math.min(restSeconds, schemeRestSeconds));

  return exercises.map((exercise) => ({
    ...exercise,
    restSeconds: clamped,
  }));
}

function makeId(): string {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function buildWgerExercise(
  wgerId: number,
  name: string,
  category: string | undefined,
  muscles: string[],
  slotConfig: { sets: number; reps: string; restSeconds: number },
): GeneratedExercise {
  return {
    key: `${wgerId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    exerciseId: String(wgerId),
    name,
    source: "wger",
    category,
    muscleLabels: muscles.slice(0, 3),
    movementPatternLabel: "",
    sets: slotConfig.sets,
    reps: slotConfig.reps,
    restSeconds: slotConfig.restSeconds,
    showLoad: false,
  };
}

const KCAL_PER_MINUTE: Record<WorkoutGoal, number> = {
  strength: 5,
  hypertrophy: 5,
  endurance: 8,
  full_body: 6,
  mobility: 3,
};

/** Rough seconds each rep takes, by goal (recovery-load style), used for time estimates. */
const SECONDS_PER_REP: Record<WorkoutGoal, number> = {
  strength: 6,
  hypertrophy: 5,
  endurance: 3,
  full_body: 5,
  mobility: 8,
};

function averageReps(reps: string): number {
  const match = reps.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (match) return (Number(match[1]) + Number(match[2])) / 2;
  const single = reps.match(/(\d+(?:\.\d+)?)/);
  if (single) return Number(single[1]);
  return 8;
}

export interface WorkoutEstimate {
  minutes: number;
  kcal: number;
}

/** Rough time + calorie estimate for a generated workout, for display only.
 *  Generation scales rest to the chosen timebox, so the estimate should land on
 *  or under the requested duration. */
export function estimateWorkout(workout: GeneratedWorkout): WorkoutEstimate {
  let seconds = 0;
  for (const exercise of workout.exercises) {
    const workSeconds =
      exercise.sets * averageReps(exercise.reps) * SECONDS_PER_REP[workout.goal];
    const restSeconds = Math.max(0, exercise.sets - 1) * exercise.restSeconds;
    seconds += workSeconds + restSeconds;
  }
  const minutes = Math.max(
    1,
    Math.min(Math.round(seconds / 60), workout.durationMinutes),
  );
  const kcal = Math.max(5, Math.round(minutes * KCAL_PER_MINUTE[workout.goal]));
  return { minutes, kcal };
}