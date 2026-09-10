"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { loadExerciseInfo } from "@/lib/wger-data";
import type { EquipmentPreset } from "@/lib/workout-generator";

export interface PickerResult {
  id: number;
  name: string;
  category: string;
  muscles: string[];
}

interface WgerEquipment {
  id: number;
  name: string;
}

interface WgerCategory {
  id: number;
  name: string;
}

interface WgerTranslation {
  name: string;
  language: number;
}

interface WgerExerciseInfo {
  id: number;
  category: WgerCategory;
  equipment: WgerEquipment[];
  muscles: { id: number; name: string; name_en?: string }[];
  translations: WgerTranslation[];
}

function getExerciseName(exercise: WgerExerciseInfo): string {
  const en = exercise.translations.find((t) => t.language === 2);
  if (en?.name) return en.name;
  return exercise.translations[0]?.name || "Unnamed Exercise";
}

const PRESET_EQUIPMENT_NAMES: Record<EquipmentPreset, Set<string> | null> = {
  full: null,
  dumbbell: new Set(["Dumbbell", "Bands", "Body only", "Gym mat"]),
  home: new Set([
    "Dumbbell",
    "Bands",
    "Kettlebell",
    "Box",
    "Body only",
    "Gym mat",
  ]),
  bodyweight: new Set(["Body only", "Gym mat", "Box"]),
};

function matchesPreset(exercise: WgerExerciseInfo, preset: EquipmentPreset) {
  const allowed = PRESET_EQUIPMENT_NAMES[preset];
  if (!allowed) return true;
  if (exercise.equipment.length === 0) return false;
  return exercise.equipment.every((eq) => allowed.has(eq.name));
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

interface ExercisePickerProps {
  open: boolean;
  preset: EquipmentPreset;
  excludeIds: string[];
  onClose: () => void;
  onSelect: (exercise: PickerResult) => void;
}

let libraryPromise: Promise<WgerExerciseInfo[]> | null = null;

function loadLibrary(): Promise<WgerExerciseInfo[]> {
  if (!libraryPromise) {
    libraryPromise = loadExerciseInfo().then((list) => list as WgerExerciseInfo[]);
  }
  return libraryPromise;
}

export function ExercisePicker({
  open,
  preset,
  excludeIds,
  onClose,
  onSelect,
}: ExercisePickerProps) {
  const [allExercises, setAllExercises] = useState<WgerExerciseInfo[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadLibrary().then((list) => {
      if (!cancelled) setAllExercises(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  const presetFiltered = useMemo(
    () => allExercises.filter((ex) => matchesPreset(ex, preset)),
    [allExercises, preset],
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const ex of presetFiltered) {
      if (!seen.has(ex.category.name)) {
        seen.add(ex.category.name);
        list.push(ex.category.name);
      }
      if (list.length >= 8) break;
    }
    return list;
  }, [presetFiltered]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return presetFiltered
      .filter((ex) => !excluded.has(String(ex.id)))
      .filter((ex) => !selectedCategory || ex.category.name === selectedCategory)
      .filter(
        (ex) =>
          !needle ||
          getExerciseName(ex).toLowerCase().includes(needle) ||
          ex.category.name.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [presetFiltered, excluded, selectedCategory, query]);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Choose an exercise"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Swap exercise</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="border-b border-border p-5 sm:p-6">
          <Input
            label="Search exercises"
            placeholder="e.g. bench press, squat..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                selectedCategory === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              All
            </button>
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  setSelectedCategory((prev) => (prev === name ? null : name))
                }
                className={`inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                  selectedCategory === name
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {allExercises.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading exercises...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border">
              <p className="text-center text-sm text-muted-foreground">
                No exercises match.
                <br />
                Try a different search or category.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {results.map((ex) => {
                const name = getExerciseName(ex);
                const muscles = ex.muscles
                  .slice(0, 3)
                  .map((m) => m.name_en || m.name);
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          id: ex.id,
                          name,
                          category: ex.category.name,
                          muscles,
                        })
                      }
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {name}
                        </span>
                        {muscles.length > 0 && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {muscles.join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                        {ex.category.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}