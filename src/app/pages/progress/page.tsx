"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  fetchGoals,
  createGoal,
  checkInGoal,
  type Goal,
} from "@/lib/progress";
import { loadHistory } from "@/lib/workout-history";
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

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function buildMockGoals(): Goal[] {
  const history = [];
  for (let i = 29; i >= 0; i--) {
    history.push({
      id: `mock-chk-${i}`,
      date: isoDaysAgo(i),
      value: Math.round((85 - i * 0.155) * 10) / 10,
    });
  }
  const runHistory = [5, 6, 7, 8].map((value, i) => ({
    id: `mock-run-${i}`,
    date: isoDaysAgo((3 - i) * 7),
    value,
  }));

  return [
    {
      id: "mock-goal-1",
      userId: "demo",
      name: "Lose 7kg",
      category: "Body Weight",
      unit: "kg",
      current: 85,
      target: 78,
      weekly: "4",
      progress: 65,
      status: "active",
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(0),
      history,
    },
    {
      id: "mock-goal-2",
      userId: "demo",
      name: "Run a 10K",
      category: "Distance / Endurance",
      unit: "km",
      current: 8,
      target: 10,
      weekly: "3",
      progress: 60,
      status: "active",
      createdAt: isoDaysAgo(21),
      updatedAt: isoDaysAgo(0),
      history: runHistory,
    },
  ];
}

function buildMockWorkoutDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  let skip = false;
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (skip) {
      skip = false;
      continue;
    }
    days.push(date.toISOString().split("T")[0]);
    skip = i % 3 === 0;
  }
  return days;
}

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
  const weeks: string[][] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 27);
  
  while (weeks.length < 4) {
    const week: string[] = [];
    for (let i = 0; i < 7 && weeks.length * 7 + i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + weeks.length * 7 + i);
      week.push(date.toISOString().split("T")[0]);
    }
    weeks.push(week);
  }

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {dayLabels.map((label, i) => (
          <div key={i} className="w-6 h-6 flex items-center justify-center text-[10px] text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-1">
          {week.map((day) => {
            const hasWorkout = workoutDays.includes(day);
            const isToday = day === today.toISOString().split("T")[0];
            return (
              <div
                key={day}
                className={`w-6 h-6 rounded-sm transition-colors ${
                  hasWorkout
                    ? "bg-primary"
                    : isToday
                    ? "border border-primary/50 bg-card"
                    : "bg-muted"
                }`}
                title={day}
              />
            );
          })}
        </div>
      ))}
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

function GoalCard({
  goal,
  onCheckIn,
  demo = false,
}: {
  goal: Goal;
  onCheckIn: (id: string, newValue: number) => void;
  demo?: boolean;
}) {
  const [checkInValue, setCheckInValue] = useState("");

  const latestValue = goal.history[goal.history.length - 1]?.value ?? goal.current;
  const toGo = latestValue - goal.target;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="primary" className="mb-2">{goal.category}</Badge>
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
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${goal.progress}%` }}
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
            {toGo} {goal.unit}
          </p>
          <p className="text-xs text-muted-foreground">To go</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Input
          label=""
          type="number"
          min={0}
          placeholder={demo ? "Example only" : "New value"}
          value={checkInValue}
          onChange={(e) => setCheckInValue(e.target.value)}
          className="h-10 flex-1"
          disabled={demo}
        />
        <Button
          size="md"
          onClick={() => {
            if (!checkInValue) return;
            onCheckIn(goal.id, parseFloat(checkInValue));
            setCheckInValue("");
          }}
          disabled={!checkInValue || goal.status === "achieved" || demo}
        >
          {goal.status === "achieved" ? "Achieved" : "Check In"}
        </Button>
      </div>

      {demo && (
        <p className="mt-3 text-xs text-muted-foreground">
          Demo data — add your own goal to check in for real.
        </p>
      )}

      {goal.status === "achieved" && (
        <p className="mt-3 text-sm font-medium text-success">🎉 Goal achieved — great work!</p>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Training {goal.weekly} day{Number(goal.weekly) > 1 ? "s" : ""} per week. Keep showing up!
      </p>
    </div>
  );
}

export default function ProgressPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dismissMock, setDismissMock] = useState(false);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [weekly, setWeekly] = useState("3");
  const [unit, setUnit] = useState("kg");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => loadHistory())
      .then((entries) => {
        if (cancelled) return;
        const days = new Set<string>();
        for (const entry of entries) {
          const timestamp = entry.startedAt ?? entry.workout.createdAt;
          if (timestamp) {
            days.add(new Date(timestamp).toISOString().split("T")[0]);
          }
        }
        setWorkoutDays([...days]);
        setTotalWorkouts(entries.length);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mockGoals = useMemo(() => buildMockGoals(), []);
  const mockWorkoutDays = useMemo(() => buildMockWorkoutDays(), []);

  const isNewUser = !loading && !loadFailed && goals.length === 0 && workoutDays.length === 0;
  const showMock = (loadFailed || isNewUser) && !dismissMock;

  const effectiveGoals = showMock && goals.length === 0 ? mockGoals : goals;
  const effectiveWorkoutDays =
    showMock && workoutDays.length === 0 ? mockWorkoutDays : workoutDays;
  const effectiveTotalWorkouts =
    showMock && totalWorkouts === 0 ? mockWorkoutDays.length : totalWorkouts;

  const streak = useMemo(() => {
    if (effectiveWorkoutDays.length === 0) return 0;
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (effectiveWorkoutDays.includes(date.toISOString().split("T")[0])) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [effectiveWorkoutDays]);

  const activeGoal = effectiveGoals[0] ?? null;
  const activeGoalProgress = activeGoal?.progress ?? 0;

  const chartData = useMemo(() => {
    const history = activeGoal?.history ?? [];
    return history.map((h) => ({
      date: new Date(h.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: h.value,
    }));
  }, [activeGoal]);

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
      setGoals((prev) =>
        prev.map((goal) => {
          if (goal.id !== id) return goal;
          return {
            ...goal,
            progress: updated.progress,
            status: updated.status,
            updatedAt: updated.updatedAt,
            history: [
              ...goal.history,
              { id: updated.checkIn?.id ?? "", date: updated.checkIn?.date ?? new Date().toISOString(), value: newValue },
            ],
          };
        }),
      );
    } catch {
      setError("Could not save your check-in. Please try again.");
    }
  }, []);

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

      {showMock && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Demo data</span>
            {loadFailed
              ? " — couldn't reach the server, so this is example data."
              : " — you're new here! This is example data to preview your dashboard. It disappears once you add a goal or log a workout."}
          </p>
          <button
            type="button"
            onClick={() => setDismissMock(true)}
            className="shrink-0 text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            Show empty state
          </button>
        </div>
      )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard title="Current Streak" value={`${streak} Days`} subtitle="Consecutive days active">
            <span className="text-3xl">🔥</span>
          </KPICard>
          <KPICard title="Workouts Completed" value={`${effectiveTotalWorkouts}`} subtitle="Logged sessions">
            <span className="text-3xl">🏋️</span>
          </KPICard>
          <KPICard title="Active Goal Progress" value={`${activeGoalProgress}%`} subtitle="To Target">
            <RingChart progress={activeGoalProgress} size={80} />
          </KPICard>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-foreground">
              {activeGoal ? activeGoal.name : "Weight Progress"}
            </h2>
            {chartData.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <p className="text-muted-foreground">
                  No progress data yet. Add a goal and check in to see your trend.
                </p>
              </div>
            ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    className="text-muted-foreground"
                    interval={6}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    className="text-muted-foreground"
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: "var(--primary)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-foreground">Activity Heatmap</h2>
            <p className="mb-3 text-sm text-muted-foreground">Last 4 weeks of workouts</p>
            <CalendarHeatmap workoutDays={effectiveWorkoutDays} />
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-muted" />
              <span>Rest</span>
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>Workout</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="mb-4 text-lg font-bold text-foreground">Your Goals</h2>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading your goals…</p>
            </div>
          ) : effectiveGoals.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No goals yet. Add your first goal to start tracking!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {effectiveGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onCheckIn={handleCheckIn}
                  demo={goal.id.startsWith("mock-")}
                />
              ))}
            </div>
          )}
        </div>
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
