"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/Badge";
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
  isSelected,
  onSelect,
}: {
  ingredient: Ingredient;
  isSelected: boolean;
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
      className={`w-full overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-snug">{ingredient.name}</h3>
          {ingredient.brand && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{ingredient.brand}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {ingredient.energy} kcal
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-muted/60 px-2 py-2">
          <p className="text-xs text-muted-foreground">Protein</p>
          <p className="mt-0.5 text-sm font-bold">{protein.toFixed(1)}g</p>
        </div>
        <div className="rounded-lg bg-muted/60 px-2 py-2">
          <p className="text-xs text-muted-foreground">Carbs</p>
          <p className="mt-0.5 text-sm font-bold">{carbs.toFixed(1)}g</p>
        </div>
        <div className="rounded-lg bg-muted/60 px-2 py-2">
          <p className="text-xs text-muted-foreground">Fat</p>
          <p className="mt-0.5 text-sm font-bold">{fat.toFixed(1)}g</p>
        </div>
        <div className="rounded-lg bg-muted/60 px-2 py-2">
          <p className="text-xs text-muted-foreground">Fiber</p>
          <p className="mt-0.5 text-sm font-bold">{fiber.toFixed(1)}g</p>
        </div>
      </div>

      <div className="mt-3">
        <MacroBar protein={protein} carbs={carbs} fat={fat} />
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
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{ingredient.name}</h2>
          {ingredient.brand && (
            <p className="mt-1 text-sm text-muted-foreground">by {ingredient.brand}</p>
          )}
        </div>
        <div className="rounded-xl bg-primary px-4 py-2 text-center">
          <p className="text-2xl font-bold text-primary-foreground">{ingredient.energy}</p>
          <p className="text-xs font-medium text-primary-foreground/80">kcal / 100g</p>
        </div>
      </div>

      <div className="mt-6">
        <MacroBar protein={protein} carbs={carbs} fat={fat} />
        <div className="mt-3 flex flex-wrap gap-4">
          <MacroPill label="Protein" value={protein.toFixed(1)} color="bg-primary" />
          <MacroPill label="Carbs" value={carbs.toFixed(1)} color="bg-[#f59e0b]" />
          <MacroPill label="Fat" value={fat.toFixed(1)} color="bg-[#ef4444]" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
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
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-6 w-16 rounded-full bg-muted" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-muted/60 px-2 py-2">
            <div className="mx-auto h-3 w-10 rounded bg-muted" />
            <div className="mx-auto mt-1 h-4 w-8 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-muted" />
    </div>
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
      ? `${baseUrl}&search=${encodeURIComponent(debouncedQuery)}`
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
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="primary" className="mb-4">
          Nutrition Explorer
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Nutrition Lookup
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Search thousands of ingredients to view detailed nutritional information.
          All values are per 100g serving.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Input
          label="Search Ingredients"
          placeholder="e.g. chicken breast, rice, avocado..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={sortBy === "all" ? "primary" : "outline"}
            onClick={() => setSortBy("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={sortBy === "protein" ? "primary" : "outline"}
            onClick={() => setSortBy("protein")}
          >
            Highest Protein
          </Button>
          <Button
            size="sm"
            variant={sortBy === "carbs" ? "primary" : "outline"}
            onClick={() => setSortBy("carbs")}
          >
            Highest Carbs
          </Button>
          <Button
            size="sm"
            variant={sortBy === "fat" ? "primary" : "outline"}
            onClick={() => setSortBy("fat")}
          >
            Highest Fat
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-danger/30 bg-danger/10 px-5 py-4 text-center text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ingredients</h2>
            <span className="text-sm text-muted-foreground">
              {ingredients.length.toLocaleString()} loaded
            </span>
          </div>
          <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : sortedIngredients.map((ingredient) => (
                  <IngredientCard
                    key={ingredient.id}
                    ingredient={ingredient}
                    isSelected={selectedIngredient?.id === ingredient.id}
                    onSelect={() => setSelectedIngredient(ingredient)}
                  />
                ))}
            <div ref={observerRef} className="h-4" />
            {loadingMore && (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading more...</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-lg font-semibold">Details</h2>
          <div className="mt-4">
            {selectedIngredient ? (
              <IngredientDetail ingredient={selectedIngredient} />
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                <p className="text-center text-muted-foreground">
                  Select an ingredient from the list
                  <br />
                  to view its nutrition details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
