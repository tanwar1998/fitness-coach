"use client";

import Image from "next/image";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { MuscleBodySelector } from "@/components/exercise/MuscleBodySelector";
import {
  CARDIO_ID,
  EQUIPMENT_LIST,
  ExerciseInfo,
  MUSCLE_GROUPS,
  MuscleTag,
  getEnglishTranslation,
  getExerciseAliases,
  getExerciseDescription,
  getExerciseImage,
  getExerciseName,
  getMainMuscleNames,
  getPlaceholderImage,
  hasMuscleData,
  loadLocalImageMap,
  muscleName,
} from "@/lib/wger-exercise";

const PAGE_SIZE = 20;

function ExerciseCard({
  exercise,
  onSelect,
  localImages,
}: {
  exercise: ExerciseInfo;
  onSelect: () => void;
  localImages: Map<number, string>;
}) {
  const name = getExerciseName(exercise);
  const imageUrl = getExerciseImage(exercise, localImages);
  const mainMuscles = getMainMuscleNames(exercise);
  const equipment = exercise.equipment.map((e) => e.name);

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
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          <div className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
            {exercise.category.name}
          </div>
        </div>
      ) : hasMuscleData(exercise) ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <MuscleDiagram
            muscles={exercise.muscles}
            musclesSecondary={exercise.muscles_secondary}
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={getPlaceholderImage(exercise)}
            alt={name}
            fill
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          <div className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
            {exercise.category.name}
          </div>
        </div>
      )}
      <div className="p-2.5">
        {mainMuscles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mainMuscles.slice(0, 2).map((m) => (
              <MuscleTag key={m} name={m} variant="primary" />
            ))}
            {mainMuscles.length > 2 && (
              <span className="text-[11px] text-muted-foreground">
                +{mainMuscles.length - 2}
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

function ExerciseDetail({
  exercise,
  localImages,
}: {
  exercise: ExerciseInfo;
  localImages: Map<number, string>;
}) {
  const name = getExerciseName(exercise);
  const description = getExerciseDescription(exercise);
  const aliases = getExerciseAliases(exercise);
  const imageUrl = getExerciseImage(exercise, localImages);
  const mainMuscles = exercise.muscles;
  const secondaryMuscles = exercise.muscles_secondary;

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
      ) : hasMuscleData(exercise) ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-secondary">
          <MuscleDiagram
            muscles={exercise.muscles}
            musclesSecondary={exercise.muscles_secondary}
          />
        </div>
      ) : (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
          <Image
            src={getPlaceholderImage(exercise)}
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
              <Badge variant="primary">{exercise.category.name}</Badge>
              {exercise.equipment.map((eq) => (
                <Badge key={eq.id} variant="secondary">
                  {eq.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>

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
              <p className="text-2xl font-bold">{exercise.equipment.length || "—"}</p>
              <p className="text-xs text-muted-foreground">Equipment Needed</p>
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
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-[4/3] bg-secondary" />
      <div className="p-2.5">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="mt-2 flex gap-1">
          <div className="h-5 w-14 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function ExercisePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allExercises, setAllExercises] = useState<ExerciseInfo[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseInfo | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [selectedCardio, setSelectedCardio] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<number[]>([]);
  const [localImages, setLocalImages] = useState<Map<number, string>>(new Map());

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [resultFlash, setResultFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerResultFlash = useCallback(() => {
    setResultFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setResultFlash(false), 900);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedExercise(null);
    };
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedExercise]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("@/lib/wger-exerciseinfo.json"), loadLocalImageMap()]).then(
      ([exerciseInfoModule, imageMap]) => {
        if (cancelled) return;
        setAllExercises(exerciseInfoModule.default.results);
        setLocalImages(imageMap);
        setInitialLoadComplete(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const observerRef = useRef<HTMLDivElement | null>(null);

  const loading = !initialLoadComplete;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setVisibleCount(PAGE_SIZE);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (allExercises.length === 0) return;
    const timer = setTimeout(() => {
      triggerResultFlash();
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, allExercises.length]);

  const toggleEquipment = (id: number) => {
    setSelectedEquipment((prev) => (prev === id ? null : id));
    setVisibleCount(PAGE_SIZE);
    triggerResultFlash();
  };

  const toggleMuscle = (id: number) => {
    setSelectedMuscles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setVisibleCount(PAGE_SIZE);
    triggerResultFlash();
  };

  const toggleCardio = () => {
    setSelectedCardio((prev) => !prev);
    setVisibleCount(PAGE_SIZE);
    triggerResultFlash();
  };

  const filteredExercises = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (
      !q &&
      selectedEquipment === null &&
      selectedMuscles.length === 0 &&
      !selectedCardio
    ) {
      return allExercises;
    }
    return allExercises.filter((exercise) => {
      if (selectedEquipment !== null && !exercise.equipment.some((eq) => eq.id === selectedEquipment)) {
        return false;
      }
      if (selectedMuscles.length > 0 || selectedCardio) {
        const muscleMatch = exercise.muscles.some((m) => selectedMuscles.includes(m.id));
        const cardioMatch = selectedCardio && exercise.category.id === CARDIO_ID;
        if (!muscleMatch && !cardioMatch) return false;
      }
      if (!q) return true;
      const en = getEnglishTranslation(exercise.translations);
      if (!en) return false;
      if (en.name.toLowerCase().includes(q)) return true;
      return en.aliases.some((a) => a.alias.toLowerCase().includes(q));
    });
  }, [allExercises, debouncedQuery, selectedEquipment, selectedMuscles, selectedCardio]);

  const exercises = useMemo(
    () => filteredExercises.slice(0, visibleCount),
    [filteredExercises, visibleCount],
  );
  const hasMore = visibleCount < filteredExercises.length;

  useEffect(() => {
    if (!observerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredExercises.length));
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, filteredExercises.length]);

  const clearFilters = () => {
    setSelectedCardio(false);
    setSelectedEquipment(null);
    setSelectedMuscles([]);
    setQuery("");
    setDebouncedQuery("");
    setVisibleCount(PAGE_SIZE);
    triggerResultFlash();
  };

  const hasActiveFilters =
    selectedCardio ||
    selectedEquipment !== null ||
    selectedMuscles.length > 0 ||
    query !== "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Browse Exercises
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Explore hundreds of exercises with detailed instructions, muscle targets, and equipment requirements.
        </p>
      </div>

      {/* Filters */}
      <div className="mx-auto mt-10 max-w-6xl rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <Input
              label="Search Exercises"
              placeholder="e.g. bench press, squat, bicep curl..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-5">
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear all
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
              <span className="sm:hidden">
                {filtersOpen ? "Hide" : "Filters"}
              </span>
              <ChevronIcon open={filtersOpen} />
            </Button>
          </div>
        </div>

        {filtersOpen && (
          <div className="border-t border-border p-5 pt-6 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
              {/* Body map */}
              <div className="flex justify-center lg:justify-start">
                <MuscleBodySelector
                  value={selectedMuscles}
                  onChange={(id: number) => {
                    toggleMuscle(id);
                  }}
                />
              </div>

              {/* Groups + filters */}
              <div className="space-y-6">
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
                      onClick={toggleCardio}
                    >
                      Cardio
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                    Equipment
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT_LIST.map((eq) => (
                      <Button
                        key={eq.id}
                        size="sm"
                        variant={selectedEquipment === eq.id ? "primary" : "outline"}
                        onClick={() => toggleEquipment(eq.id)}
                      >
                        {eq.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mx-auto mt-10 max-w-6xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Exercises</h2>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition-all duration-500 ${
              resultFlash
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
            aria-live="polite"
          >
            {filteredExercises.length.toLocaleString()} found
          </span>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border">
              <p className="text-center text-muted-foreground">
                No exercises match your filters.
                <br />
                Try removing some filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onSelect={() => setSelectedExercise(exercise)}
                  localImages={localImages}
                />
              ))}
            </div>
          )}
          <div ref={observerRef} className="h-4" />
          {!loading && hasMore && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading more exercises…
            </p>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          selectedExercise ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSelectedExercise(null)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Exercise details"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${
          selectedExercise ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Exercise Details</h2>
          <button
            type="button"
            onClick={() => setSelectedExercise(null)}
            aria-label="Close details"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedExercise && (
            <ExerciseDetail exercise={selectedExercise} localImages={localImages} />
          )}
        </div>
      </aside>
    </div>
  );
}
