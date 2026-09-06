"use client";

import { WorkoutGenerator } from "@/components/workout/WorkoutGenerator";

export default function GenerateWorkoutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Generate a Workout
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Pick your goal, equipment, and time — then hit generate. Swap any
          exercise in an instant and start tracking right away.
        </p>
      </div>

      <div className="mt-10">
        <WorkoutGenerator />
      </div>
    </div>
  );
}