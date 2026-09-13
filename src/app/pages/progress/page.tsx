"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { RecoveryCard } from "@/components/progress/RecoveryCard";
import { WearableCard } from "@/components/progress/WearableCard";
import {
  fetchGoals,
  createGoal,
  checkInGoal,
  archiveGoal,
  fetchWorkoutLogs,
  undoWorkoutLog,
  type Goal,
  type ProgressStats,
  type WorkoutLog,
} from "@/lib/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const WEEKLY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "2", label: "2 days" },
  { value: "3", label: "3 days" },
  { value: "4", label: "4 days" },
  { value: "5", label: "5 days" },
  { value: "6", label: "6 days" },
  { value: "7", label: "7 days" },
];

const UNIT_OPTIONS = [
  { value: "kg", label: "kg" },
  { value: "lbs", label: "lbs" },
  { value: "km", label: "km" },
  { value: "miles", label: "miles" },
  { value: "%", label: "%" },
  { value: "reps", label: "reps" },
  { value: "days", label: "days" },
];

const CATEGORY_PRESETS = [
  { name: "Body Weight", icon: "⚖️", defaultUnit: "kg", currentPlaceholder: "85", targetPlaceholder: "78" },
  { name: "Strength PR", icon: "🏋️", defaultUnit: "kg", currentPlaceholder: "80", targetPlaceholder: "100" },
  { name: "Distance / Endurance", icon: "🏃", defaultUnit: "km", currentPlaceholder: "5", targetPlaceholder: "10" },
  { name: "Weekly Consistency", icon: "🎯", defaultUnit: "days", currentPlaceholder: "3", targetPlaceholder: "5" },
];

const EMPTY_STATS: ProgressStats = {
  streak: 0,
  workoutsCompleted: 0,
  weeklyDaysThisWeek: 0,
  heatmapDays: [],
};

function RingChart({ progress, size = 120 }: { progress: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

function CalendarHeatmap({ workoutDays }: { workoutDays: string[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = cursor.getDay();

  const todayKey = now.toISOString().split("T")[0];

  const cellDays: (string | null)[] = Array.from(
    { length: firstWeekday },
    () => null,
  );
  for (let d = 1; d <= daysInMonth; d++) {
    cellDays.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }

  const monthWorkoutCount = cellDays.filter(
    (k) => k !== null && workoutDays.includes(k),
  ).length;

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cellDays.length; i += 7) {
    weeks.push(cellDays.slice(i, i + 7));
  }

  const canPrev = monthOffset > -11;
  const canNext = monthOffset < 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
        <div className="flex items-center gap-1">
          {monthWorkoutCount > 0 && (
            <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {monthWorkoutCount} workout{monthWorkoutCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMonthOffset((o) => o - 1)}
            disabled={!canPrev}
            aria-label="Previous month"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((o) => o + 1)}
            disabled={!canNext}
            aria-label="Next month"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-0.5">
        {dayLabels.map((label, i) => (
          <div
            key={i}
            className="flex h-5 w-5 items-center justify-center text-[10px] text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((row, wi) => (
        <div key={wi} className="flex gap-0.5">
          {row.map((key, i) => {
            if (key === null) return <div key={i} className="h-5 w-5" />;
            const dayNumber = Number(key.slice(8));
            const hasWorkout = workoutDays.includes(key);
            const isToday = key === todayKey;
            const isFuture = key > todayKey;
            const className = `flex h-5 w-5 items-center justify-center rounded-sm text-[10px] transition-colors ${
              isFuture
                ? "bg-transparent text-muted-foreground/30"
                : hasWorkout
                  ? "bg-primary font-semibold text-primary-foreground"
                  : isToday
                    ? "border border-primary bg-card text-foreground"
                    : "bg-muted text-muted-foreground"
            } ${isToday ? "ring-1 ring-primary" : ""}`;
            return (
              <div
                key={key}
                className={className}
                title={`${new Date(
                  year,
                  month,
                  dayNumber,
                ).toLocaleDateString("en-US")}${
                  hasWorkout ? " — workout completed" : ""
                }`}
              >
                {dayNumber}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function InsightRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-base" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </li>
  );
}

function InsightsPanel({ workoutDays }: { workoutDays: string[] }) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const monthCounts = new Map<string, number>();
  const weekdayCounts = new Map<number, number>();
  for (const day of workoutDays) {
    const key = day.slice(0, 7);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    const [yy, mm, dd] = day.split("-").map(Number);
    const weekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  }

  const thisMonthCount = monthCounts.get(thisMonth) ?? 0;
  const lastMonthCount = monthCounts.get(lastMonth) ?? 0;

  let bestMonthKey: string | null = null;
  let bestMonthCount = 0;
  for (const [key, count] of monthCounts) {
    if (count > bestMonthCount) {
      bestMonthCount = count;
      bestMonthKey = key;
    }
  }
  const bestMonthLabel = bestMonthKey
    ? new Date(`${bestMonthKey}-01T00:00:00Z`)
        .toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let bestWeekday: number | null = null;
  let bestWeekdayCount = 0;
  for (const [wd, count] of weekdayCounts) {
    if (count > bestWeekdayCount) {
      bestWeekdayCount = count;
      bestWeekday = wd;
    }
  }

  const hasData = workoutDays.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">At a glance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Finish your first workout and your activity insights will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-bold text-foreground">At a glance</h2>
      <p className="text-sm text-muted-foreground">Your consistency at a glance</p>
      <ul className="mt-4 space-y-2">
        <InsightRow
          icon="📅"
          label="This month"
          value={`${thisMonthCount} workout${thisMonthCount === 1 ? "" : "s"}`}
        />
        <InsightRow
          icon="🗓️"
          label="Last month"
          value={`${lastMonthCount} workout${lastMonthCount === 1 ? "" : "s"}`}
        />
        {bestMonthLabel && (
          <InsightRow
            icon="🏆"
            label="Best month"
            value={`${bestMonthLabel} · ${bestMonthCount}`}
          />
        )}
        {bestWeekday !== null && (
          <InsightRow
            icon="🔥"
            label="Most active day"
            value={`${WEEKDAY_LABELS[bestWeekday]} · ${bestWeekdayCount}`}
          />
        )}
        <InsightRow
          icon="✅"
          label="Total active days"
          value={`${workoutDays.length}`}
        />
      </ul>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  children,
}: {
  title: string;
  value: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-center gap-3">
        {children}
        <div>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function GoalChart({ goal }: { goal: Goal }) {
  const data = goal.history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: h.value,
  }));

  if (data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="px-6 text-center text-xs text-muted-foreground">
          Check in or complete matching workouts to see your trend.
        </p>
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "currentColor" }}
            className="text-muted-foreground"
            interval="preserveStartEnd"
            tickMargin={4}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            className="text-muted-foreground"
            domain={["auto", "auto"]}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: "var(--primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GoalCard({
  goal,
  onCheckIn,
  onArchive,
  onSetNewGoal,
}: {
  goal: Goal;
  onCheckIn: (id: string, newValue: number) => void;
  onArchive: (id: string) => void;
  onSetNewGoal: () => void;
}) {
  const [checkInValue, setCheckInValue] = useState("");

  const latestValue = goal.history[goal.history.length - 1]?.value ?? goal.current;
  const reached = goal.status === "achieved";
  const toGo = latestValue - goal.target;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">{goal.category}</Badge>
            {reached && (
              <Badge variant="success">✓ Goal reached</Badge>
            )}
          </div>
          <h3 className="text-lg font-bold text-foreground">{goal.name}</h3>
        </div>
        <span className="text-sm text-muted-foreground">{goal.unit}</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{goal.progress}%</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                reached ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, goal.progress)}%` }}
            />
          </div>
        </div>
        <RingChart progress={goal.progress} size={80} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-muted p-3">
          <p className="text-lg font-bold text-foreground">{latestValue} {goal.unit}</p>
          <p className="text-xs text-muted-foreground">Current</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-lg font-bold text-primary">{goal.target} {goal.unit}</p>
          <p className="text-xs text-muted-foreground">Target</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-lg font-bold text-foreground">
            {reached ? 0 : Math.abs(toGo)} {goal.unit}
          </p>
          <p className="text-xs text-muted-foreground">To go</p>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {goal.name} over time
        </h4>
        <GoalChart goal={goal} />
      </div>

      {reached ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-success">🎉 You hit your target — great work!</p>
          <div className="flex flex-wrap gap-2">
            <Button size="md" onClick={onSetNewGoal}>
              Set a new goal
            </Button>
            <Button size="md" variant="outline" onClick={() => onArchive(goal.id)}>
              Archive this goal
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <Input
            label=""
            type="number"
            min={0}
            placeholder="New value"
            value={checkInValue}
            onChange={(e) => setCheckInValue(e.target.value)}
            className="h-10 flex-1"
          />
          <Button
            size="md"
            onClick={() => {
              if (!checkInValue) return;
              onCheckIn(goal.id, parseFloat(checkInValue));
              setCheckInValue("");
            }}
            disabled={!checkInValue}
          >
            Check In
          </Button>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Training {goal.weekly} day{Number(goal.weekly) > 1 ? "s" : ""} per week. Keep showing up!
      </p>
    </div>
  );
}

function EmptyState({ onAddGoal }: { onAddGoal: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl">
        🎯
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold">Set your first goal</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Add a goal and complete workouts — they’ll be logged here automatically,
        and you’ll see your streak, heatmap, and per-goal trends.
      </p>
      <div className="mt-6">
        <Button size="lg" onClick={onAddGoal}>
          + Add goal
        </Button>
      </div>
    </div>
  );
}

function RecentWorkouts({
  logs,
  onUndo,
}: {
  logs: WorkoutLog[];
  onUndo: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (logs.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-bold text-foreground">Completed workouts</h2>
      <ul className="space-y-3">
        {logs
          .slice()
          .reverse()
          .map((log) => (
            <li
              key={log.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {log.durationMinutes} min · {log.goal.replace("_", " ")}
                  </span>
                  {log.undoable && <Badge variant="primary">Today</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(log.completedAt).toLocaleString()}
                  {log.updatedGoals.length > 0 && (
                    <> · {log.updatedGoals.map((g) => g.goalName).join(", ")}</>
                  )}
                </p>
              </div>

              {log.undoable &&
                (confirming === log.id ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Undo workout &amp; its goal updates?
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onUndo(log.id);
                        } finally {
                          setBusy(false);
                          setConfirming(null);
                        }
                      }}
                    >
                      Undo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirming(log.id)}
                  >
                    Edit or undo
                  </Button>
                ))}
            </li>
          ))}
      </ul>
    </section>
  );
}

export default function ProgressPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [stats, setStats] = useState<ProgressStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [weekly, setWeekly] = useState("3");
  const [unit, setUnit] = useState("kg");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [loadedGoals, loadedLogs] = await Promise.all([
      fetchGoals(),
      fetchWorkoutLogs(),
    ]);
    setGoals(loadedGoals);
    setLogs(loadedLogs.logs);
    setStats(loadedLogs.stats);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGoals()
      .then((loaded) => {
        if (cancelled) return;
        setGoals(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
      });

    fetchWorkoutLogs()
      .then((loaded) => {
        if (cancelled) return;
        setLogs(loaded.logs);
        setStats(loaded.stats);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(EMPTY_STATS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const weeklyTarget = useMemo(() => {
    const consistency = goals.find((g) => g.category === "Weekly Consistency");
    const favorite = consistency ?? goals[0];
    return favorite ? Number(favorite.weekly) || 3 : 3;
  }, [goals]);

  const handleCategorySelect = useCallback((category: typeof CATEGORY_PRESETS[number]) => {
    setSelectedCategory(category.name);
    setUnit(category.defaultUnit);
    setCurrent("");
    setTarget("");
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !current || !target) return;

      try {
        const newGoal = await createGoal({
          name: name.trim(),
          category: selectedCategory ?? "Custom",
          unit,
          current: Number(current),
          target: Number(target),
          weekly,
        });
        setGoals((prev) => [...prev, newGoal]);
        setError(null);
        setName("");
        setCurrent("");
        setTarget("");
        setWeekly("3");
        setUnit("kg");
        setSelectedCategory(null);
        setDrawerOpen(false);
      } catch {
        setError("Could not save your goal. Please try again.");
      }
    },
    [name, current, target, unit, selectedCategory, weekly],
  );

  const handleCheckIn = useCallback(async (id: string, newValue: number) => {
    try {
      const updated = await checkInGoal(id, newValue);
      setError(null);
      setGoals((prev) => prev.map((goal) => (goal.id === id ? updated : goal)));
    } catch {
      setError("Could not save your check-in. Please try again.");
    }
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    try {
      await archiveGoal(id);
      setError(null);
      setGoals((prev) => prev.map((goal) => (goal.id === id ? { ...goal, status: "archived" } : goal)));
    } catch {
      setError("Could not archive the goal. Please try again.");
    }
  }, []);

  const handleUndo = useCallback(
    async (id: string) => {
      try {
        const response = await undoWorkoutLog(id);
        setError(null);
        setStats(response.stats);
        setLogs((prev) => prev.filter((log) => log.id !== id));
        if (response.goals.length > 0) {
          setGoals((prev) =>
            prev.map((goal) => {
              const updated = response.goals.find((g) => g.id === goal.id);
              return updated ? { ...goal, progress: updated.progress, status: updated.status as Goal["status"] } : goal;
            }),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not undo workout.");
        await refresh().catch(() => undefined);
      }
    },
    [refresh],
  );

  const activeGoals = goals.filter((g) => g.status !== "archived");
  const showEmptyState = !loading && !loadFailed && activeGoals.length === 0 && goals.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Progress Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track your fitness journey and stay motivated
            </p>
          </div>
          <Button size="lg" onClick={() => setDrawerOpen(true)}>
            + Add New Goal
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {loadFailed && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
            Couldn’t reach the server, so goal data is unavailable right now.
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Loading your progress…</p>
          </div>
        ) : showEmptyState ? (
          <EmptyState onAddGoal={() => setDrawerOpen(true)} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KPICard title="Current Streak" value={`${stats.streak} Day${stats.streak === 1 ? "" : "s"}`} subtitle="Consecutive days active">
                <span className="text-3xl">🔥</span>
              </KPICard>
              <KPICard title="Workouts Completed" value={`${stats.workoutsCompleted}`} subtitle="Logged sessions">
                <span className="text-3xl">🏋️</span>
              </KPICard>
              <KPICard title="Weekly Consistency" value={`${stats.weeklyDaysThisWeek} / ${weeklyTarget}`} subtitle="Days this week vs. target">
                <RingChart
                  progress={weeklyTarget > 0 ? Math.min(100, (stats.weeklyDaysThisWeek / weeklyTarget) * 100) : 0}
                  size={80}
                />
              </KPICard>
            </div>

            <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-foreground">Activity Heatmap</h2>
                  <p className="text-xs text-muted-foreground">
                    Browse months to see your workout history
                  </p>
                </div>
                <CalendarHeatmap workoutDays={stats.heatmapDays} />
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-muted" />
                  <span>Rest</span>
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                  <span>Workout</span>
                  <div className="w-3 h-3 rounded-sm bg-card border border-primary" />
                  <span>Today</span>
                </div>
              </div>

              <RecoveryCard />
            </div>

            <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
              <InsightsPanel workoutDays={stats.heatmapDays} />
              <WearableCard />
            </div>

            <div className="mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Your Goals</h2>
                  <p className="text-sm text-muted-foreground">
                    {activeGoals.length === 0
                      ? "Set a goal to start tracking your progress"
                      : `${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"} — check in to keep the trend alive`}
                  </p>
                </div>
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => setDrawerOpen(true)}
                >
                  + Add goal
                </Button>
              </div>
              {activeGoals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
                  <p className="text-muted-foreground">
                    No active goals yet. Add one to see your trend chart here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {activeGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onCheckIn={handleCheckIn}
                      onArchive={handleArchive}
                      onSetNewGoal={() => setDrawerOpen(true)}
                    />
                  ))}
                </div>
              )}
            </div>

            <RecentWorkouts logs={logs.filter((log) => log.id)} onUndo={handleUndo} />
          </>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-full max-w-md bg-card shadow-xl animate-slide-in-right">
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-lg font-bold text-foreground">Add New Goal</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
                <div className="mb-4">
                  <span className="text-sm font-medium text-foreground">Quick Start</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {CATEGORY_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleCategorySelect(preset)}
                        className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                          selectedCategory === preset.name
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <span className="text-xl">{preset.icon}</span>
                        <p className="mt-1 text-sm font-medium text-foreground">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {preset.currentPlaceholder} → {preset.targetPlaceholder} {preset.defaultUnit}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    label="Goal name"
                    placeholder="e.g. Lose weight, Run a 5K"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="Current value"
                        type="number"
                        min={0}
                        placeholder={selectedCategory ? CATEGORY_PRESETS.find(p => p.name === selectedCategory)?.currentPlaceholder : "80"}
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        label="Target value"
                        type="number"
                        min={0}
                        placeholder={selectedCategory ? CATEGORY_PRESETS.find(p => p.name === selectedCategory)?.targetPlaceholder : "70"}
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-foreground">Unit</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {UNIT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setUnit(option.value)}
                          className={`h-9 rounded-full px-4 text-sm font-medium transition-colors cursor-pointer ${
                            unit === option.value
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-foreground">Training days per week</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {WEEKLY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setWeekly(option.value)}
                          className={`h-9 rounded-full px-4 text-sm font-medium transition-colors cursor-pointer ${
                            weekly === option.value
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || !current || !target}>
                    Save Goal
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}