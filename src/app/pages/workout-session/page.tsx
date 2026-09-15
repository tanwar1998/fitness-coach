"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type { GeneratedExercise } from "@/lib/workout-generator";
import { estimateWorkout } from "@/lib/workout-generator";
import {
  loadHistory,
  markCompleted,
} from "@/lib/workout-history";
import type { WorkoutHistoryEntry } from "@/lib/workout-history";
import {
  logWorkout,
  undoWorkoutLog,
  type LogWorkoutResponse,
} from "@/lib/progress";

function SessionView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams?.get("id") ?? null;

  const [entry] = useState<WorkoutHistoryEntry | null | undefined>(() => {
    if (workoutId == null) return null;
    return loadHistory().find((e) => e.workout.id === workoutId) ?? null;
  });

  const estimate = useMemo(
    () => (entry ? estimateWorkout(entry.workout) : null),
    [entry],
  );

  const [doneExercises, setDoneExercises] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<LogWorkoutResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [undoConfirm, setUndoConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleExercise = (key: string) => {
    setDoneExercises((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleComplete = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await logWorkout(entry.workout);
      markCompleted(entry.workout.id);
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not log your workout.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = async () => {
    if (!result?.log) return;
    setSubmitting(true);
    setError(null);
    try {
      await undoWorkoutLog(result.log.id);
      router.push("/pages/progress");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not undo that workout.",
      );
      setSubmitting(false);
    }
  };

  if (entry === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
        <p className="text-muted-foreground">Loading your workout…</p>
      </div>
    );
  }

  if (entry === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight">
            Session not found
          </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          We couldn’t find this workout in your recent sessions. It may have
          been cleared from this browser.
        </p>
        <div className="mt-6">
          <Link href="/pages/generate-workout">
            <Button size="lg">Generate a workout</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { workout } = entry;
  const doneCount = doneExercises.size;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Workout Session
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          {workout.goal.replace("_", " ")} · {workout.level} ·{" "}
          {workout.durationMinutes} min target
          {estimate ? ` · ~${estimate.minutes} min · ~${estimate.kcal} kcal` : ""}
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {workout.exercises.length} exercises
          </h2>
          <span className="serial text-sm text-muted-foreground">
            {doneCount}/{workout.exercises.length} done
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {workout.exercises.map((exercise: GeneratedExercise) => {
            const done = doneExercises.has(exercise.key);
            return (
              <li key={exercise.key}>
                <button
                  type="button"
                  onClick={() => toggleExercise(exercise.key)}
                  className={`flex w-full cursor-pointer items-center gap-4 rounded-sm border border-foreground/25 bg-card p-4 text-left transition-colors ${
                    done
                      ? "border-primary/40 bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-sm ${
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-foreground/25 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {exercise.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {exercise.muscleLabels.slice(0, 3).join(" · ") ||
                        exercise.category}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3 text-xs text-muted-foreground">
                    <span>
                      <span className="serial font-semibold text-foreground">
                        {exercise.sets}
                      </span>{" "}
                      sets
                    </span>
                    <span>
                      <span className="serial font-semibold text-foreground">
                        {exercise.reps}
                      </span>{" "}
                      reps
                    </span>
                    <span className="serial">
                      {Math.round(exercise.restSeconds / 60)}m rest
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div className="mt-6 rounded-sm border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-8">
        {!result ? (
          <div className="flex flex-col items-center gap-2 rounded-sm border border-foreground/25 bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Finish is up to you — tap complete when the session is done, even
              if you skipped an exercise.
            </p>
            <Button size="lg" onClick={handleComplete} disabled={submitting}>
              {submitting ? "Logging…" : "Complete workout"}
            </Button>
          </div>
        ) : (
          <CompletionSummary
            result={result}
            onUndo={() => setUndoConfirm(true)}
            onGoProgress={() => router.push("/pages/progress")}
          />
        )}

        {undoConfirm && (
          <div className="mt-4 rounded-sm border border-foreground/25 bg-card p-5">
            <h3 className="font-semibold text-foreground">
              Undo this workout log?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will revert for today: the streak, today’s heatmap cell,
              workouts-completed count, and the progress chart updates on every
              goal this workout touched.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="danger"
                onClick={handleUndo}
                disabled={submitting}
              >
                {submitting ? "Undoing…" : "Yes, undo this log"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setUndoConfirm(false)}
                disabled={submitting}
              >
                Keep it
              </Button>
            </div>
          </div>
        )}

        {result && !undoConfirm && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => setUndoConfirm(true)}>
              Edit or undo this log
            </Button>
          </p>
        )}
      </div>
    </div>
  );
}

function CompletionSummary({
  result,
  onUndo,
  onGoProgress,
}: {
  result: LogWorkoutResponse;
  onUndo: () => void;
  onGoProgress: () => void;
}) {
  const updated = result.goalUpdates.filter((g) => g.status === "updated");
  const unchanged = result.goalUpdates.filter((g) => g.status === "no_change");

  return (
    <div className="rounded-sm border border-foreground/25 bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-sm border border-success/40 bg-success/15 text-xl text-success">
          ✓
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Workout logged
          </h2>
          <p className="text-sm text-muted-foreground">
            Auto-saved to Progress. Streak{" "}
            <span className="font-semibold text-foreground">
              {result.stats.streak} days
            </span>{" "}
            ·{" "}
            <span className="font-semibold text-foreground">
              {result.stats.workoutsCompleted}
            </span>{" "}
            workouts completed.
          </p>
        </div>
      </div>

      {updated.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Goals updated
          </h3>
          <ul className="mt-2 space-y-2">
            {updated.map((goal) => (
              <li
                key={goal.goalId}
                className="rounded-sm border border-success/30 bg-success/5 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {goal.goalName}
                  </span>
                  <Badge variant="success">
                    +{goal.value} {goal.unit}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {goal.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unchanged.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Goals with no change
          </h3>
          <ul className="mt-2 space-y-2">
            {unchanged.map((goal) => (
              <li
                key={goal.goalId}
                className="rounded-sm border border-foreground/25 bg-muted p-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {goal.goalName}
                </span>{" "}
                <span className="text-xs text-muted-foreground">
                  — no change
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {goal.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onGoProgress}>
          View progress
        </Button>
        <Button variant="ghost" onClick={onUndo}>
          Edit or undo this log
        </Button>
      </div>
    </div>
  );
}

export default function WorkoutSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
          <p className="text-muted-foreground">Loading your workout…</p>
        </div>
      }
    >
      <SessionView />
    </Suspense>
  );
}