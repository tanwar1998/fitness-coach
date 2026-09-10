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