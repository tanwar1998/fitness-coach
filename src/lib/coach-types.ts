/**
 * Shared types for the AI Coach's ask-answer/replan loop. Kept framework-free so
 * both the server graph and the React client import the same shapes.
 */

export type CoachAction = "ask_question" | "ask_options" | "finish";

/** One exercise in the current day's plan. exerciseId references the wger
 *  exercise library (see data/exercise-index.json); 0 marks a legacy/curated
 *  exercise that was not resolvable to a wger id. */
export interface WorkoutPlanItem {
  exerciseId: number;
  name: string;
  sets: number;
  reps: string;
  notes: string;
}

export interface WorkoutPlan {
  date: string;
  items: WorkoutPlanItem[];
  /** Non-null exactly when the plan was actually adjusted for this session. */
  adjustedReason: string | null;
}

export interface CoachConstraints {
  energy: "low" | "normal" | "high" | null;
  painFlag: boolean;
  painNote: string | null;
  timeAvailableMin: number | null;
}

/** A paused coach question surfaced to the UI (options or free-text). */
export interface CoachQuestion {
  action: "ask_question" | "ask_options";
  question: string;
  options: string[];
}

/** Normalized result returned by POST /api/coach/message and /api/coach/answer. */
export interface CoachTurnResult {
  threadId: string;
  /** Text of the assistant's latest bubble (reply or the asked question). */
  reply: string;
  /** What the assistant is doing after this turn. */
  action: CoachAction;
  question: string | null;
  options: string[];
  referencedExerciseIds: number[];
  currentPlan: WorkoutPlan | null;
  /** True when this turn changed today's plan (drives PlanChangeBanner). */
  planChanged: boolean;
  /** True when the graph is paused awaiting the user's next answer. */
  interrupted: boolean;
  /** True when the turn was handed to a human coach (safety gate). */
  yieldedToHuman: boolean;
}