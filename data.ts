// ============================================================
// FitPulse — Injury/Recovery-Aware Plan Adjustments
// TypeScript Data Schema
// ============================================================

// ------------------------------------------------------------
// 1. Enums / Literal Types
// ------------------------------------------------------------

export type BodyRegion =
  | "neck"
  | "shoulder_left"
  | "shoulder_right"
  | "elbow_left"
  | "elbow_right"
  | "wrist_left"
  | "wrist_right"
  | "upper_back"
  | "lower_back"
  | "chest"
  | "core"
  | "hip_left"
  | "hip_right"
  | "knee_left"
  | "knee_right"
  | "ankle_left"
  | "ankle_right"
  | "foot_left"
  | "foot_right"
  | "hamstring_left"
  | "hamstring_right"
  | "quad_left"
  | "quad_right"
  | "calf_left"
  | "calf_right";

export type InjuryType = "acute" | "chronic";

export type InjuryStatus = "active" | "healing" | "cleared";

export type InjurySeverity = "mild" | "moderate" | "severe";

export type MovementPattern =
  | "horizontal_push"
  | "horizontal_pull"
  | "vertical_push"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "rotation"
  | "core_stability"
  | "gait"; // walking/running

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "full_body";

// ------------------------------------------------------------
// 2. Injury Reporting
// ------------------------------------------------------------

export interface InjuryReport {
  id: string;
  userId: string;
  region: BodyRegion;
  type: InjuryType;
  severity: InjurySeverity;
  status: InjuryStatus;
  painScore?: number; // 0-10, optional self-rated
  painTriggerMovements?: MovementPattern[]; // e.g. pain on "vertical_push"
  notes?: string; // free text from user
  reportedAt: string; // ISO date
  updatedAt: string; // ISO date
  clearedAt?: string; // ISO date, set when status -> "cleared"
  medicalGuidanceShown: boolean; // did we prompt "see a professional"?
}

// ------------------------------------------------------------
// 3. Recovery / Readiness Signals
// ------------------------------------------------------------

export interface DailyCheckIn {
  id: string;
  userId: string;
  date: string; // ISO date (day granularity)
  sorenessScore: number; // 1-5, 5 = very sore
  sleepHours?: number;
  sleepQuality?: number; // 1-5
  stressLevel?: number; // 1-5
  energyLevel?: number; // 1-5
  source: "manual" | "wearable_sync";
}

export interface WearableMetrics {
  id: string;
  userId: string;
  date: string;
  provider: "apple_health" | "google_fit" | "whoop" | "oura" | "garmin";
  restingHeartRate?: number;
  hrvMs?: number; // heart rate variability, milliseconds
  sleepDurationMinutes?: number;
  sleepScore?: number; // provider-normalized 0-100 if available
}

export interface ReadinessScore {
  userId: string;
  date: string;
  score: number; // normalized 0-100, computed from check-in + wearable
  inputsUsed: ("checkin" | "wearable" | "training_load")[];
  computedAt: string;
}

// ------------------------------------------------------------
// 4. Exercise Library (with injury/contraindication tagging)
// ------------------------------------------------------------

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  movementPattern: MovementPattern;
  loadedRegions: BodyRegion[]; // joints/areas under mechanical stress
  equipment: string[]; // e.g. ["barbell"], ["bodyweight"]
  // Regions where this exercise should be avoided/modified if injured there
  contraindications: {
    region: BodyRegion;
    minSeverityToExclude: InjurySeverity; // exclude if severity >= this
  }[];
  // Ranked list of safer alternatives, easiest/safest first
  substitutes: string[]; // Exercise ids
  baseIntensityLoad: number; // relative loading factor, used for volume scaling
}

// ------------------------------------------------------------
// 5. Training Plan Structures
// ------------------------------------------------------------

export interface PlannedSet {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetLoadPercent?: number; // % of 1RM, if applicable
  restSeconds: number;
}

export interface WorkoutSession {
  id: string;
  planId: string;
  dayIndex: number; // position within the plan/week
  title: string;
  exercises: PlannedSet[];
}

export interface TrainingPlan {
  id: string;
  userId: string;
  name: string;
  sessions: WorkoutSession[];
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// 6. Adjustment Engine — Inputs & Outputs
// ------------------------------------------------------------

export interface AdjustmentContext {
  userId: string;
  activeInjuries: InjuryReport[]; // status: active or healing only
  latestReadiness?: ReadinessScore;
  recentCheckIns: DailyCheckIn[]; // e.g. last 7 days
  originalPlan: TrainingPlan;
}

export type AdjustmentReasonType =
  | "injury_exclusion"
  | "injury_substitution"
  | "recovery_intensity_reduction"
  | "recovery_volume_reduction"
  | "return_from_break";

export interface AdjustmentAction {
  sessionId: string;
  exerciseId: string; // original exercise
  reasonType: AdjustmentReasonType;
  reasonDetail: string; // human-readable: "Shoulder injury (active, moderate)"
  replacementExerciseId?: string; // set if substituted
  loadMultiplier?: number; // e.g. 0.85 = reduce load by 15%
  volumeMultiplier?: number; // e.g. 0.8 = reduce sets/reps by 20%
  removed: boolean; // true if exercise was dropped entirely
}

export interface AdjustedPlan {
  id: string;
  basePlanId: string;
  userId: string;
  generatedAt: string;
  actions: AdjustmentAction[];
  resultingPlan: TrainingPlan; // final plan after applying actions
  requiresMedicalDisclaimer: boolean; // true if any severe/active injury involved
}

// ------------------------------------------------------------
// 7. Rules Engine Function Signatures (implementation elsewhere)
// ------------------------------------------------------------

export type InjuryRule = (
  exercise: Exercise,
  injuries: InjuryReport[]
) => AdjustmentAction | null;

export type RecoveryRule = (
  exercise: Exercise,
  readiness: ReadinessScore | undefined,
  checkIns: DailyCheckIn[]
) => AdjustmentAction | null;

export interface AdjustmentEngineConfig {
  injuryRules: InjuryRule[];
  recoveryRules: RecoveryRule[];
  readinessThresholds: {
    reduceIntensityBelow: number; // e.g. 50
    reduceVolumeBelow: number; // e.g. 35
    suggestRestBelow: number; // e.g. 20
  };
}