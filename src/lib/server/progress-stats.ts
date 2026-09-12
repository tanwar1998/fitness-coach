export interface ProgressStats {
  streak: number;
  workoutsCompleted: number;
  weeklyDaysThisWeek: number;
  heatmapDays: string[];
}

function dayKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function shiftDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function currentWeekStartKey(now: Date): string {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - now.getUTCDay());
  return dayKey(start);
}

/** Server-computed streak/heatmap stats, derived from completed workout logs.
 *  Day boundaries are UTC, matching the dates stored in workout_logs. */
export function computeStats(
  logs: { completedOn: string }[],
  now: Date = new Date(),
): ProgressStats {
  const days = new Set<string>();
  for (const log of logs) {
    if (log.completedOn) days.add(log.completedOn);
  }

  const todayKey = dayKey(now);
  const startKey = days.has(todayKey) ? todayKey : dayKey(shiftDays(now, -1));

  let streak = 0;
  if (days.has(startKey)) {
    let current = shiftDays(now, startKey === todayKey ? 0 : -1);
    for (let i = 0; i < 365; i++) {
      if (days.has(dayKey(current))) {
        streak += 1;
        current = shiftDays(current, -1);
      } else {
        break;
      }
    }
  }

  const weekStartKey = currentWeekStartKey(now);
  let weeklyDaysThisWeek = 0;
  for (const key of days) {
    if (key >= weekStartKey && key <= todayKey) weeklyDaysThisWeek += 1;
  }

  return {
    streak,
    workoutsCompleted: logs.length,
    weeklyDaysThisWeek,
    heatmapDays: [...days].sort(),
  };
}