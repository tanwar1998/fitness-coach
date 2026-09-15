"use client";

import {
  useState,
} from "react";
import type { AdjustmentAction, InjuryReport, TrainingPlan } from "../../../data";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { EXERCISE_MAP, generateAdjustedPlan } from "@/lib/injury-recovery";

interface AdjustedPlanViewProps {
  injuries: InjuryReport[];
  readinessScore: number | null;
  onDismissAction: (action: AdjustmentAction) => void;
  onRestoreAction: (action: AdjustmentAction) => void;
}

/**
 * Displays the computed adjusted plan and the reason behind
 * every substitution/exclusion, so the changes don't feel like
 * a black box. Users can dismiss (accept) or restore a change.
 */
export function AdjustedPlanView({
  injuries,
  readinessScore,
  onDismissAction,
  onRestoreAction,
}: AdjustedPlanViewProps) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [restored, setRestored] = useState<Record<string, boolean>>({});

  const samplePlan = buildSamplePlan();
  const context = {
    userId: "",
    activeInjuries: injuries.filter((i) => i.status !== "cleared"),
    latestReadiness: readinessScore != null
      ? {
          userId: "",
          date: new Date().toISOString().slice(0, 10),
          score: readinessScore,
          inputsUsed: ["checkin"] as ("checkin" | "wearable" | "training_load")[],
          computedAt: new Date().toISOString(),
        }
      : undefined,
    recentCheckIns: [],
    originalPlan: samplePlan,
  };

  const adjusted = generateAdjustedPlan(context);

  const toggleDismiss = (action: AdjustmentAction) => {
    const key = dismissKey(action);
    setDismissed((prev) => ({ ...prev, [key]: !prev[key] }));
    onDismissAction(action);
  };

  const toggleRestore = (action: AdjustmentAction) => {
    const key = dismissKey(action);
    setRestored((prev) => ({ ...prev, [key]: !prev[key] }));
    onRestoreAction(action);
  };

  const activeInjuries = injuries.filter((i) => i.status !== "cleared");
  const hasSevereActive = activeInjuries.some(
    (i) => i.status === "active" && i.severity === "severe",
  );

  return (
    <div className="flex flex-col gap-5">
      {hasSevereActive && (
        <div className="rounded-sm border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">
            <strong>Heads up:</strong> you have a severe active injury. Plan
            adjustments here are not a substitute for professional medical
            guidance. Please consider consulting a physiotherapist or doctor.
          </p>
        </div>
      )}

      {readinessScore != null && readinessScore < 55 && (
        <div className="rounded-sm border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-primary">
            <strong>Readiness {readinessScore}/100.</strong> We&apos;ve scaled
            down intensity/volume to protect recovery.
          </p>
        </div>
      )}

      <div className="rounded-sm border border-foreground/25 bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-black uppercase tracking-tight">Why your plan changed</h3>
          {adjusted.actions.length > 0 ? (
            <Badge variant="outline">{adjusted.actions.length} adjustments</Badge>
          ) : (
            <Badge variant="success">No changes needed</Badge>
          )}
        </div>

        {adjusted.actions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Based on your current reports and readiness, your plan looks good as-is.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {adjusted.actions.map((action, idx) => {
              const key = dismissKey(action);
              const original = EXERCISE_MAP[action.exerciseId];
              const replacement = action.replacementExerciseId
                ? EXERCISE_MAP[action.replacementExerciseId]
                : undefined;

              return (
                <li
                  key={`${idx}-${action.reasonType}`}
                  className={`flex h-full flex-col rounded-sm border p-3 transition-opacity ${
                    dismissed[key]
                      ? "border-foreground/25 opacity-50"
                      : "border-foreground/25 bg-muted/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {original?.name ?? action.exerciseId}
                    </span>
                    {replacement ? (
                      <>
                        <ArrowIcon />
                        <span className="text-sm font-medium text-primary">
                          {replacement.name}
                        </span>
                      </>
                    ) : action.removed ? (
                      <Badge variant="outline">Removed</Badge>
                    ) : null}
                    {action.loadMultiplier && action.loadMultiplier < 1 && (
                      <Badge>
                        {Math.round((1 - action.loadMultiplier) * 100)}% less load
                      </Badge>
                    )}
                    {action.volumeMultiplier && action.volumeMultiplier < 1 && (
                      <Badge>
                        {Math.round((1 - action.volumeMultiplier) * 100)}% less volume
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {action.reasonDetail}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleDismiss(action)}
                    >
                      {dismissed[key] ? "Undo ignore" : "Ignore"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleRestore(action)}
                    >
                      {restored[key] ? "Re-apply" : "Restore original"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-sm border border-foreground/25 bg-card p-5">
        <h3 className="font-display text-lg font-black uppercase tracking-tight">Your adjusted plan</h3>
        <div className="mt-4 flex flex-col gap-4">
          {adjusted.resultingPlan.sessions.map((session) => (
            <div key={session.id}>
              <p className="mb-2 text-sm font-semibold">
                {session.title}{" "}
                <span className="font-normal text-muted-foreground">
                  (Day {session.dayIndex + 1})
                </span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {session.exercises.map((set, i) => {
                  const exercise = EXERCISE_MAP[set.exerciseId];
                  return (
                    <li
                      key={`${session.id}-${i}`}
                      className="flex items-center justify-between rounded-sm border border-foreground/25 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span>{exercise?.name ?? set.exerciseId}</span>
                      <span className="text-xs text-muted-foreground">
                        {set.targetSets}×{set.targetReps}
                        {set.targetLoadPercent != null &&
                          ` @ ${set.targetLoadPercent}%`}
                      </span>
                    </li>
                  );
                })}
                {session.exercises.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    This session is empty after adjustments.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dismissKey(action: AdjustmentAction) {
  return `${action.reasonType}-${action.exerciseId}`;
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function buildSamplePlan(): TrainingPlan {
  const plans: Record<string, { exerciseId: string; targetSets: number; targetReps: number; targetLoadPercent?: number; restSeconds: number }[][]> = {
    "3": [
      [
        { exerciseId: "back_squat", targetSets: 4, targetReps: 6, targetLoadPercent: 80, restSeconds: 180 },
        { exerciseId: "barbell_bench_press", targetSets: 4, targetReps: 6, targetLoadPercent: 80, restSeconds: 180 },
        { exerciseId: "barbell_row", targetSets: 3, targetReps: 8, targetLoadPercent: 70, restSeconds: 120 },
      ],
      [
        { exerciseId: "deadlift", targetSets: 3, targetReps: 5, targetLoadPercent: 75, restSeconds: 180 },
        { exerciseId: "overhead_press", targetSets: 4, targetReps: 8, targetLoadPercent: 70, restSeconds: 150 },
        { exerciseId: "pull_up", targetSets: 3, targetReps: 8, restSeconds: 120 },
      ],
      [
        { exerciseId: "barbell_lunge", targetSets: 3, targetReps: 10, targetLoadPercent: 60, restSeconds: 120 },
        { exerciseId: "farmers_walk", targetSets: 3, targetReps: 12, restSeconds: 60 },
        { exerciseId: "plank", targetSets: 3, targetReps: 1, restSeconds: 60 },
      ],
    ],
    "5": [
      [
        { exerciseId: "back_squat", targetSets: 4, targetReps: 6, targetLoadPercent: 80, restSeconds: 180 },
        { exerciseId: "barbell_bench_press", targetSets: 4, targetReps: 6, targetLoadPercent: 80, restSeconds: 180 },
        { exerciseId: "barbell_row", targetSets: 3, targetReps: 8, targetLoadPercent: 70, restSeconds: 120 },
      ],
      [
        { exerciseId: "deadlift", targetSets: 3, targetReps: 5, targetLoadPercent: 75, restSeconds: 180 },
        { exerciseId: "overhead_press", targetSets: 4, targetReps: 8, targetLoadPercent: 70, restSeconds: 150 },
        { exerciseId: "pull_up", targetSets: 3, targetReps: 8, restSeconds: 120 },
      ],
      [
        { exerciseId: "barbell_lunge", targetSets: 3, targetReps: 10, targetLoadPercent: 60, restSeconds: 120 },
        { exerciseId: "farmers_walk", targetSets: 3, targetReps: 12, restSeconds: 60 },
        { exerciseId: "plank", targetSets: 3, targetReps: 1, restSeconds: 60 },
      ],
      [
        { exerciseId: "barbell_bench_press", targetSets: 4, targetReps: 8, targetLoadPercent: 75, restSeconds: 150 },
        { exerciseId: "barbell_row", targetSets: 4, targetReps: 8, targetLoadPercent: 70, restSeconds: 120 },
        { exerciseId: "dumbbell_lateral_raise", targetSets: 3, targetReps: 12, targetLoadPercent: 50, restSeconds: 90 },
      ],
      [
        { exerciseId: "running", targetSets: 1, targetReps: 1, restSeconds: 60 },
        { exerciseId: "glute_bridge", targetSets: 3, targetReps: 15, restSeconds: 60 },
        { exerciseId: "dead_bug", targetSets: 3, targetReps: 12, restSeconds: 60 },
      ],
    ],
  };

  const sessions = (plans["5"] ?? plans["3"]).map((exercises, idx) => ({
    id: `s${idx + 1}`,
    planId: "sample-plan",
    dayIndex: idx,
    title: `Session ${idx + 1}`,
    exercises: exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetLoadPercent: ex.targetLoadPercent,
      restSeconds: ex.restSeconds,
    })),
  }));

  return {
    id: "sample-plan",
    userId: "",
    name: "Sample Strength Plan",
    sessions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
