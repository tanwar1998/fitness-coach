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

export function GeneratedExerciseCard({
  exercise,
  info,
  localImages,
  onSelect,
}: {
  exercise: GeneratedExercise;
  info: ExerciseInfo | undefined;
  localImages: Map<number, string>;
  onSelect: () => void;
}) {
  const name = info ? getExerciseName(info) : exercise.name;
  const imageUrl = info ? getExerciseImage(info, localImages) : null;
  const category = info?.category.name ?? exercise.category;
  const muscleNames =
    info && getMainMuscleNames(info).length > 0
      ? getMainMuscleNames(info)
      : exercise.muscleLabels;
  const equipment = info ? info.equipment.map((e) => e.name) : [];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      {imageUrl ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          {category && (
            <div className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
              {category}
            </div>
          )}
        </div>
      ) : info && hasMuscleData(info) ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <MuscleDiagram muscles={info.muscles} musclesSecondary={info.muscles_secondary} />
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={info ? getPlaceholderImage(info) : "/exercise/placeholders/generic.svg"}
            alt={name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          {category && (
            <div className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
              {category}
            </div>
          )}
        </div>
      )}

      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-foreground">
            {exercise.sets}×{exercise.reps}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
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