"use client";

import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  DURATION_OPTIONS,
  INTENSITY_OPTIONS,
  TARGET_AREA_OPTIONS,
  TYPE_OPTIONS,
  formatDuration,
  generateWorkout,
  titleCase,
  type ExerciseType,
  type Intensity,
  type TargetArea,
  type Workout,
  type WorkoutBlock,
  type WorkoutSection,
} from "@/lib/workout";

const EXERCISE_IMAGE = "/exercise/leg%20kicks.png";

function ChevronIcon({ open }: { open: boolean }) {
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
      className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ExerciseCard({ block, index }: { block: WorkoutBlock; index: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        <Image
          src={EXERCISE_IMAGE}
          alt={block.name}
          fill
          sizes="(min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold leading-snug">{block.name}</h4>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {block.du}s
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {block.re > 0 ? `× ${block.re} reps` : "AMRAP"}
        </p>
        <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
          {block.description}
        </p>
      </div>
    </div>
  );
}

function TransitionCard({ block }: { block: WorkoutBlock }) {
  return (
    <li className="sm:col-span-2">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <Badge variant="primary">Rest</Badge>
          <p className="font-medium">Transition</p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {block.du}s
        </span>
      </div>
    </li>
  );
}

function WorkoutSectionCard({ section }: { section: WorkoutSection }) {
  const [open, setOpen] = useState(false);
  const exerciseCount = section.blocks.filter(
    (block) => !block.isTransition,
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div>
          <h3 className="font-semibold">{titleCase(section.name)}</h3>
          <p className="text-xs text-muted-foreground">
            {exerciseCount} exercises
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            {formatDuration(section.totalSeconds)}
          </span>
          <ChevronIcon open={open} />
        </div>
      </button>

      {open && (
        <ul className="grid gap-4 border-t border-border p-5 sm:grid-cols-3">
          {section.blocks.map((block, index) =>
            block.isTransition ? (
              <TransitionCard key={`${section.name}-${index}`} block={block} />
            ) : (
              <li key={`${section.name}-${index}`}>
                <ExerciseCard block={block} index={index} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export default function ExercisePage() {
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState<string>("Strength");
  const [targetArea, setTargetArea] = useState<string>("Full Body");
  const [intensity, setIntensity] = useState<string>("Beginner");
  const [workout, setWorkout] = useState<Workout | null>(null);

  const handleGenerate = () => {
    setWorkout(
      generateWorkout({
        duration: Number(duration),
        type: type as ExerciseType,
        targetArea: targetArea as TargetArea,
        intensity: intensity as Intensity,
      }),
    );
  };

  const handleReset = () => {
    setDuration("30");
    setType("Strength");
    setTargetArea("Full Body");
    setIntensity("Beginner");
    setWorkout(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="primary" className="mb-4">
          Workout Generator
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Create Your Workout
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Pick your preferences below and we&apos;ll put together a structured
          workout that fits your time and level.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <SegmentedControl
            label="Duration"
            options={DURATION_OPTIONS}
            value={duration}
            onChange={setDuration}
          />
          <SegmentedControl
            label="Type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <SegmentedControl
            label="Target Area"
            options={TARGET_AREA_OPTIONS}
            value={targetArea}
            onChange={setTargetArea}
          />
          <SegmentedControl
            label="Intensity"
            options={INTENSITY_OPTIONS}
            value={intensity}
            onChange={setIntensity}
          />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={handleGenerate}>
            Generate Workout
          </Button>
          <Button size="lg" variant="outline" onClick={handleReset}>
            Reset Options
          </Button>
        </div>
      </div>

      {workout && (
        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">Your Workout</h2>
            <p className="text-sm text-muted-foreground">
              {Number(duration)} min · {type} · {targetArea} · {intensity} ·
              Total {formatDuration(workout.totalSeconds)}
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-6">
            {workout.sections.map((section) => (
              <WorkoutSectionCard key={section.name} section={section} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
