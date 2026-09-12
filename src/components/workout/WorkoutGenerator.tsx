"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import type { PickerResult } from "@/components/workout/ExercisePicker";
import {
  EXPERIENCE_LEVELS,
  EQUIPMENT_PRESETS,
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
  removeFromHistory,
  upsertWorkout,
} from "@/lib/workout-history";
import type { WorkoutHistoryEntry } from "@/lib/workout-history";

// Heavy workout rendering (loads the full wger exercise catalog) is fetched
// on demand, only after the user generates a workout.
const GeneratedWorkoutView = dynamic(
  () =>
    import("@/components/workout/GeneratedWorkoutView").then(
      (m) => m.GeneratedWorkoutView,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Building your workout…
      </p>
    ),
  },
);

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

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function WorkoutGenerator() {
  const router = useRouter();

  const [goal, setGoal] = useState<WorkoutGoal>("full_body");
  const [duration, setDuration] = useState<number>(30);
  const [level, setLevel] = useState<ExperienceLevel>("intermediate");
  const [preset, setPreset] = useState<EquipmentPreset>("full");

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() =>
    loadHistory(),
  );
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutHistoryEntry | null>(
    null,
  );

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget]);

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
    router.push(`/pages/workout-session?id=${encodeURIComponent(workout.id)}`);
  };

  const handleLoad = (entry: WorkoutHistoryEntry) => {
    setWorkout(entry.workout);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (target: WorkoutHistoryEntry) => {
    setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.workout.id;
    setDeleteTarget(null);
    removeFromHistory(targetId);
    setHistory(loadHistory());
    window.dispatchEvent(new Event("workouts-changed"));
    if (workout?.id === targetId) setWorkout(null);
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
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="range"
                min={10}
                max={60}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-2 w-full max-w-xs cursor-pointer accent-primary"
                aria-label="Workout duration in minutes"
              />
              <span className="min-w-[5.5rem] text-sm font-medium text-foreground">
                {duration} min
              </span>
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
                  <button
                    type="button"
                    onClick={() => handleDelete(entry)}
                    aria-label="Delete workout"
                    title="Delete workout"
                    className="ml-auto grid h-7 w-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <TrashIcon />
                  </button>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete workout"
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold">Delete workout?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the workout from your recent list. This
              action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}