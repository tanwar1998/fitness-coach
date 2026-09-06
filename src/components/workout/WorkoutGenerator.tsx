"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import type { PickerResult } from "@/components/workout/ExercisePicker";
import { GeneratedWorkoutView } from "@/components/workout/GeneratedWorkoutView";
import {
  EXPERIENCE_LEVELS,
  EQUIPMENT_PRESETS,
  WORKOUT_DURATIONS,
  WORKOUT_GOALS,
  buildWgerExercise,
  generateWorkout,
} from "@/lib/workout-generator";
import type {
  EquipmentPreset,
  ExperienceLevel,
  GeneratedWorkout,
  WorkoutGoal,
} from "@/lib/workout-generator";
import {
  loadHistory,
  markStarted,
  upsertWorkout,
} from "@/lib/workout-history";
import type { WorkoutHistoryEntry } from "@/lib/workout-history";

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width = "18px"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0l1.582 6.135A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  );
}

interface PickerState {
  index: number | "add";
}

export function WorkoutGenerator() {
  const router = useRouter();

  const [goal, setGoal] = useState<WorkoutGoal>("hypertrophy");
  const [duration, setDuration] = useState<number>(30);
  const [level, setLevel] = useState<ExperienceLevel>("intermediate");
  const [preset, setPreset] = useState<EquipmentPreset>("full");

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() =>
    loadHistory(),
  );
  const [picker, setPicker] = useState<PickerState | null>(null);

  const handleGenerate = () => {
    const next = generateWorkout({ goal, durationMinutes: duration, level, preset });
    setWorkout(next);
    setHistory(upsertWorkout(next));
  };

  const handleSelect = (exercise: PickerResult) => {
    if (!workout) return;
    if (picker?.index === "add") {
      const targetScheme = workout.exercises[0];
      const added = buildWgerExercise(
        exercise.id,
        exercise.name,
        exercise.category,
        exercise.muscles,
        {
          sets: targetScheme?.sets ?? 3,
          reps: targetScheme?.reps ?? "8-12",
          restSeconds: targetScheme?.restSeconds ?? 90,
        },
      );
      const next = { ...workout, exercises: [...workout.exercises, added] };
      setWorkout(next);
      setHistory(upsertWorkout(next));
    } else if (picker && typeof picker.index === "number") {
      const slot = workout.exercises[picker.index];
      const swapped = buildWgerExercise(
        exercise.id,
        exercise.name,
        exercise.category,
        exercise.muscles,
        {
          sets: slot.sets,
          reps: slot.reps,
          restSeconds: slot.restSeconds,
        },
      );
      const exercises = [...workout.exercises];
      exercises[picker.index] = swapped;
      const next = { ...workout, exercises };
      setWorkout(next);
      setHistory(upsertWorkout(next));
    }
    setPicker(null);
  };

  const handleRemove = (index: number) => {
    if (!workout) return;
    const exercises = workout.exercises.filter((_, i) => i !== index);
    const next = { ...workout, exercises };
    setWorkout(next);
    setHistory(upsertWorkout(next));
  };

  const handleStart = () => {
    if (!workout) return;
    setHistory(markStarted(workout.id));
    router.push("/pages/progress");
  };

  const handleLoad = (entry: WorkoutHistoryEntry) => {
    setWorkout(entry.workout);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chipClass = (active: boolean) =>
    `h-9 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
    }`;

  return (
    <div>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Goal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORKOUT_GOALS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.hint}
                  onClick={() => setGoal(opt.value)}
                  className={chipClass(goal === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Duration</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORKOUT_DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                  className={chipClass(duration === minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Equipment</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EQUIPMENT_PRESETS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.hint}
                  onClick={() => setPreset(opt.value)}
                  className={chipClass(preset === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Level</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPERIENCE_LEVELS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(opt.value)}
                  className={chipClass(level === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {duration} min · {goal.replace("_", " ")} · {preset} · {level}
          </p>
          <Button size="lg" onClick={handleGenerate}>
            <SparklesIcon />
            Generate workout
          </Button>
        </div>
      </div>

      {workout && (
        <GeneratedWorkoutView
          workout={workout}
          onRegenerate={handleGenerate}
          onStart={handleStart}
          onSwap={(index) => setPicker({ index })}
          onRemove={handleRemove}
          onAdd={() => setPicker({ index: "add" })}
        />
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">Recent workouts</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {history.slice(0, 8).map((entry) => (
              <div
                key={entry.workout.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant={entry.status === "started" ? "success" : "secondary"}
                  >
                    {entry.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.workout.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold">
                  {entry.workout.durationMinutes} min ·{" "}
                  {entry.workout.exercises.length} exercises
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {entry.workout.goal.replace("_", " ")} ·{" "}
                  {entry.workout.level}
                </p>
                <div className="mt-auto pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleLoad(entry)}
                  >
                    Load
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ExercisePicker
        open={picker !== null}
        preset={workout?.preset ?? preset}
        excludeIds={workout?.exercises.map((e) => e.exerciseId) ?? []}
        onClose={() => setPicker(null)}
        onSelect={handleSelect}
      />
    </div>
  );
}