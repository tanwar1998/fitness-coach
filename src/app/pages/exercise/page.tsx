"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
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
import { loadExerciseInfo } from "@/lib/wger-data";
import { buildWgerExercise, type GeneratedWorkout } from "@/lib/workout-generator";
import {
  upsertWorkout,
  type WorkoutHistoryEntry,
} from "@/lib/workout-history";

const PAGE_SIZE = 20;

const BOOKMARKS_KEY = "fitpulse:bookmarked-exercises";
const HISTORY_KEY = "fitpulse:workout-history";

let cachedBookmarks: string | null = null;
function bookmarksSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  const value = window.localStorage.getItem(BOOKMARKS_KEY) ?? "[]";
  if (cachedBookmarks !== value) cachedBookmarks = value;
  return cachedBookmarks;
}
function bookmarksServerSnapshot(): string {
  return "[]";
}
function subscribeBookmarks(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === BOOKMARKS_KEY || e.key === null) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener("bookmarks-changed", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("bookmarks-changed", onCustom);
  };
}
function writeBookmarks(set: Set<number>) {
  const json = JSON.stringify([...set].sort((a, b) => a - b));
  try {
    cachedBookmarks = json;
    window.localStorage.setItem(BOOKMARKS_KEY, json);
    window.dispatchEvent(new Event("bookmarks-changed"));
  } catch {
    // storage unavailable — ignore
  }
}

let cachedHistory: string | null = null;
function historySnapshot(): string {
  if (typeof window === "undefined") return "[]";
  const value = window.localStorage.getItem(HISTORY_KEY) ?? "[]";
  if (cachedHistory !== value) cachedHistory = value;
  return cachedHistory;
}
function historyServerSnapshot(): string {
  return "[]";
}
function subscribeHistory(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === HISTORY_KEY || e.key === null) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener("workouts-changed", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("workouts-changed", onCustom);
  };
}

function parseHistory(value: string): WorkoutHistoryEntry[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is WorkoutHistoryEntry =>
        entry &&
        typeof entry === "object" &&
        typeof entry.workout === "object" &&
        typeof entry.workout.id === "string" &&
        typeof entry.status === "string",
    );
  } catch {
    return [];
  }
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PlusIcon() {
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
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CheckIcon() {
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
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExerciseCard({
  exercise,
  onSelect,
  localImages,
  onBookmark,
  onAddToRoutine,
  bookmarked,
  inRoutine,
}: {
  exercise: ExerciseInfo;
  onSelect: () => void;
  localImages: Map<number, string>;
  onBookmark?: (exercise: ExerciseInfo) => void;
  onAddToRoutine?: (exercise: ExerciseInfo) => void;
  bookmarked?: boolean;
  inRoutine?: boolean;
}) {
  const name = getExerciseName(exercise);
  const imageUrl = getExerciseImage(exercise, localImages);
  const mainMuscles = getMainMuscleNames(exercise);
  const equipment = exercise.equipment.map((e) => e.name);

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmark?.(exercise);
  };

  const handleAddToRoutine = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToRoutine?.(exercise);
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          <div className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
            {exercise.category.name}
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              onClick={handleBookmark}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${
                bookmarked
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark exercise"}
            >
              <BookmarkIcon filled={bookmarked} />
            </button>
            <button
              type="button"
              onClick={handleAddToRoutine}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${
                inRoutine
                  ? "bg-success/90 text-white"
                  : "bg-black/50 text-white hover:bg-primary/90 hover:text-primary-foreground"
              }`}
              aria-label={inRoutine ? "Remove from workouts" : "Add to workout"}
              title={inRoutine ? "Added to routine" : "Add to workout"}
            >
              {inRoutine ? <CheckIcon /> : <PlusIcon />}
            </button>
          </div>
        </div>
      ) : hasMuscleData(exercise) ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <MuscleDiagram
            muscles={exercise.muscles}
            musclesSecondary={exercise.muscles_secondary}
          />
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              onClick={handleBookmark}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${
                bookmarked
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark exercise"}
            >
              <BookmarkIcon filled={bookmarked} />
            </button>
            <button
              type="button"
              onClick={handleAddToRoutine}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${
                inRoutine
                  ? "bg-success/90 text-white"
                  : "bg-black/50 text-white hover:bg-primary/90 hover:text-primary-foreground"
              }`}
              aria-label={inRoutine ? "Remove from workouts" : "Add to workout"}
              title={inRoutine ? "Added to routine" : "Add to workout"}
            >
              {inRoutine ? <CheckIcon /> : <PlusIcon />}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={getPlaceholderImage(exercise)}
            alt={name}
            fill
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover mix-blend-multiply transition-transform duration-300 group-hover:scale-105 dark:mix-blend-lighten"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          <div className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
            {exercise.category.name}
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              onClick={handleBookmark}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${
                bookmarked
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark exercise"}
            >
              <BookmarkIcon filled={bookmarked} />
            </button>
            <button
              type="button"
              onClick={handleAddToRoutine}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${
                inRoutine
                  ? "bg-success/90 text-white"
                  : "bg-black/50 text-white hover:bg-primary/90 hover:text-primary-foreground"
              }`}
              aria-label={inRoutine ? "Remove from workouts" : "Add to workout"}
              title={inRoutine ? "Added to routine" : "Add to workout"}
            >
              {inRoutine ? <CheckIcon /> : <PlusIcon />}
            </button>
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

  const [showBookmarked, setShowBookmarked] = useState(false);
  const [routineTarget, setRoutineTarget] = useState<ExerciseInfo | null>(null);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  const bookmarksSnapshotString = useSyncExternalStore(
    subscribeBookmarks,
    bookmarksSnapshot,
    bookmarksServerSnapshot,
  );
  const bookmarkIds = useMemo(() => {
    try {
      const parsed = JSON.parse(bookmarksSnapshotString);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (x): x is number => typeof x === "number" && Number.isFinite(x),
      );
    } catch {
      return [];
    }
  }, [bookmarksSnapshotString]);
  const bookmarkedIds = useMemo(() => new Set(bookmarkIds), [bookmarkIds]);

  const historySnapshotString = useSyncExternalStore(
    subscribeHistory,
    historySnapshot,
    historyServerSnapshot,
  );
  const workouts = useMemo(
    () => parseHistory(historySnapshotString),
    [historySnapshotString],
  );

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
    if (!routineTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRoutineTarget(null);
    };
    window.addEventListener("keydown", onKey);
    if (!selectedExercise) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = originalOverflow;
      };
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [routineTarget, selectedExercise]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadExerciseInfo(), loadLocalImageMap()]).then(
      ([exerciseList, imageMap]) => {
        if (cancelled) return;
        setAllExercises(exerciseList);
        setLocalImages(imageMap);
        setInitialLoadComplete(true);
      },
      () => {
        if (!cancelled) setInitialLoadComplete(true);
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
      if (showBookmarked) {
        return allExercises.filter((ex) => bookmarkedIds.has(ex.id));
      }
      return allExercises;
    }
    let list = allExercises.filter((exercise) => {
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
    if (showBookmarked) list = list.filter((ex) => bookmarkedIds.has(ex.id));
    return list;
  }, [allExercises, debouncedQuery, selectedEquipment, selectedMuscles, selectedCardio, showBookmarked, bookmarkedIds]);

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
    setShowBookmarked(false);
    setVisibleCount(PAGE_SIZE);
    triggerResultFlash();
  };

  const toggleBookmark = (exercise: ExerciseInfo) => {
    const next = new Set(bookmarkedIds);
    if (next.has(exercise.id)) {
      next.delete(exercise.id);
    } else {
      next.add(exercise.id);
    }
    writeBookmarks(next);
  };

  const toggleAddToRoutine = (exercise: ExerciseInfo) => {
    setRoutineTarget(exercise);
  };

  const isInAnyWorkout = (id: number) =>
    workouts.some((entry) =>
      entry.workout.exercises.some((e) => e.exerciseId === String(id)),
    );

  const handleAddToWorkout = (entry: WorkoutHistoryEntry) => {
    if (!routineTarget) return;
    const template = entry.workout.exercises[0];
    const slotConfig = template
      ? {
          sets: template.sets,
          reps: template.reps,
          restSeconds: template.restSeconds,
        }
      : { sets: 3, reps: "8-12" as string, restSeconds: 60 };
    const added = buildWgerExercise(
      routineTarget.id,
      getExerciseName(routineTarget),
      routineTarget.category.name,
      routineTarget.muscles.map((m) => m.name_en || m.name),
      slotConfig,
    );
    const next: GeneratedWorkout = {
      ...entry.workout,
      exercises: [...entry.workout.exercises, added],
    };
    upsertWorkout(next);
    window.dispatchEvent(new Event("workouts-changed"));
    setAddedFeedback(entry.workout.id);
    window.setTimeout(() => {
      setAddedFeedback((prev) => (prev === entry.workout.id ? null : prev));
    }, 1600);
  };

  const activeFilterCount =
    (selectedCardio ? 1 : 0) +
    (selectedEquipment !== null ? 1 : 0) +
    selectedMuscles.length +
    (query !== "" ? 1 : 0) +
    (showBookmarked ? 1 : 0);

  const activeFilterTags: { label: string; onRemove: () => void }[] = [];
  if (query !== "") {
    activeFilterTags.push({
      label: `\u201c${query}\u201d`,
      onRemove: () => {
        setQuery("");
        setDebouncedQuery("");
        setVisibleCount(PAGE_SIZE);
      },
    });
  }
  if (selectedCardio) {
    activeFilterTags.push({
      label: "Cardio",
      onRemove: () => {
        setSelectedCardio(false);
        setVisibleCount(PAGE_SIZE);
      },
    });
  }
  if (selectedEquipment !== null) {
    const eq = EQUIPMENT_LIST.find((e) => e.id === selectedEquipment);
    if (eq) {
      activeFilterTags.push({
        label: eq.name,
        onRemove: () => {
          setSelectedEquipment(null);
          setVisibleCount(PAGE_SIZE);
        },
      });
    }
  }
  for (const muscleId of selectedMuscles) {
    const name = muscleName(muscleId);
    activeFilterTags.push({
      label: name,
      onRemove: () => {
        setSelectedMuscles((prev) => prev.filter((x) => x !== muscleId));
        setVisibleCount(PAGE_SIZE);
      },
    });
  }

  const hasActiveFilters =
    selectedCardio ||
    selectedEquipment !== null ||
    selectedMuscles.length > 0 ||
    query !== "" ||
    showBookmarked;

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
              className="relative"
            >
              <span className="hidden sm:inline">
                {filtersOpen ? "Hide filters" : "Show filters"}
              </span>
              <span className="sm:hidden">
                {filtersOpen ? "Hide" : "Filters"}
              </span>
              {activeFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-bold">Exercises</h2>
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => {
                  setShowBookmarked(false);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  !showBookmarked
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBookmarked(true);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  showBookmarked
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bookmarked
                {bookmarkIds.length > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      showBookmarked
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {bookmarkIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Active:</span>
                {activeFilterTags.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={tag.onRemove}
                    title={`Remove filter: ${tag.label}`}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    {tag.label}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
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
              {showBookmarked && bookmarkIds.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  No bookmarked exercises yet.
                  <br />
                  Tap the bookmark icon on any exercise to save it here.
                </p>
              ) : showBookmarked ? (
                <p className="text-center text-muted-foreground">
                  No bookmarked exercises match your filters.
                  <br />
                  Try removing some filters.
                </p>
              ) : (
                <p className="text-center text-muted-foreground">
                  No exercises match your filters.
                  <br />
                  Try removing some filters.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onSelect={() => setSelectedExercise(exercise)}
                  localImages={localImages}
                  onBookmark={toggleBookmark}
                  onAddToRoutine={toggleAddToRoutine}
                  bookmarked={bookmarkedIds.has(exercise.id)}
                  inRoutine={isInAnyWorkout(exercise.id)}
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
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Exercise Details</h2>
          <div className="flex items-center gap-2">
            {selectedExercise && (
              <>
                <Button
                  size="sm"
                  variant={bookmarkedIds.has(selectedExercise.id) ? "primary" : "outline"}
                  onClick={() => toggleBookmark(selectedExercise)}
                >
                  <BookmarkIcon filled={bookmarkedIds.has(selectedExercise.id)} />
                  <span className="hidden sm:inline">
                    {bookmarkedIds.has(selectedExercise.id) ? "Saved" : "Bookmark"}
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant={isInAnyWorkout(selectedExercise.id) ? "primary" : "outline"}
                  onClick={() => toggleAddToRoutine(selectedExercise)}
                >
                  {isInAnyWorkout(selectedExercise.id) ? <CheckIcon /> : <PlusIcon />}
                  <span className="hidden sm:inline">
                    {isInAnyWorkout(selectedExercise.id) ? "In a Workout" : "Add to Workout"}
                  </span>
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedExercise(null)}
              aria-label="Close details"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedExercise && (
            <ExerciseDetail exercise={selectedExercise} localImages={localImages} />
          )}
        </div>
      </aside>

      {/* Add-to-workout picker */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          routineTarget ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setRoutineTarget(null)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Add to a generated workout"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${
          routineTarget ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Add to workout</h2>
          <button
            type="button"
            onClick={() => setRoutineTarget(null)}
            aria-label="Close"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {routineTarget && (
            <div className="mb-5 rounded-xl bg-secondary/40 p-4">
              <p className="text-sm font-semibold text-foreground">
                {getExerciseName(routineTarget)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a generated workout to add this exercise to. It will keep
                that workout’s sets, reps, and rest style.
              </p>
            </div>
          )}

          {workouts.filter((w) => w.status === "draft").length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  No draft workouts yet.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate a workout first, then come back to add exercises to it.
                </p>
                <Link href="/pages/generate-workout">
                  <Button size="sm" variant="outline" className="mt-4">
                    Go to Generate Workout
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {workouts
                .filter((w) => w.status === "draft")
                .map((entry) => {
                  const contains = entry.workout.exercises.some(
                    (e) =>
                      routineTarget &&
                      e.exerciseId === String(routineTarget.id),
                  );
                  const justAdded = addedFeedback === entry.workout.id;
                  return (
                    <li
                      key={entry.workout.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {entry.workout.goal.replace("_", " ")} ·{" "}
                          {new Date(entry.workout.createdAt).toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.workout.durationMinutes} min ·{" "}
                          {entry.workout.exercises.length} exercises ·{" "}
                          {entry.workout.level} · {entry.workout.preset}
                        </p>
                      </div>
                      {justAdded ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-success">
                          <CheckIcon /> Added
                        </span>
                      ) : contains ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
                          <CheckIcon /> Added
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddToWorkout(entry)}
                        >
                          Add
                        </Button>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
