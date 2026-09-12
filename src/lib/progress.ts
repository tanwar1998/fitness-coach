import type { GeneratedWorkout } from "@/lib/workout-generator";

export interface GoalHistoryEntry {
  id: string;
  date: string;
  value: number;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  category: string;
  unit: string;
  current: number;
  target: number;
  weekly: string;
  progress: number;
  status: "active" | "achieved" | "archived";
  createdAt: string;
  updatedAt: string;
  history: GoalHistoryEntry[];
}

export type GoalInput = Pick<
  Goal,
  "name" | "category" | "unit" | "current" | "target" | "weekly"
>;

const API_BASE = "/api/progress/goals";

export async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch(API_BASE, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch goals");
  return res.json();
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create goal");
  return res.json();
}

export type GoalCheckInResponse = Goal & {
  checkIn?: GoalHistoryEntry;
};

export async function checkInGoal(
  id: string,
  value: number,
): Promise<GoalCheckInResponse> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("Failed to check in");
  return res.json();
}

export async function deleteGoal(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete goal");
}

export async function archiveGoal(id: string): Promise<Goal> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "archived" }),
  });
  if (!res.ok) throw new Error("Failed to archive goal");
  return res.json();
}

// ============================================================
// Completed workout logs (auto-log from the workout session)
// ============================================================

export interface ProgressStats {
  streak: number;
  workoutsCompleted: number;
  weeklyDaysThisWeek: number;
  heatmapDays: string[];
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  goal: string;
  level: string;
  durationMinutes: number;
  preset: string;
  exerciseCount: number;
  completedAt: string;
  undoable: boolean;
  updatedGoals: { goalId: string; goalName: string }[];
}

export interface GoalUpdate {
  goalId: string;
  goalName: string;
  unit: string;
  status: "updated" | "no_change";
  value?: number;
  reason: string;
}

export interface LogWorkoutResponse {
  log: WorkoutLog | null;
  stats: ProgressStats;
  goalUpdates: GoalUpdate[];
}

export interface WorkoutLogsResponse {
  logs: WorkoutLog[];
  stats: ProgressStats;
}

export interface UndoWorkoutResponse {
  ok: boolean;
  stats: ProgressStats;
  goals: { id: string; progress: number; status: string }[];
}

const WORKOUTS_BASE = "/api/progress/workouts";

export async function logWorkout(
  workout: GeneratedWorkout,
): Promise<LogWorkoutResponse> {
  const res = await fetch(WORKOUTS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workout }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? "Failed to log workout");
  }
  return res.json();
}

export async function fetchWorkoutLogs(): Promise<WorkoutLogsResponse> {
  const res = await fetch(WORKOUTS_BASE, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch workout logs");
  return res.json();
}

export async function undoWorkoutLog(id: string): Promise<UndoWorkoutResponse> {
  const res = await fetch(`${WORKOUTS_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? "Could not undo workout");
  }
  return res.json();
}