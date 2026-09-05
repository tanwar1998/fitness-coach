import type {
  BodyRegion,
  InjuryReport,
  InjurySeverity,
  InjuryStatus,
  InjuryType,
  MovementPattern,
  MuscleGroup,
  DailyCheckIn,
  ReadinessScore,
  PlannedSet,
  WorkoutSession,
  AdjustmentAction,
  AdjustedPlan,
  AdjustmentContext,
  AdjustmentReasonType,
} from "../../data";

// ============================================================
// Body Region Helpers
// ============================================================

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  neck: "Neck",
  shoulder_left: "Left Shoulder",
  shoulder_right: "Right Shoulder",
  elbow_left: "Left Elbow",
  elbow_right: "Right Elbow",
  wrist_left: "Left Wrist",
  wrist_right: "Right Wrist",
  upper_back: "Upper Back",
  lower_back: "Lower Back",
  chest: "Chest",
  core: "Core",
  hip_left: "Left Hip",
  hip_right: "Right Hip",
  knee_left: "Left Knee",
  knee_right: "Right Knee",
  ankle_left: "Left Ankle",
  ankle_right: "Right Ankle",
  foot_left: "Left Foot",
  foot_right: "Right Foot",
  hamstring_left: "Left Hamstring",
  hamstring_right: "Right Hamstring",
  quad_left: "Left Quad",
  quad_right: "Right Quad",
  calf_left: "Left Calf",
  calf_right: "Right Calf",
};

export const BODY_REGION_GROUPS: { label: string; regions: BodyRegion[] }[] = [
  {
    label: "Head & Neck",
    regions: ["neck"],
  },
  {
    label: "Upper Body",
    regions: [
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
      "wrist_left",
      "wrist_right",
      "upper_back",
      "chest",
    ],
  },
  {
    label: "Core",
    regions: ["core", "lower_back"],
  },
  {
    label: "Hips & Legs",
    regions: [
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
      "foot_left",
      "foot_right",
      "hamstring_left",
      "hamstring_right",
      "quad_left",
      "quad_right",
      "calf_left",
      "calf_right",
    ],
  },
];

/** Given a side-specific region, return the generic region (shoulder, knee, etc.) */
export function genericRegion(region: BodyRegion): string {
  return region.replace(/_(left|right)$/, "");
}

/** Return whether two regions are the same generic area (ignoring left/right) */
export function sameGenericRegion(a: BodyRegion, b: BodyRegion): boolean {
  return genericRegion(a) === genericRegion(b);
}

/** All movement patterns with labels */
export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_push: "Horizontal Push",
  horizontal_pull: "Horizontal Pull",
  vertical_push: "Vertical Push",
  vertical_pull: "Vertical Pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  carry: "Carry",
  rotation: "Rotation",
  core_stability: "Core Stability",
  gait: "Gait (Walk/Run)",
};

export const INJURY_TYPE_LABELS: Record<InjuryType, string> = {
  acute: "Acute (recent, sharp)",
  chronic: "Chronic (recurring)",
};

export const INJURY_SEVERITY_LABELS: Record<InjurySeverity, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
  active: "Active",
  healing: "Healing",
  cleared: "Cleared",
};

export const SEVERITY_ORDER: InjurySeverity[] = ["mild", "moderate", "severe"];

export function severityAtLeast(
  actual: InjurySeverity,
  threshold: InjurySeverity,
): boolean {
  return SEVERITY_ORDER.indexOf(actual) >= SEVERITY_ORDER.indexOf(threshold);
}

// ============================================================
// Exercise Substitution / Exclusion Map
// ============================================================

export interface Contraindication {
  region: BodyRegion;
  minSeverityToExclude: InjurySeverity;
}

export interface ExerciseWithContraindications {
  id: string;
  wgerId: number; // id in src/lib/wger-exerciseinfo.json
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[]; // derived from wger muscles_secondary
  movementPattern: MovementPattern;
  loadedRegions: BodyRegion[];
  contraindications: Contraindication[];
  substitutes: string[];
  baseIntensityLoad: number;
}

/**
 * Curated exercise library with injury-awareness tagging.
 * In a real app this would be a full database; here we cover the
 * most common compound movements so the adjustment engine has
 * meaningful substitutions to work with.
 */
export const EXERCISE_MAP: Record<string, ExerciseWithContraindications> = {
  // ---------- HORIZONTAL PUSH ----------
  barbell_bench_press: {
    id: "barbell_bench_press",
    wgerId: 73,
    name: "Barbell Bench Press",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    movementPattern: "horizontal_push",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
      "wrist_left",
      "wrist_right",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "mild" },
      { region: "shoulder_right", minSeverityToExclude: "mild" },
      { region: "wrist_left", minSeverityToExclude: "moderate" },
      { region: "wrist_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: [
      "floor_press",
      "dumbbell_bench_press",
      "banded_press",
      "push_ups",
    ],
    baseIntensityLoad: 1.0,
  },
  floor_press: {
    id: "floor_press",
    wgerId: 1084,
    name: "Floor Press",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "biceps", "triceps"],
    movementPattern: "horizontal_push",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "moderate" },
      { region: "shoulder_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["dumbbell_bench_press", "banded_press", "push_ups"],
    baseIntensityLoad: 0.8,
  },
  dumbbell_bench_press: {
    id: "dumbbell_bench_press",
    wgerId: 1498,
    name: "Dumbbell Bench Press",
    primaryMuscles: ["triceps"],
    secondaryMuscles: ["chest"],
    movementPattern: "horizontal_push",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
      "wrist_left",
      "wrist_right",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "moderate" },
      { region: "shoulder_right", minSeverityToExclude: "moderate" },
      { region: "wrist_left", minSeverityToExclude: "severe" },
      { region: "wrist_right", minSeverityToExclude: "severe" },
    ],
    substitutes: ["banded_press", "push_ups"],
    baseIntensityLoad: 0.85,
  },
  banded_press: {
    id: "banded_press",
    wgerId: 129,
    name: "Banded Chest Press",
    primaryMuscles: ["chest"],
    movementPattern: "horizontal_push",
    loadedRegions: ["shoulder_left", "shoulder_right"],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "severe" },
      { region: "shoulder_right", minSeverityToExclude: "severe" },
    ],
    substitutes: ["push_ups"],
    baseIntensityLoad: 0.4,
  },
  push_ups: {
    id: "push_ups",
    wgerId: 1551,
    name: "Push-ups",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "core", "triceps"],
    movementPattern: "horizontal_push",
    loadedRegions: [
      "wrist_left",
      "wrist_right",
      "shoulder_left",
      "shoulder_right",
    ],
    contraindications: [
      { region: "wrist_left", minSeverityToExclude: "moderate" },
      { region: "wrist_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: [],
    baseIntensityLoad: 0.5,
  },

  // ---------- VERTICAL PUSH ----------
  overhead_press: {
    id: "overhead_press",
    wgerId: 566,
    name: "Barbell Overhead Press",
    primaryMuscles: ["shoulders"],
    movementPattern: "vertical_push",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
      "wrist_left",
      "wrist_right",
      "core",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "mild" },
      { region: "shoulder_right", minSeverityToExclude: "mild" },
      { region: "lower_back", minSeverityToExclude: "moderate" },
    ],
    substitutes: [
      "landmine_press",
      "dumbbell_lateral_raise",
      "banded_overhead_press",
    ],
    baseIntensityLoad: 1.0,
  },
  landmine_press: {
    id: "landmine_press",
    wgerId: 346,
    name: "Landmine Press",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["chest", "triceps"],
    movementPattern: "vertical_push",
    loadedRegions: ["shoulder_left", "shoulder_right"],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "moderate" },
      { region: "shoulder_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["dumbbell_lateral_raise"],
    baseIntensityLoad: 0.7,
  },
  dumbbell_lateral_raise: {
    id: "dumbbell_lateral_raise",
    wgerId: 348,
    name: "Dumbbell Lateral Raise",
    primaryMuscles: ["shoulders"],
    movementPattern: "vertical_push",
    loadedRegions: ["shoulder_left", "shoulder_right"],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "moderate" },
      { region: "shoulder_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["banded_overhead_press"],
    baseIntensityLoad: 0.3,
  },
  banded_overhead_press: {
    id: "banded_overhead_press",
    wgerId: 687,
    name: "Banded Overhead Press",
    primaryMuscles: ["shoulders"],
    movementPattern: "vertical_push",
    loadedRegions: ["shoulder_left", "shoulder_right"],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "severe" },
      { region: "shoulder_right", minSeverityToExclude: "severe" },
    ],
    substitutes: [],
    baseIntensityLoad: 0.35,
  },

  // ---------- HORIZONTAL PULL ----------
  barbell_row: {
    id: "barbell_row",
    wgerId: 508,
    name: "Barbell Bent-over Row",
    primaryMuscles: ["back"],
    secondaryMuscles: ["quads"],
    movementPattern: "horizontal_pull",
    loadedRegions: [
      "lower_back",
      "wrist_left",
      "wrist_right",
      "elbow_left",
      "elbow_right",
    ],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "moderate" },
      { region: "wrist_left", minSeverityToExclude: "moderate" },
      { region: "wrist_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: [
      "cable_row",
      "chest_supported_row",
      "banded_row",
    ],
    baseIntensityLoad: 1.0,
  },
  cable_row: {
    id: "cable_row",
    wgerId: 2489,
    name: "Cable Row",
    primaryMuscles: ["back"],
    secondaryMuscles: ["biceps", "back"],
    movementPattern: "horizontal_pull",
    loadedRegions: ["wrist_left", "wrist_right", "elbow_left", "elbow_right"],
    contraindications: [
      { region: "wrist_left", minSeverityToExclude: "severe" },
      { region: "wrist_right", minSeverityToExclude: "severe" },
    ],
    substitutes: ["chest_supported_row", "banded_row"],
    baseIntensityLoad: 0.85,
  },
  chest_supported_row: {
    id: "chest_supported_row",
    wgerId: 919,
    name: "Chest-Supported Row",
    primaryMuscles: ["back"],
    movementPattern: "horizontal_pull",
    loadedRegions: ["wrist_left", "wrist_right", "elbow_left", "elbow_right"],
    contraindications: [
      { region: "wrist_left", minSeverityToExclude: "severe" },
      { region: "wrist_right", minSeverityToExclude: "severe" },
    ],
    substitutes: ["banded_row"],
    baseIntensityLoad: 0.75,
  },
  banded_row: {
    id: "banded_row",
    wgerId: 959,
    name: "Banded Row",
    primaryMuscles: ["shoulders", "biceps", "back"],
    movementPattern: "horizontal_pull",
    loadedRegions: [],
    contraindications: [],
    substitutes: [],
    baseIntensityLoad: 0.35,
  },

  // ---------- VERTICAL PULL ----------
  pull_up: {
    id: "pull_up",
    wgerId: 475,
    name: "Pull-up",
    primaryMuscles: ["back"],
    secondaryMuscles: ["shoulders", "biceps", "back"],
    movementPattern: "vertical_pull",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "elbow_left",
      "elbow_right",
      "wrist_left",
      "wrist_right",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "mild" },
      { region: "shoulder_right", minSeverityToExclude: "mild" },
      { region: "elbow_left", minSeverityToExclude: "moderate" },
      { region: "elbow_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: [
      "lat_pulldown",
      "banded_pulldown",
      "inverted_row",
    ],
    baseIntensityLoad: 1.0,
  },
  lat_pulldown: {
    id: "lat_pulldown",
    wgerId: 723,
    name: "Lat Pulldown",
    primaryMuscles: ["back"],
    secondaryMuscles: ["shoulders", "biceps", "chest", "back"],
    movementPattern: "vertical_pull",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "wrist_left",
      "wrist_right",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "moderate" },
      { region: "shoulder_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["banded_pulldown"],
    baseIntensityLoad: 0.85,
  },
  banded_pulldown: {
    id: "banded_pulldown",
    wgerId: 1635,
    name: "Banded Pulldown",
    primaryMuscles: ["back"],
    movementPattern: "vertical_pull",
    loadedRegions: ["shoulder_left", "shoulder_right"],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "severe" },
      { region: "shoulder_right", minSeverityToExclude: "severe" },
    ],
    substitutes: [],
    baseIntensityLoad: 0.35,
  },
  inverted_row: {
    id: "inverted_row",
    wgerId: 1198,
    name: "Inverted Row",
    primaryMuscles: ["biceps", "back"],
    secondaryMuscles: ["chest", "core", "back"],
    movementPattern: "vertical_pull",
    loadedRegions: ["wrist_left", "wrist_right", "elbow_left", "elbow_right"],
    contraindications: [
      { region: "wrist_left", minSeverityToExclude: "moderate" },
      { region: "wrist_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["banded_row"],
    baseIntensityLoad: 0.6,
  },

  // ---------- SQUAT ----------
  back_squat: {
    id: "back_squat",
    wgerId: 615,
    name: "Barbell Back Squat",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes"],
    movementPattern: "squat",
    loadedRegions: [
      "lower_back",
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
    ],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "mild" },
      { region: "knee_left", minSeverityToExclude: "mild" },
      { region: "knee_right", minSeverityToExclude: "mild" },
      { region: "hip_left", minSeverityToExclude: "moderate" },
      { region: "hip_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: [
      "goblet_squat",
      "leg_press",
      "box_squat",
      "bodyweight_squat",
    ],
    baseIntensityLoad: 1.0,
  },
  goblet_squat: {
    id: "goblet_squat",
    wgerId: 203,
    name: "Goblet Squat",
    primaryMuscles: ["quads"],
    movementPattern: "squat",
    loadedRegions: [
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
      "hip_left",
      "hip_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["leg_press", "bodyweight_squat"],
    baseIntensityLoad: 0.7,
  },
  leg_press: {
    id: "leg_press",
    wgerId: 371,
    name: "Leg Press",
    primaryMuscles: ["hamstrings", "calves", "glutes", "quads"],
    movementPattern: "squat",
    loadedRegions: [
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
      { region: "hip_left", minSeverityToExclude: "moderate" },
      { region: "hip_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["bodyweight_squat"],
    baseIntensityLoad: 0.8,
  },
  box_squat: {
    id: "box_squat",
    wgerId: 977,
    name: "Box Squat",
    primaryMuscles: ["glutes", "quads", "calves"],
    movementPattern: "squat",
    loadedRegions: [
      "lower_back",
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
    ],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "moderate" },
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["goblet_squat", "bodyweight_squat"],
    baseIntensityLoad: 0.85,
  },
  bodyweight_squat: {
    id: "bodyweight_squat",
    wgerId: 1312,
    name: "Bodyweight Squat",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["calves", "glutes", "core"],
    movementPattern: "squat",
    loadedRegions: ["knee_left", "knee_right", "ankle_left", "ankle_right"],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "severe" },
      { region: "knee_right", minSeverityToExclude: "severe" },
    ],
    substitutes: [],
    baseIntensityLoad: 0.3,
  },

  // ---------- HINGE ----------
  deadlift: {
    id: "deadlift",
    wgerId: 184,
    name: "Barbell Deadlift",
    primaryMuscles: ["back"],
    secondaryMuscles: ["glutes"],
    movementPattern: "hinge",
    loadedRegions: [
      "lower_back",
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
      "wrist_left",
      "wrist_right",
    ],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "mild" },
      { region: "hamstring_left", minSeverityToExclude: "mild" },
      { region: "hamstring_right", minSeverityToExclude: "mild" },
    ],
    substitutes: [
      "romanian_deadlift",
      "hip_thrust",
      "kettlebell_swing",
      "glute_bridge",
    ],
    baseIntensityLoad: 1.0,
  },
  romanian_deadlift: {
    id: "romanian_deadlift",
    wgerId: 507,
    name: "Romanian Deadlift",
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["back"],
    movementPattern: "hinge",
    loadedRegions: [
      "lower_back",
      "hip_left",
      "hip_right",
      "hamstring_left",
      "hamstring_right",
    ],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "moderate" },
      { region: "hamstring_left", minSeverityToExclude: "moderate" },
      { region: "hamstring_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["hip_thrust", "kettlebell_swing", "glute_bridge"],
    baseIntensityLoad: 0.8,
  },
  hip_thrust: {
    id: "hip_thrust",
    wgerId: 294,
    name: "Barbell Hip Thrust",
    primaryMuscles: ["glutes"],
    movementPattern: "hinge",
    loadedRegions: ["hip_left", "hip_right", "lower_back"],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "severe" },
    ],
    substitutes: ["kettlebell_swing", "glute_bridge"],
    baseIntensityLoad: 0.85,
  },
  kettlebell_swing: {
    id: "kettlebell_swing",
    wgerId: 9,
    name: "Kettlebell Swing",
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["quads", "core"],
    movementPattern: "hinge",
    loadedRegions: [
      "lower_back",
      "hip_left",
      "hip_right",
      "wrist_left",
      "wrist_right",
    ],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["glute_bridge"],
    baseIntensityLoad: 0.7,
  },
  glute_bridge: {
    id: "glute_bridge",
    wgerId: 265,
    name: "Glute Bridge",
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings"],
    movementPattern: "hinge",
    loadedRegions: ["lower_back"],
    contraindications: [],
    substitutes: [],
    baseIntensityLoad: 0.3,
  },

  // ---------- LUNGE ----------
  barbell_lunge: {
    id: "barbell_lunge",
    wgerId: 984,
    name: "Barbell Lunge",
    primaryMuscles: ["glutes", "quads"],
    secondaryMuscles: ["hamstrings"],
    movementPattern: "lunge",
    loadedRegions: [
      "lower_back",
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "mild" },
      { region: "knee_right", minSeverityToExclude: "mild" },
      { region: "hip_left", minSeverityToExclude: "moderate" },
      { region: "hip_right", minSeverityToExclude: "moderate" },
      { region: "ankle_left", minSeverityToExclude: "moderate" },
      { region: "ankle_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: [
      "dumbbell_lunge",
      "step_up",
      "split_squat",
      "bodyweight_lunge",
    ],
    baseIntensityLoad: 1.0,
  },
  dumbbell_lunge: {
    id: "dumbbell_lunge",
    wgerId: 1651,
    name: "Dumbbell Lunge",
    primaryMuscles: ["glutes", "quads"],
    secondaryMuscles: ["calves"],
    movementPattern: "lunge",
    loadedRegions: [
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["step_up", "bodyweight_lunge"],
    baseIntensityLoad: 0.8,
  },
  step_up: {
    id: "step_up",
    wgerId: 981,
    name: "Step-up",
    primaryMuscles: ["glutes", "quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    movementPattern: "lunge",
    loadedRegions: [
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
      "hip_left",
      "hip_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
      { region: "ankle_left", minSeverityToExclude: "severe" },
      { region: "ankle_right", minSeverityToExclude: "severe" },
    ],
    substitutes: ["bodyweight_lunge"],
    baseIntensityLoad: 0.7,
  },
  split_squat: {
    id: "split_squat",
    wgerId: 1366,
    name: "Split Squat",
    primaryMuscles: ["glutes", "quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    movementPattern: "lunge",
    loadedRegions: [
      "hip_left",
      "hip_right",
      "knee_left",
      "knee_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["bodyweight_lunge"],
    baseIntensityLoad: 0.7,
  },
  bodyweight_lunge: {
    id: "bodyweight_lunge",
    wgerId: 1324,
    name: "Bodyweight Lunge",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes", "calves"],
    movementPattern: "lunge",
    loadedRegions: ["knee_left", "knee_right", "ankle_left", "ankle_right"],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "severe" },
      { region: "knee_right", minSeverityToExclude: "severe" },
    ],
    substitutes: [],
    baseIntensityLoad: 0.35,
  },

  // ---------- CORE ----------
  plank: {
    id: "plank",
    wgerId: 458,
    name: "Plank",
    primaryMuscles: ["core"],
    secondaryMuscles: ["biceps", "quads", "triceps"],
    movementPattern: "core_stability",
    loadedRegions: ["wrist_left", "wrist_right", "lower_back"],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "severe" },
      { region: "wrist_left", minSeverityToExclude: "moderate" },
      { region: "wrist_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["dead_bug", "bird_dog"],
    baseIntensityLoad: 0.3,
  },
  dead_bug: {
    id: "dead_bug",
    wgerId: 2505,
    name: "Dead Bug",
    primaryMuscles: ["core"],
    secondaryMuscles: ["core"],
    movementPattern: "core_stability",
    loadedRegions: ["lower_back"],
    contraindications: [],
    substitutes: [],
    baseIntensityLoad: 0.2,
  },
  bird_dog: {
    id: "bird_dog",
    wgerId: 1572,
    name: "Bird Dog",
    primaryMuscles: ["core"],
    secondaryMuscles: ["shoulders", "glutes"],
    movementPattern: "core_stability",
    loadedRegions: ["lower_back"],
    contraindications: [
      { region: "lower_back", minSeverityToExclude: "severe" },
    ],
    substitutes: ["dead_bug"],
    baseIntensityLoad: 0.2,
  },

  // ---------- CARRY ----------
  farmers_walk: {
    id: "farmers_walk",
    wgerId: 1116,
    name: "Farmer's Walk",
    primaryMuscles: ["forearms", "core", "full_body"],
    movementPattern: "carry",
    loadedRegions: [
      "wrist_left",
      "wrist_right",
      "shoulder_left",
      "shoulder_right",
      "lower_back",
    ],
    contraindications: [
      { region: "wrist_left", minSeverityToExclude: "moderate" },
      { region: "wrist_right", minSeverityToExclude: "moderate" },
      { region: "lower_back", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["single_arm_carry"],
    baseIntensityLoad: 0.7,
  },
  single_arm_carry: {
    id: "single_arm_carry",
    wgerId: 1776,
    name: "Single-Arm Carry",
    primaryMuscles: ["core"],
    secondaryMuscles: ["core", "back"],
    movementPattern: "carry",
    loadedRegions: ["wrist_left", "wrist_right"],
    contraindications: [
      { region: "wrist_left", minSeverityToExclude: "severe" },
      { region: "wrist_right", minSeverityToExclude: "severe" },
    ],
    substitutes: [],
    baseIntensityLoad: 0.5,
  },

  // ---------- GAIT ----------
  running: {
    id: "running",
    wgerId: 908,
    name: "Running",
    primaryMuscles: ["quads", "hamstrings", "calves", "glutes"],
    movementPattern: "gait",
    loadedRegions: [
      "knee_left",
      "knee_right",
      "ankle_left",
      "ankle_right",
      "hip_left",
      "hip_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "mild" },
      { region: "knee_right", minSeverityToExclude: "mild" },
      { region: "ankle_left", minSeverityToExclude: "mild" },
      { region: "ankle_right", minSeverityToExclude: "mild" },
      { region: "hip_left", minSeverityToExclude: "moderate" },
      { region: "hip_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["cycling", "swimming", "walking"],
    baseIntensityLoad: 0.8,
  },
  cycling: {
    id: "cycling",
    wgerId: 177,
    name: "Cycling",
    primaryMuscles: ["core", "back"],
    secondaryMuscles: ["hamstrings", "biceps", "glutes", "back", "quads"],
    movementPattern: "gait",
    loadedRegions: [
      "knee_left",
      "knee_right",
      "hip_left",
      "hip_right",
    ],
    contraindications: [
      { region: "knee_left", minSeverityToExclude: "moderate" },
      { region: "knee_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["swimming", "walking"],
    baseIntensityLoad: 0.5,
  },
  swimming: {
    id: "swimming",
    wgerId: 961,
    name: "Swimming",
    primaryMuscles: ["full_body"],
    movementPattern: "gait",
    loadedRegions: [
      "shoulder_left",
      "shoulder_right",
      "knee_left",
      "knee_right",
    ],
    contraindications: [
      { region: "shoulder_left", minSeverityToExclude: "moderate" },
      { region: "shoulder_right", minSeverityToExclude: "moderate" },
    ],
    substitutes: ["walking"],
    baseIntensityLoad: 0.6,
  },
  walking: {
    id: "walking",
    wgerId: 1104,
    name: "Walking",
    primaryMuscles: ["hamstrings", "calves", "glutes", "back", "core", "quads"],
    movementPattern: "gait",
    loadedRegions: ["ankle_left", "ankle_right"],
    contraindications: [],
    substitutes: [],
    baseIntensityLoad: 0.2,
  },
};

// ============================================================
// Injury Adjustment Engine
// ============================================================

/**
 * Determine whether an exercise should be excluded or substituted
 * based on a list of active injuries.
 */
export function evaluateInjuryRules(
  exerciseId: string,
  injuries: InjuryReport[],
): AdjustmentAction | null {
  const exercise = EXERCISE_MAP[exerciseId];
  if (!exercise) return null;

  const activeInjuries = injuries.filter(
    (i) => i.status === "active" || i.status === "healing",
  );
  if (activeInjuries.length === 0) return null;

  // Check each contraindication against active injuries
  let shouldExclude = false;
  let excludeReason = "";

  for (const ci of exercise.contraindications) {
    for (const injury of activeInjuries) {
      // Check if this injury matches the contraindicated region (including left/right)
      const regionMatch =
        sameGenericRegion(ci.region, injury.region) ||
        ci.region === injury.region;

      if (regionMatch && severityAtLeast(injury.severity, ci.minSeverityToExclude)) {
        shouldExclude = true;
        const regionLabel = BODY_REGION_LABELS[injury.region] || injury.region;
        excludeReason = `${regionLabel} injury (${injury.status}, ${injury.severity})`;
        break;
      }
    }
    if (shouldExclude) break;
  }

  if (!shouldExclude) return null;

  // Try to find a safe substitute
  let replacementId: string | undefined;
  let substituteFound = false;

  for (const subId of exercise.substitutes) {
    const sub = EXERCISE_MAP[subId];
    if (!sub) continue;

    // Check if this substitute is safe for all active injuries
    let subSafe = true;
    for (const ci of sub.contraindications) {
      for (const injury of activeInjuries) {
        const regionMatch =
          sameGenericRegion(ci.region, injury.region) ||
          ci.region === injury.region;
        if (regionMatch && severityAtLeast(injury.severity, ci.minSeverityToExclude)) {
          subSafe = false;
          break;
        }
      }
      if (!subSafe) break;
    }

    if (subSafe) {
      replacementId = subId;
      substituteFound = true;
      break;
    }
  }

  if (substituteFound) {
    return {
      sessionId: "",
      exerciseId,
      reasonType: "injury_substitution",
      reasonDetail: `Swapped due to ${excludeReason}`,
      replacementExerciseId: replacementId,
      removed: false,
    };
  }

  // No safe substitute found — remove the exercise
  return {
    sessionId: "",
    exerciseId,
    reasonType: "injury_exclusion",
    reasonDetail: `Removed due to ${excludeReason} — no safe alternative available`,
    removed: true,
  };
}

/**
 * Check if an exercise matches any pain-trigger movement patterns
 * reported by the user.
 */
export function matchesPainTriggers(
  exerciseId: string,
  injuries: InjuryReport[],
): boolean {
  const exercise = EXERCISE_MAP[exerciseId];
  if (!exercise) return false;

  return injuries.some((injury) => {
    if (!injury.painTriggerMovements?.length) return false;
    if (injury.status === "cleared") return false;
    return injury.painTriggerMovements.includes(exercise.movementPattern);
  });
}

// ============================================================
// Recovery / Readiness Engine
// ============================================================

/**
 * Compute a simple readiness score from recent check-ins.
 * Returns 0-100 (100 = fully ready).
 */
export function computeReadinessScore(
  checkIns: DailyCheckIn[],
  wearable?: { restingHeartRate?: number; hrvMs?: number },
  now: Date = new Date(),
): ReadinessScore {
  if (checkIns.length === 0) {
    return {
      userId: "",
      date: now.toISOString().slice(0, 10),
      score: 75, // default moderate readiness
      inputsUsed: [],
      computedAt: now.toISOString(),
    };
  }

  const latest = checkIns[0];
  const avgSoreness =
    checkIns.reduce((sum, c) => sum + c.sorenessScore, 0) / checkIns.length;

  // Soreness: 1 = great (90), 5 = terrible (30)
  const sorenessComponent = 100 - ((avgSoreness - 1) / 4) * 60;

  // Sleep: 7-9 hours optimal
  const avgSleep =
    checkIns.filter((c) => c.sleepHours != null).reduce((sum, c) => sum + (c.sleepHours ?? 7), 0) /
    Math.max(checkIns.filter((c) => c.sleepHours != null).length, 1);
  const sleepComponent = Math.min(100, Math.max(0, (avgSleep / 8) * 100));

  // Stress: 1 = low stress (90), 5 = high stress (30)
  const avgStress =
    checkIns.filter((c) => c.stressLevel != null).reduce((sum, c) => sum + (c.stressLevel ?? 3), 0) /
    Math.max(checkIns.filter((c) => c.stressLevel != null).length, 1);
  const stressComponent = 100 - ((avgStress - 1) / 4) * 60;

  // Weighted average
  let score = sorenessComponent * 0.4 + sleepComponent * 0.3 + stressComponent * 0.3;
  const inputsUsed: ("checkin" | "wearable")[] = ["checkin"];

  // Optional wearable boost/penalty
  if (wearable) {
    if (wearable.hrvMs != null) {
      // HRV > 50ms is good, < 30ms is poor
      const hrvComponent = Math.min(100, Math.max(0, ((wearable.hrvMs - 20) / 60) * 100));
      score = score * 0.8 + hrvComponent * 0.2;
      inputsUsed.push("wearable");
    }
  }

  return {
    userId: latest.userId,
    date: latest.date,
    score: Math.round(Math.min(100, Math.max(0, score))),
    inputsUsed,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Evaluate readiness-based adjustments for an exercise.
 * Returns load/volume multipliers (not substitutions — that's the injury engine's job).
 */
export function evaluateRecoveryRules(
  exercise: ExerciseWithContraindications,
  readiness: ReadinessScore | undefined,
): { loadMultiplier: number; volumeMultiplier: number; reasonType: AdjustmentReasonType; reasonDetail: string } | null {
  if (!readiness) return null;

  const score = readiness.score;

  // Very low readiness: reduce both load and volume significantly
  if (score < 35) {
    return {
      loadMultiplier: 0.7,
      volumeMultiplier: 0.6,
      reasonType: "recovery_intensity_reduction",
      reasonDetail: `Low readiness (${score}/100) — reduced intensity and volume`,
    };
  }

  // Below moderate: reduce load slightly
  if (score < 55) {
    return {
      loadMultiplier: 0.85,
      volumeMultiplier: 0.8,
      reasonType: "recovery_intensity_reduction",
      reasonDetail: `Moderate readiness (${score}/100) — reduced intensity`,
    };
  }

  // Below good: minor volume reduction
  if (score < 70) {
    return {
      loadMultiplier: 0.95,
      volumeMultiplier: 0.85,
      reasonType: "recovery_volume_reduction",
      reasonDetail: `Readiness ${score}/100 — slightly reduced volume`,
    };
  }

  // Good readiness: no adjustment
  return null;
}

// ============================================================
// Full Plan Adjustment Pipeline
// ============================================================

export function generateAdjustedPlan(context: AdjustmentContext): AdjustedPlan {
  const { activeInjuries, latestReadiness, originalPlan } = context;
  const actions: AdjustmentAction[] = [];

  const adjustedSessions: WorkoutSession[] = originalPlan.sessions.map(
    (session) => {
      const adjustedExercises: PlannedSet[] = [];

      for (const set of session.exercises) {
        // 1. Injury engine: should we exclude or substitute?
        const injuryAction = evaluateInjuryRules(set.exerciseId, activeInjuries);

        // 2. Also check pain trigger movements
        const painTrigger = matchesPainTriggers(set.exerciseId, activeInjuries);

        let finalExerciseId = set.exerciseId;
        let removed = false;
        let finalLoad = set.targetLoadPercent;
        let finalSets = set.targetSets;
        let finalReps = set.targetReps;

        if (injuryAction) {
          actions.push({ ...injuryAction, sessionId: session.id });

          if (injuryAction.removed) {
            removed = true;
          } else if (injuryAction.replacementExerciseId) {
            finalExerciseId = injuryAction.replacementExerciseId;
          }
        } else if (painTrigger) {
          // Exercise triggers pain in a reported movement — try substituting
          const exercise = EXERCISE_MAP[set.exerciseId];
          if (exercise?.substitutes.length) {
            // Pick first safe substitute
            for (const subId of exercise.substitutes) {
              const sub = EXERCISE_MAP[subId];
              if (!sub) continue;
              const subAction = evaluateInjuryRules(subId, activeInjuries);
              if (!subAction) {
                finalExerciseId = subId;
                actions.push({
                  sessionId: session.id,
                  exerciseId: set.exerciseId,
                  reasonType: "injury_substitution",
                  reasonDetail: `Swapped to avoid pain trigger`,
                  replacementExerciseId: subId,
                  removed: false,
                });
                break;
              }
            }
          }
        }

        // 3. Recovery engine: scale load/volume if readiness is low
        if (!removed) {
          const exercise = EXERCISE_MAP[finalExerciseId];
          if (exercise) {
            const recovery = evaluateRecoveryRules(exercise, latestReadiness);
            if (recovery) {
              if (recovery.loadMultiplier < 1 && finalLoad != null) {
                finalLoad = Math.round(finalLoad * recovery.loadMultiplier);
              }
              if (recovery.volumeMultiplier < 1) {
                finalSets = Math.max(1, Math.round(finalSets * recovery.volumeMultiplier));
                finalReps = Math.max(1, Math.round(finalReps * recovery.volumeMultiplier));
              }
              actions.push({
                sessionId: session.id,
                exerciseId: finalExerciseId,
                reasonType: recovery.reasonType,
                reasonDetail: recovery.reasonDetail,
                removed: false,
                loadMultiplier: recovery.loadMultiplier,
                volumeMultiplier: recovery.volumeMultiplier,
              });
            }
          }
        }

        if (!removed) {
          adjustedExercises.push({
            ...set,
            exerciseId: finalExerciseId,
            targetSets: finalSets,
            targetReps: finalReps,
            targetLoadPercent: finalLoad,
          });
        }
      }

      return { ...session, exercises: adjustedExercises };
    },
  );

  const hasSevereActive = activeInjuries.some(
    (i) => i.status === "active" && i.severity === "severe",
  );

  return {
    id: `adj_${Date.now()}`,
    basePlanId: originalPlan.id,
    userId: context.userId,
    generatedAt: new Date().toISOString(),
    actions,
    resultingPlan: {
      ...originalPlan,
      sessions: adjustedSessions,
      updatedAt: new Date().toISOString(),
    },
    requiresMedicalDisclaimer: hasSevereActive,
  };
}

// ============================================================
// Client-side API Helpers
// ============================================================

const API_BASE = "/api/injury";

export async function fetchInjuries(): Promise<InjuryReport[]> {
  const res = await fetch(`${API_BASE}/injuries`);
  if (!res.ok) throw new Error("Failed to fetch injuries");
  return res.json();
}

export async function createInjury(
  injury: Omit<InjuryReport, "id" | "reportedAt" | "updatedAt" | "medicalGuidanceShown">,
): Promise<InjuryReport> {
  const res = await fetch(`${API_BASE}/injuries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(injury),
  });
  if (!res.ok) throw new Error("Failed to create injury");
  return res.json();
}

export async function updateInjury(
  id: string,
  updates: Partial<InjuryReport>,
): Promise<InjuryReport> {
  const res = await fetch(`${API_BASE}/injuries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update injury");
  return res.json();
}

export async function deleteInjury(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/injuries/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete injury");
}

export async function fetchCheckIns(): Promise<DailyCheckIn[]> {
  const res = await fetch(`${API_BASE}/checkins`);
  if (!res.ok) throw new Error("Failed to fetch check-ins");
  return res.json();
}

export async function createCheckIn(
  checkIn: Omit<DailyCheckIn, "id">,
): Promise<DailyCheckIn> {
  const res = await fetch(`${API_BASE}/checkins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkIn),
  });
  if (!res.ok) throw new Error("Failed to create check-in");
  return res.json();
}
