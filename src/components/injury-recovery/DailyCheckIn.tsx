"use client";

import { useState } from "react";
import type { DailyCheckIn } from "../../../data";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface DailyCheckInProps {
  onSubmit: (
    checkIn: Omit<DailyCheckIn, "id" | "userId" | "source">,
  ) => void;
  latest?: DailyCheckIn | null;
  submitting?: boolean;
}

const SORENESS_LEVELS = [
  { value: 1, label: "Feel great", emoji: "😄", color: "text-success" },
  { value: 2, label: "Good", emoji: "🙂", color: "text-lime" },
  { value: 3, label: "Okay", emoji: "😐", color: "text-primary" },
  { value: 4, label: "Sore", emoji: "😣", color: "text-orange-400" },
  { value: 5, label: "Very sore", emoji: "😫", color: "text-danger" },
];

const SLEEP_OPTIONS = [6, 7, 8, 9, 10];

export function DailyCheckIn({
  onSubmit,
  latest,
  submitting = false,
}: DailyCheckInProps) {
  const [soreness, setSoreness] = useState<number>(latest?.sorenessScore ?? 3);
  const [sleep, setSleep] = useState<number | null>(latest?.sleepHours ?? null);
  const [stress, setStress] = useState<number | null>(latest?.stressLevel ?? null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      date: "",
      sorenessScore: soreness,
      sleepHours: sleep ?? undefined,
      sleepQuality: undefined,
      stressLevel: stress ?? undefined,
      energyLevel: undefined,
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{today}</p>
          <p className="text-xs text-muted-foreground">
            Quick 2-tap check-in. How are you feeling?
          </p>
        </div>
        {latest && (
          <Badge variant="success">Logged today</Badge>
        )}
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Soreness / readiness</span>
        <div className="grid grid-cols-5 gap-2">
          {SORENESS_LEVELS.map((level) => {
            const active = soreness === level.value;
            return (
              <button
                key={level.value}
                type="button"
                aria-pressed={active}
                onClick={() => setSoreness(level.value)}
                className={`flex flex-col items-center gap-0.5 rounded-sm border p-2 py-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-foreground/25 bg-card hover:bg-muted"
                }`}
              >
                <span className="text-xl">{level.emoji}</span>
                <span
                  className={`text-xs font-medium ${active ? level.color : "text-muted-foreground"}`}
                >
                  {level.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-2 block text-sm font-medium">
            Sleep hours (optional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SLEEP_OPTIONS.map((hours) => (
              <button
                key={hours}
                type="button"
                aria-pressed={sleep === hours}
                onClick={() => setSleep(hours)}
                className={`h-8 rounded-sm px-3 text-xs font-medium transition-colors cursor-pointer ${
                  sleep === hours
                    ? "bg-primary text-primary-foreground"
                    : "border border-foreground/25 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">
            Stress level (optional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={stress === level}
                onClick={() => setStress(level)}
                className={`h-8 rounded-sm px-3 text-xs font-medium transition-colors cursor-pointer ${
                  stress === level
                    ? "bg-primary text-primary-foreground"
                    : "border border-foreground/25 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitted
          ? "Logged ✓"
          : latest
            ? "Update check-in"
            : "Log check-in"}
      </Button>
    </form>
  );
}
