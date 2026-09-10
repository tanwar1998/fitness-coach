"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Goal {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
  category: string;
  weekly: string;
  progress: number;
  createdAt: string;
  history: { date: string; value: number }[];
}

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

function generateMockHistory(): { date: string; value: number }[] {
  const history = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    history.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: 85 - (29 - i) * 0.25 + Math.random() * 0.5,
    });
  }
  return history;
}

function generateWorkoutDays(): string[] {
  const days = [];
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (Math.random() > 0.4) {
      days.push(date.toISOString().split("T")[0]);
    }
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
}: {
  goal: Goal;
  onCheckIn: (id: string, newValue: number) => void;
}) {
  const [checkInValue, setCheckInValue] = useState(goal.current.toString());

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
          <p className="text-lg font-bold text-foreground">{goal.current} {goal.unit}</p>
          <p className="text-xs text-muted-foreground">Current</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-lg font-bold text-primary">{goal.target} {goal.unit}</p>
          <p className="text-xs text-muted-foreground">Target</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-lg font-bold text-foreground">
            {goal.current - goal.target} {goal.unit}
          </p>
          <p className="text-xs text-muted-foreground">To go</p>
        </div>
      </div>

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
          onClick={() => onCheckIn(goal.id, parseFloat(checkInValue))}
          disabled={!checkInValue}
        >
          Check In
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Training {goal.weekly} day{Number(goal.weekly) > 1 ? "s" : ""} per week. Keep showing up!
      </p>
    </div>
  );
}

export default function ProgressPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [weekly, setWeekly] = useState("3");
  const [unit, setUnit] = useState("kg");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const mockHistory = useMemo(() => generateMockHistory(), []);
  const workoutDays = useMemo(() => generateWorkoutDays(), []);

  const totalWorkouts = workoutDays.length;
  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (workoutDays.includes(date.toISOString().split("T")[0])) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [workoutDays]);

  const activeGoalProgress = goals.length > 0 ? goals[goals.length - 1].progress : 65;

  const handleCategorySelect = useCallback((category: typeof CATEGORY_PRESETS[number]) => {
    setSelectedCategory(category.name);
    setUnit(category.defaultUnit);
    setCurrent("");
    setTarget("");
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !current || !target) return;

    const initialHistory = [
      { date: "Start", value: Number(current) },
    ];

    const newGoal: Goal = {
      id: Date.now().toString(),
      name: name.trim(),
      current: Number(current),
      target: Number(target),
      unit,
      category: selectedCategory || "Custom",
      weekly,
      progress: 0,
      createdAt: new Date().toISOString(),
      history: initialHistory,
    };

    setGoals((prev) => [...prev, newGoal]);
    setName("");
    setCurrent("");
    setTarget("");
    setWeekly("3");
    setUnit("kg");
    setSelectedCategory(null);
    setDrawerOpen(false);
  }, [name, current, target, unit, selectedCategory, weekly]);

  const handleCheckIn = useCallback((id: string, newValue: number) => {
    setGoals((prev) =>
      prev.map((goal) => {
        if (goal.id !== id) return goal;
        const total = Math.abs(goal.target - goal.current);
        const done = Math.abs(newValue - goal.current);
        const progress = Math.min(100, Math.round((done / total) * 100));
        return {
          ...goal,
          progress,
          history: [
            ...goal.history,
            { date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: newValue },
          ],
        };
      })
    );
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="primary" className="mb-2">
              Goal Tracker
            </Badge>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard title="Current Streak" value={`${streak} Days`} subtitle="Active this week">
            <span className="text-3xl">🔥</span>
          </KPICard>
          <KPICard title="Workouts Completed" value={`${totalWorkouts}`} subtitle="Sessions this month">
            <span className="text-3xl">🏋️</span>
          </KPICard>
          <KPICard title="Active Goal Progress" value={`${activeGoalProgress}%`} subtitle="To Target">
            <RingChart progress={activeGoalProgress} size={80} />
          </KPICard>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-foreground">Weight Progress</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockHistory}>
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
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-foreground">Activity Heatmap</h2>
            <p className="mb-3 text-sm text-muted-foreground">Last 4 weeks of workouts</p>
            <CalendarHeatmap workoutDays={workoutDays} />
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
          {goals.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No goals yet. Add your first goal to start tracking!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onCheckIn={handleCheckIn} />
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
