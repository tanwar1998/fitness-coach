"use client";

import Image from "next/image";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import {
  ExerciseInfo,
  MuscleTag,
  getExerciseImage,
  getExerciseName,
  getMainMuscleNames,
  getPlaceholderImage,
  hasMuscleData,
} from "@/lib/wger-exercise";
import type { GeneratedExercise } from "@/lib/workout-generator";
import { equipmentDisplayFor } from "@/lib/workout-generator";

function SwapIcon() {
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
      <path d="m7 4-3 3 3 3" />
      <path d="M4 7h13a3 3 0 0 1 3 3v1" />
      <path d="m17 20 3-3-3-3" />
      <path d="M20 17H7a3 3 0 0 1-3-3v-1" />
    </svg>
  );
}

function RemoveIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function HoverActions({
  onSwap,
  onRemove,
}: {
  onSwap: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSwap();
        }}
        className="grid h-8 w-8 cursor-pointer place-items-center rounded-sm bg-black/70 text-white transition-colors hover:bg-primary/90 hover:text-primary-foreground"
        aria-label="Swap exercise"
        title="Swap exercise"
      >
        <SwapIcon />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="grid h-8 w-8 cursor-pointer place-items-center rounded-sm bg-black/70 text-white transition-colors hover:bg-danger/90 hover:text-white"
        aria-label="Remove from workout"
        title="Remove from workout"
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

function CardHeader({
  name,
  category,
  onSwap,
  onRemove,
}: {
  name: string;
  category?: string;
  onSwap: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute bottom-2.5 left-2.5 right-2.5">
        <h3 className="truncate text-sm font-bold text-white">
          {name}
        </h3>
      </div>
      {category && (
        <div className="absolute left-2.5 top-2.5 rounded-sm bg-background/90 px-2 py-0.5 text-[11px] font-semibold">
          {category}
        </div>
      )}
      <HoverActions onSwap={onSwap} onRemove={onRemove} />
    </>
  );
}

export function GeneratedExerciseCard({
  exercise,
  info,
  localImages,
  onSelect,
  onSwap,
  onRemove,
}: {
  exercise: GeneratedExercise;
  info: ExerciseInfo | undefined;
  localImages: Map<number, string>;
  onSelect: () => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const name = info ? getExerciseName(info) : exercise.name;
  const imageUrl = info ? getExerciseImage(info, localImages) : null;
  const category = info?.category.name ?? exercise.category;
  const muscleNames =
    info && getMainMuscleNames(info).length > 0
      ? getMainMuscleNames(info)
      : exercise.muscleLabels;
  const equipment = equipmentDisplayFor(exercise, info?.equipment);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative w-full overflow-hidden rounded-sm border border-foreground/25 bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/50"
    >
      {imageUrl ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover mix-blend-multiply transition-transform duration-300 group-hover:scale-105 dark:mix-blend-lighten"
            unoptimized
          />
          <CardHeader
            name={name}
            category={category}
            onSwap={onSwap}
            onRemove={onRemove}
          />
        </div>
      ) : info && hasMuscleData(info) ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <MuscleDiagram
            muscles={info.muscles}
            musclesSecondary={info.muscles_secondary}
          />
          <HoverActions onSwap={onSwap} onRemove={onRemove} />
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={info ? getPlaceholderImage(info) : "/exercise/placeholders/generic.svg"}
            alt={name}
            fill
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover mix-blend-multiply transition-transform duration-300 group-hover:scale-105 dark:mix-blend-lighten"
            unoptimized
          />
          <CardHeader
            name={name}
            category={category}
            onSwap={onSwap}
            onRemove={onRemove}
          />
        </div>
      )}

      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="serial text-xs font-bold text-foreground">
            {exercise.sets}×{exercise.reps}
          </span>
          <span className="serial text-[11px] font-medium text-muted-foreground">
            {Math.round(exercise.restSeconds / 60)}m rest
          </span>
        </div>
        {muscleNames.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {muscleNames.slice(0, 2).map((m) => (
              <MuscleTag key={m} name={m} variant="primary" />
            ))}
            {muscleNames.length > 2 && (
              <span className="text-[11px] text-muted-foreground">
                +{muscleNames.length - 2}
              </span>
            )}
          </div>
        )}
        {equipment.length > 0 && (
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            {equipment.slice(0, 2).join(" · ")}
            {equipment.length > 2 ? "…" : ""}
          </p>
        )}
      </div>
    </button>
  );
}