"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { MuscleBodySelector } from "@/components/exercise/MuscleBodySelector";
import { GeneratedExerciseCard } from "@/components/workout/GeneratedExerciseCard";
import { EXERCISE_MAP } from "@/lib/injury-recovery";
import {
  CARDIO_ID,
  ExerciseInfo,
  MUSCLE_GROUPS,
  getExerciseAliases,
  getExerciseDescription,
  getExerciseImage,
  getExerciseName,
  getPlaceholderImage,
  hasMuscleData,
  loadLocalImageMap,
  muscleName,
} from "@/lib/wger-exercise";
import { loadExerciseInfo } from "@/lib/wger-data";
import {
  equipmentDisplayFor,
  estimateWorkout,
  type GeneratedExercise,
  type GeneratedWorkout,
} from "@/lib/workout-generator";

interface ResolvedItem {
  exercise: GeneratedExercise;
  index: number;
  info: ExerciseInfo | undefined;
}

function resolveToWger(
  exercise: GeneratedExercise,
  library: ExerciseInfo[],
): ExerciseInfo | undefined {
  let id: number | null = null;
  if (exercise.source === "wger") {
    id = Number(exercise.exerciseId);
  } else {
    id = EXERCISE_MAP[exercise.exerciseId]?.wgerId ?? null;
  }
  if (id == null) return undefined;
  return library.find((ex) => ex.id === id);
}

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
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0l1.582 6.135A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
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
      className={`transition-transform duration-200 ${open ? "" : "-rotate-180"}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

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

function WorkoutExerciseDetail({
  item,
  localImages,
  onSwap,
  onRemove,
}: {
  item: ResolvedItem;
  localImages: Map<number, string>;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const { exercise, info } = item;
  const name = info ? getExerciseName(info) : exercise.name;
  const description = info ? getExerciseDescription(info) : "";
  const aliases = info ? getExerciseAliases(info) : [];
  const imageUrl = info ? getExerciseImage(info, localImages) : null;
  const mainMuscles = info?.muscles ?? [];
  const secondaryMuscles = info?.muscles_secondary ?? [];
  const muscles = info ? info.muscles.map((m) => m.name_en || m.name) : exercise.muscleLabels;
  const equipment = equipmentDisplayFor(exercise, info?.equipment);

  return (
    <div>
      {imageUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-contain"
            unoptimized
          />
        </div>
      ) : info && hasMuscleData(info) ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-secondary">
          <MuscleDiagram muscles={info.muscles} musclesSecondary={info.muscles_secondary} />
        </div>
      ) : (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
          <Image
            src={info ? getPlaceholderImage(info) : "/exercise/placeholders/generic.svg"}
            alt={name}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold leading-tight">{name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {info?.category.name && <Badge variant="primary">{info.category.name}</Badge>}
              {exercise.movementPatternLabel && (
                <Badge variant="outline">{exercise.movementPatternLabel}</Badge>
              )}
              {equipment.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Workout prescription */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold">{exercise.sets}</p>
            <p className="text-xs text-muted-foreground">Sets</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold">{exercise.reps}</p>
            <p className="text-xs text-muted-foreground">Reps</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold">
              {Math.round(exercise.restSeconds / 60)}m
            </p>
            <p className="text-xs text-muted-foreground">Rest</p>
          </div>
        </div>
        {exercise.showLoad && exercise.targetLoadPercent != null && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Target load: {exercise.targetLoadPercent}% of 1RM
          </p>
        )}

        {aliases.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Also known as
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{aliases.join(", ")}</p>
          </div>
        )}

        {mainMuscles.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Primary Muscles
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {mainMuscles.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5"
                >
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">{m.name_en || m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {secondaryMuscles.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Secondary Muscles
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {secondaryMuscles.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5"
                >
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm font-medium">{m.name_en || m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(mainMuscles.length > 0 || secondaryMuscles.length > 0) && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold">{mainMuscles.length + secondaryMuscles.length}</p>
              <p className="text-xs text-muted-foreground">Muscles Targeted</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold">{equipment.length || "—"}</p>
              <p className="text-xs text-muted-foreground">Equipment Needed</p>
            </div>
          </div>
        )}

        {muscles.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Muscles Worked
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {muscles.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {description && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Instructions
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
          <Button onClick={onSwap}>
            <SwapIcon />
            Swap exercise
          </Button>
          <Button variant="outline" onClick={onRemove}>
            Remove from workout
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GeneratedWorkoutView({
  workout,
  onRegenerate,
  onStart,
  onSwap,
  onRemove,
  onAdd,
}: {
  workout: GeneratedWorkout;
  onRegenerate: () => void;
  onStart: () => void;
  onSwap: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const [library, setLibrary] = useState<ExerciseInfo[]>([]);
  const [localImages, setLocalImages] = useState<Map<number, string>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<number[]>([]);
  const [selectedCardio, setSelectedCardio] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadExerciseInfo(), loadLocalImageMap()]).then(
      ([exerciseList, imageMap]) => {
        if (cancelled) return;
        setLibrary(exerciseList);
        setLocalImages(imageMap);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
    };
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedIndex]);

  const items = useMemo<ResolvedItem[]>(
    () =>
      workout.exercises.map((exercise, index) => ({
        exercise,
        index,
        info: resolveToWger(exercise, library),
      })),
    [workout.exercises, library],
  );

  const estimate = useMemo(() => estimateWorkout(workout), [workout]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (selectedMuscles.length === 0 && !selectedCardio) return true;
        if (selectedCardio) {
          if (item.info?.category.id === CARDIO_ID) return true;
          if (item.info === undefined && item.exercise.category === "Cardio") return true;
        }
        if (selectedMuscles.length > 0 && item.info) {
          if (item.info.muscles.some((m) => selectedMuscles.includes(m.id))) return true;
          if (
            item.info.muscles_secondary.some((m) => selectedMuscles.includes(m.id))
          )
            return true;
        }
        return false;
      }),
    [items, selectedMuscles, selectedCardio],
  );

  const selectedItem =
    selectedIndex !== null ? items[selectedIndex] ?? null : null;

  const toggleMuscle = (id: number) => {
    setSelectedMuscles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearFilters = () => {
    setSelectedMuscles([]);
    setSelectedCardio(false);
  };

  const hasActiveFilters = selectedMuscles.length > 0 || selectedCardio;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Your generated workout</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ~{estimate.minutes} min · ~{estimate.kcal} kcal ·{" "}
            {workout.exercises.length} exercises ·{" "}
            {workout.goal.replace("_", " ")} · {workout.level}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRegenerate}>
            <SparklesIcon />
            Regenerate
          </Button>
          <Button onClick={onStart}>Start workout</Button>
        </div>
      </div>

      {/* Filters — same body-region structure as the exercise page */}
      <div className="mx-auto mt-8 max-w-6xl rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 p-5 sm:p-6">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              Filter by muscle group — only matching exercises in this workout are shown.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              <span className="hidden sm:inline">
                {filtersOpen ? "Hide filters" : "Show filters"}
              </span>
              <span className="sm:hidden">{filtersOpen ? "Hide" : "Filters"}</span>
              <ChevronIcon open={filtersOpen} />
            </Button>
          </div>
        </div>

        {filtersOpen && (
          <div className="border-t border-border p-5 pt-6 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
              <div className="flex justify-center lg:justify-start">
                <MuscleBodySelector
                  value={selectedMuscles}
                  onChange={(id: number) => toggleMuscle(id)}
                />
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                  Body part
                </p>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {MUSCLE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.ids.map((id) => (
                          <Button
                            key={id}
                            size="sm"
                            variant={selectedMuscles.includes(id) ? "primary" : "outline"}
                            onClick={() => toggleMuscle(id)}
                          >
                            {muscleName(id)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant={selectedCardio ? "primary" : "outline"}
                    onClick={() => setSelectedCardio((v) => !v)}
                  >
                    Cardio
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mx-auto mt-8 max-w-6xl">
        <div className="flex items-center justify-between">
          {!hasActiveFilters ? (
            <span className="text-sm text-muted-foreground">
              Tap an exercise for details, or swap it.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {visible.length} of {workout.exercises.length} exercises match
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <GeneratedExerciseCard
              key={item.exercise.key}
              exercise={item.exercise}
              info={item.info}
              localImages={localImages}
              onSelect={() => setSelectedIndex(item.index)}
              onSwap={() => {
                setSelectedIndex(null);
                onSwap(item.index);
              }}
              onRemove={() => {
                setSelectedIndex(null);
                onRemove(item.index);
              }}
            />
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
              +
            </span>
            <span className="text-sm font-medium">Add exercise</span>
          </button>
        </div>

        {visible.length === 0 && (
          <div className="mt-4 flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-border">
            <p className="text-center text-sm text-muted-foreground">
              No exercises in this workout match the selected muscles.
              <br />
              Clear the filter to see them all.
            </p>
          </div>
        )}
      </div>

      {/* Slide-in detail panel */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          selectedItem ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSelectedIndex(null)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Exercise details"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${
          selectedItem ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Exercise Details</h2>
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            aria-label="Close details"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedItem && (
            <WorkoutExerciseDetail
              item={selectedItem}
              localImages={localImages}
              onSwap={() => {
                const index = selectedItem.index;
                setSelectedIndex(null);
                onSwap(index);
              }}
              onRemove={() => {
                const index = selectedItem.index;
                setSelectedIndex(null);
                onRemove(index);
              }}
            />
          )}
        </div>
      </aside>
    </section>
  );
}