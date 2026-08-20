"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

interface Goal {
  name: string;
  current: number;
  target: number;
}

const WEEKLY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "2", label: "2 days" },
  { value: "3", label: "3 days" },
  { value: "4", label: "4 days" },
  { value: "5", label: "5 days" },
];

export default function ProgressPage() {
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [weekly, setWeekly] = useState("3");
  const [goal, setGoal] = useState<Goal | null>(null);

  const canSubmit = name.trim() !== "" && current !== "" && target !== "";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setGoal({
      name: name.trim(),
      current: Number(current),
      target: Number(target),
    });
  };

  const handleReset = () => {
    setName("");
    setCurrent("");
    setTarget("");
    setWeekly("3");
    setGoal(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="primary" className="mb-4">
          Goal Tracker
        </Badge>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Track Your Progress
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Set a goal and we&apos;ll show you how far you have to go. Update it
          as you train.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Goal name"
              placeholder="e.g. Lose weight, Run a 5K, Build muscle"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Input
            label="Current value"
            type="number"
            min={0}
            placeholder="e.g. 80"
            hint="Starting point today"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <Input
            label="Target value"
            type="number"
            min={0}
            placeholder="e.g. 70"
            hint="Where you want to be"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>

        <div className="mt-5">
          <span className="text-sm font-medium">Training days per week</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKLY_OPTIONS.map((option) => {
              const active = option.value === weekly;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setWeekly(option.value)}
                  className={`h-9 rounded-full px-4 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={!canSubmit}
          >
            Save Goal
          </Button>
          <Button size="lg" variant="outline" onClick={handleReset}>
            Clear
          </Button>
        </div>
      </form>

      {goal && (
        <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-bold">{goal.name}</h2>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-2xl font-bold text-primary">{goal.current}</p>
              <p className="mt-1 text-xs text-muted-foreground">Current</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-2xl font-bold text-primary">{goal.target}</p>
              <p className="mt-1 text-xs text-muted-foreground">Target</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-2xl font-bold text-primary">
                {goal.current - goal.target}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">To go</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            You&apos;re training {weekly} day
            {Number(weekly) > 1 ? "s" : ""} per week. Keep showing up — small
            steps add up to big results.
          </p>
        </section>
      )}
    </div>
  );
}
