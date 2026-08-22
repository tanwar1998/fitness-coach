"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MuscleDiagram } from "@/components/MuscleDiagram";

interface Muscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
  image_url_main: string;
  image_url_secondary: string;
}

interface Equipment {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface ExerciseImage {
  id: number;
  uuid: string;
  image: string;
  thumbnails: { small: string; medium: string } | null;
  is_main: boolean;
}

interface Translation {
  id: number;
  uuid: string;
  name: string;
  description: string;
  language: number;
  aliases: { alias: string }[];
  notes: string[];
}

interface ExerciseInfo {
  id: number;
  uuid: string;
  category: Category;
  muscles: Muscle[];
  muscles_secondary: Muscle[];
  equipment: Equipment[];
  images: ExerciseImage[];
  translations: Translation[];
  variation_group: string | null;
  author_history: string[];
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ExerciseInfo[];
}

interface LocalExerciseImage {
  image_id: number;
  file: string;
  exercise_id: number;
  name: string;
  type: string;
}

const PLACEHOLDER_CATEGORIES = new Set([
  "abs",
  "arms",
  "back",
  "calves",
  "cardio",
  "chest",
  "legs",
  "shoulders",
]);

let localImageMapPromise: Promise<Map<number, string>> | null = null;

function loadLocalImageMap(): Promise<Map<number, string>> {
  if (!localImageMapPromise) {
    localImageMapPromise = fetch("/exercise/images.json")
      .then((res) => res.json())
      .then((entries: LocalExerciseImage[]) => {
        const map = new Map<number, string>();
        for (const entry of entries) {
          if (!map.has(entry.exercise_id)) {
            map.set(entry.exercise_id, `/exercise/${entry.file}`);
          }
        }
        return map;
      })
      .catch(() => new Map<number, string>());
  }
  return localImageMapPromise;
}

function getPlaceholderImage(exercise: ExerciseInfo): string {
  const slug = exercise.category.name.toLowerCase();
  const file = PLACEHOLDER_CATEGORIES.has(slug) ? slug : "generic";
  return `/exercise/placeholders/${file}.svg`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getEnglishTranslation(translations: Translation[]): Translation | undefined {
  return translations.find((t) => t.language === 2);
}

function getExerciseName(exercise: ExerciseInfo): string {
  const en = getEnglishTranslation(exercise.translations);
  if (en) return en.name;
  if (exercise.translations.length > 0) return exercise.translations[0].name;
  return "Unnamed Exercise";
}

function getExerciseDescription(exercise: ExerciseInfo): string {
  const en = getEnglishTranslation(exercise.translations);
  const desc = en?.description || exercise.translations[0]?.description || "";
  return stripHtml(desc);
}

function getExerciseAliases(exercise: ExerciseInfo): string[] {
  const en = getEnglishTranslation(exercise.translations);
  if (!en) return [];
  return en.aliases.map((a) => a.alias);
}

function getExerciseImage(
  exercise: ExerciseInfo,
  localImages: Map<number, string>,
): string | null {
  const main = exercise.images.find((img) => img.is_main);
  if (main) return main.thumbnails?.medium || main.image;
  if (exercise.images.length > 0) {
    const first = exercise.images[0];
    return first.thumbnails?.medium || first.image;
  }
  return localImages.get(exercise.id) ?? null;
}

function hasMuscleData(exercise: ExerciseInfo): boolean {
  return exercise.muscles.length > 0 || exercise.muscles_secondary.length > 0;
}

function getMainMuscleNames(exercise: ExerciseInfo): string[] {
  return exercise.muscles.map((m) => m.name_en || m.name);
}

function getSecondaryMuscleNames(exercise: ExerciseInfo): string[] {
  return exercise.muscles_secondary.map((m) => m.name_en || m.name);
}

function MuscleTag({ name, variant }: { name: string; variant: "primary" | "secondary" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        variant === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {variant === "primary" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
      {name}
    </span>
  );
}

function ExerciseCard({
  exercise,
  isSelected,
  onSelect,
  localImages,
}: {
  exercise: ExerciseInfo;
  isSelected: boolean;
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
      className={`w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:shadow-md ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40"
      }`}
    >
      {imageUrl ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold backdrop-blur">
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
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="truncate text-sm font-bold text-white drop-shadow-md">{name}</h3>
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            {exercise.category.name}
          </div>
        </div>
      )}
      <div className="p-3">
        {mainMuscles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {mainMuscles.map((m) => (
              <MuscleTag key={m} name={m} variant="primary" />
            ))}
            {getSecondaryMuscleNames(exercise)
              .slice(0, 2)
              .map((m) => (
                <MuscleTag key={m} name={m} variant="secondary" />
              ))}
          </div>
        )}
        {equipment.length > 0 && (
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {equipment.join(" · ")}
          </p>
        )}
      </div>
    </button>
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {imageUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
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
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{name}</h2>
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
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Primary Muscles
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {mainMuscles.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2"
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
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2"
                >
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm font-medium">{m.name_en || m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(mainMuscles.length > 0 || secondaryMuscles.length > 0) && (
          <div className="mt-6 grid grid-cols-2 gap-4">
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
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Instructions
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        )}

        {exercise.author_history.length > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            Contributed by: {exercise.author_history.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-36 bg-secondary" />
      <div className="p-3">
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
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<number | null>(null);
  const [localImages, setLocalImages] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    loadLocalImageMap().then((map) => {
      if (!cancelled) setLocalImages(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const observerRef = useRef<HTMLDivElement | null>(null);

  const loading = !initialLoadComplete;

  useEffect(() => {
    async function loadFilters() {
      try {
        const [catRes, eqRes, musRes] = await Promise.all([
          fetch("https://wger.de/api/v2/exercisecategory/?limit=50&format=json"),
          fetch("https://wger.de/api/v2/equipment/?limit=50&format=json"),
          fetch("https://wger.de/api/v2/muscle/?limit=50&format=json"),
        ]);
        const [catData, eqData, musData] = await Promise.all([
          catRes.json(),
          eqRes.json(),
          musRes.json(),
        ]);
        setCategories(catData.results);
        setEquipmentList(eqData.results);
        setMuscles(musData.results);
      } catch {
        // Filters are optional — exercise list still works without them
      }
    }
    loadFilters();
  }, []);

  const fetchMore = useCallback(
    async (url: string) => {
      setLoadingMore(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data: ApiResponse = await res.json();
        setExercises((prev) => [...prev, ...data.results]);
        setNextUrl(data.next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch exercises");
      } finally {
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const baseUrl = "https://wger.de/api/v2/exerciseinfo/?language=2&limit=20&format=json";
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (selectedCategory) params.set("category", String(selectedCategory));
    if (selectedEquipment) params.set("equipment", String(selectedEquipment));
    if (selectedMuscle) params.set("muscles", String(selectedMuscle));

    const url = `${baseUrl}&${params.toString()}`;
    let cancelled = false;

    async function load() {
      const res = await fetch(url);
      if (cancelled) return;
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ApiResponse = await res.json();
      if (cancelled) return;
      setExercises(data.results);
      setNextUrl(data.next);
      setError(null);
      setInitialLoadComplete(true);
    }

    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to fetch exercises");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, selectedCategory, selectedEquipment, selectedMuscle]);

  useEffect(() => {
    if (!observerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextUrl && !loadingMore) {
          fetchMore(nextUrl);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [nextUrl, loadingMore, fetchMore]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedEquipment(null);
    setSelectedMuscle(null);
    setQuery("");
  };

  const hasActiveFilters =
    selectedCategory !== null || selectedEquipment !== null || selectedMuscle !== null || query !== "";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="primary" className="mb-4">
          Exercise Library
        </Badge>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Browse Exercises
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Explore hundreds of exercises with detailed instructions, muscle targets, and equipment requirements.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Input
          label="Search Exercises"
          placeholder="e.g. bench press, squat, bicep curl..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-foreground">Category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? "primary" : "outline"}
                onClick={() =>
                  setSelectedCategory((prev) => (prev === cat.id ? null : cat.id))
                }
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-foreground">Equipment</p>
          <div className="flex flex-wrap gap-2">
            {equipmentList.map((eq) => (
              <Button
                key={eq.id}
                size="sm"
                variant={selectedEquipment === eq.id ? "primary" : "outline"}
                onClick={() =>
                  setSelectedEquipment((prev) => (prev === eq.id ? null : eq.id))
                }
              >
                {eq.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-foreground">Muscle</p>
          <div className="flex flex-wrap gap-2">
            {muscles.map((mus) => (
              <Button
                key={mus.id}
                size="sm"
                variant={selectedMuscle === mus.id ? "primary" : "outline"}
                onClick={() =>
                  setSelectedMuscle((prev) => (prev === mus.id ? null : mus.id))
                }
              >
                {mus.name_en || mus.name}
              </Button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-4xl rounded-xl border border-danger/30 bg-danger/10 px-5 py-4 text-center text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Exercises</h2>
            <span className="text-sm text-muted-foreground">
              {exercises.length.toLocaleString()} loaded
            </span>
          </div>
          <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    isSelected={selectedExercise?.id === exercise.id}
                    onSelect={() => setSelectedExercise(exercise)}
                    localImages={localImages}
                  />
                ))}
            <div ref={observerRef} className="h-4" />
            {loadingMore && (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading more...</div>
            )}
            {!loading && exercises.length === 0 && (
              <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border">
                <p className="text-center text-muted-foreground">No exercises found</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="font-display text-lg font-bold">Details</h2>
          <div className="mt-4">
            {selectedExercise ? (
              <ExerciseDetail exercise={selectedExercise} localImages={localImages} />
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                <p className="text-center text-muted-foreground">
                  Select an exercise from the list
                  <br />
                  to view its full details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
