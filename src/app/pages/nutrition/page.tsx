"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

interface WeightUnit {
  id: number;
  uuid: string;
  ingredient: number;
  gram: number;
  name: string;
}

interface Ingredient {
  id: number;
  uuid: string;
  name: string;
  common_name: string | null;
  brand: string | null;
  energy: number;
  protein: string;
  carbohydrates: string;
  carbohydrates_sugar: string;
  fat: string;
  fat_saturated: string;
  fiber: string;
  sodium: string;
  weight_units: WeightUnit[];
  language: {
    short_name: string;
    full_name: string;
  };
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Ingredient[];
}

type MacroTab = "all" | "protein" | "carbs" | "fat";

function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  if (total === 0) return <div className="h-2 w-full rounded-full bg-muted" />;

  const proteinPct = (protein * 4 / total) * 100;
  const carbsPct = (carbs * 4 / total) * 100;
  const fatPct = (fat * 9 / total) * 100;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" title={`P: ${proteinPct.toFixed(0)}% · C: ${carbsPct.toFixed(0)}% · F: ${fatPct.toFixed(0)}%`}>
      <div className="bg-primary transition-all duration-500" style={{ width: `${proteinPct}%` }} />
      <div className="bg-[#f59e0b] transition-all duration-500" style={{ width: `${carbsPct}%` }} />
      <div className="bg-[#ef4444] transition-all duration-500" style={{ width: `${fatPct}%` }} />
    </div>
  );
}

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}g</span>
    </div>
  );
}

function IngredientCard({
  ingredient,
  onSelect,
}: {
  ingredient: Ingredient;
  onSelect: () => void;
}) {
  const protein = parseFloat(ingredient.protein);
  const carbs = parseFloat(ingredient.carbohydrates);
  const fat = parseFloat(ingredient.fat);
  const fiber = parseFloat(ingredient.fiber);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-snug">{ingredient.name}</h3>
            {ingredient.brand && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{ingredient.brand}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
            {ingredient.energy} kcal
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
          <div className="rounded-lg bg-muted/60 px-1 py-1.5">
            <p className="text-[10px] text-muted-foreground">Protein</p>
            <p className="mt-0.5 text-xs font-bold">{protein.toFixed(1)}g</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-1 py-1.5">
            <p className="text-[10px] text-muted-foreground">Carbs</p>
            <p className="mt-0.5 text-xs font-bold">{carbs.toFixed(1)}g</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-1 py-1.5">
            <p className="text-[10px] text-muted-foreground">Fat</p>
            <p className="mt-0.5 text-xs font-bold">{fat.toFixed(1)}g</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-1 py-1.5">
            <p className="text-[10px] text-muted-foreground">Fiber</p>
            <p className="mt-0.5 text-xs font-bold">{fiber.toFixed(1)}g</p>
          </div>
        </div>

        <div className="mt-2">
          <MacroBar protein={protein} carbs={carbs} fat={fat} />
        </div>
      </div>
    </button>
  );
}

function IngredientDetail({ ingredient }: { ingredient: Ingredient }) {
  const protein = parseFloat(ingredient.protein);
  const carbs = parseFloat(ingredient.carbohydrates);
  const sugar = parseFloat(ingredient.carbohydrates_sugar);
  const fat = parseFloat(ingredient.fat);
  const satFat = parseFloat(ingredient.fat_saturated);
  const fiber = parseFloat(ingredient.fiber);
  const sodium = parseFloat(ingredient.sodium);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold leading-tight">{ingredient.name}</h2>
          {ingredient.brand && (
            <p className="mt-1 text-sm text-muted-foreground">by {ingredient.brand}</p>
          )}
        </div>
        <div className="rounded-xl bg-primary px-3 py-1.5 text-center">
          <p className="text-xl font-bold text-primary-foreground">{ingredient.energy}</p>
          <p className="text-[11px] font-medium text-primary-foreground/80">kcal / 100g</p>
        </div>
      </div>

      <div className="mx-5 mb-6 sm:mx-6">
        <MacroBar protein={protein} carbs={carbs} fat={fat} />
        <div className="mt-3 flex flex-wrap gap-4">
          <MacroPill label="Protein" value={protein.toFixed(1)} color="bg-primary" />
          <MacroPill label="Carbs" value={carbs.toFixed(1)} color="bg-[#f59e0b]" />
          <MacroPill label="Fat" value={fat.toFixed(1)} color="bg-[#ef4444]" />
        </div>
      </div>

      <div className="px-5 pb-6 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Macronutrients
            </h3>
            <div className="space-y-3">
              {[
                { label: "Protein", value: protein, max: 50, color: "bg-primary" },
                { label: "Carbohydrates", value: carbs, max: 100, color: "bg-[#f59e0b]" },
                { label: "Fat", value: fat, max: 100, color: "bg-[#ef4444]" },
                { label: "Fiber", value: fiber, max: 30, color: "bg-[#22c55e]" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value.toFixed(1)}g</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Breakdown
            </h3>
            <div className="space-y-3 rounded-xl bg-muted/50 p-4">
              {[
                { label: "Sugar", value: sugar, parent: carbs },
                { label: "Saturated Fat", value: satFat, parent: fat },
                { label: "Sodium", value: sodium, unit: "mg" },
                { label: "Fiber", value: fiber, unit: "g" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">
                    {item.unit === "mg"
                      ? `${(item.value * 1000).toFixed(0)}mg`
                      : `${item.value.toFixed(1)}g`}
                    {item.parent !== undefined && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({item.parent > 0 ? ((item.value / item.parent) * 100).toFixed(0) : 0}%)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {ingredient.weight_units.length > 0 && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Common Servings
                </h3>
                <div className="space-y-2">
                  {ingredient.weight_units.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{unit.name}</span>
                      <span className="font-medium">{unit.gram}g</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-6 w-16 rounded-full bg-muted" />
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-muted/60 px-1 py-1.5">
              <div className="mx-auto h-3 w-10 rounded bg-muted" />
              <div className="mx-auto mt-1 h-4 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-muted" />
      </div>
    </div>
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

export default function NutritionPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<MacroTab>("all");
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(true);
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
    if (!selectedIngredient) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIngredient(null);
    };
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedIngredient]);

  const changeSort = (value: MacroTab) => {
    setSortBy(value);
    triggerResultFlash();
  };

  const loading = !initialLoadComplete;

  const fetchMore = useCallback(
    async (url: string) => {
      setLoadingMore(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data: ApiResponse = await res.json();
        setIngredients((prev) => [...prev, ...data.results]);
        setNextUrl(data.next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch ingredients");
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
    const baseUrl = "https://wger.de/api/v2/ingredientinfo/?limit=20&language=2&format=json";
    const url = debouncedQuery
      ? `${baseUrl}&name__search=${encodeURIComponent(debouncedQuery)}`
      : baseUrl;
    let cancelled = false;

    async function load() {
      const res = await fetch(url);
      if (cancelled) return;
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ApiResponse = await res.json();
      if (cancelled) return;
      setIngredients(data.results);
      setNextUrl(data.next);
      setError(null);
      setInitialLoadComplete(true);
    }

    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to fetch ingredients");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (debouncedQuery === "") return;
    const timer = setTimeout(() => {
      triggerResultFlash();
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

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

  const sortedIngredients = [...ingredients].sort((a, b) => {
    switch (sortBy) {
      case "protein":
        return parseFloat(b.protein) - parseFloat(a.protein);
      case "carbs":
        return parseFloat(b.carbohydrates) - parseFloat(a.carbohydrates);
      case "fat":
        return parseFloat(b.fat) - parseFloat(a.fat);
      default:
        return 0;
    }
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Nutrition Lookup
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Search thousands of ingredients to view detailed nutritional information.
          All values are per 100g serving.
        </p>
      </div>

      {/* Search + sort */}
      <div className="mx-auto mt-10 max-w-6xl rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <Input
              label="Search Ingredients"
              placeholder="e.g. chicken breast, rice, avocado..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              <span className="hidden sm:inline">
                {filtersOpen ? "Hide sort" : "Show sort"}
              </span>
              <span className="sm:hidden">{filtersOpen ? "Hide" : "Sort"}</span>
              <ChevronIcon open={filtersOpen} />
            </Button>
          </div>
        </div>

        {filtersOpen && (
          <div className="border-t border-border p-5 pt-5 sm:px-6 sm:pb-6">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
              Sort by
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={sortBy === "all" ? "primary" : "outline"}
                onClick={() => changeSort("all")}
              >
                Default
              </Button>
              <Button
                size="sm"
                variant={sortBy === "protein" ? "primary" : "outline"}
                onClick={() => changeSort("protein")}
              >
                Highest Protein
              </Button>
              <Button
                size="sm"
                variant={sortBy === "carbs" ? "primary" : "outline"}
                onClick={() => changeSort("carbs")}
              >
                Highest Carbs
              </Button>
              <Button
                size="sm"
                variant={sortBy === "fat" ? "primary" : "outline"}
                onClick={() => changeSort("fat")}
              >
                Highest Fat
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-6xl rounded-xl border border-danger/30 bg-danger/10 px-5 py-4 text-center text-sm text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="mx-auto mt-10 max-w-6xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Ingredients</h2>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition-all duration-500 ${
              resultFlash
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
            aria-live="polite"
          >
            {ingredients.length.toLocaleString()} loaded
          </span>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : sortedIngredients.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border">
              <p className="text-center text-muted-foreground">
                No ingredients found.
                <br />
                Try a different search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {sortedIngredients.map((ingredient) => (
                <IngredientCard
                  key={ingredient.id}
                  ingredient={ingredient}
                  onSelect={() => setSelectedIngredient(ingredient)}
                />
              ))}
            </div>
          )}
          <div ref={observerRef} className="h-4" />
          {!loading && loadingMore && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading more ingredients…
            </p>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          selectedIngredient ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSelectedIngredient(null)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ingredient nutrition details"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${
          selectedIngredient ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Nutrition Details</h2>
          <button
            type="button"
            onClick={() => setSelectedIngredient(null)}
            aria-label="Close details"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedIngredient && <IngredientDetail ingredient={selectedIngredient} />}
        </div>
      </aside>
    </div>
  );
}
