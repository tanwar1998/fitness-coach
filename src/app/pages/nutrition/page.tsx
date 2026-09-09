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
type MacroFilter = "all" | "high-protein" | "low-carb" | "keto";
type ViewMode = "grid" | "list";

function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  if (total === 0) return <div className="h-2 w-full rounded-full bg-muted" />;

  const proteinPct = (protein * 4 / total) * 100;
  const carbsPct = (carbs * 4 / total) * 100;
  const fatPct = (fat * 9 / total) * 100;

  return (
    <div
      className="group/bar relative flex h-2 w-full overflow-hidden rounded-full bg-muted"
      title={`Protein ${proteinPct.toFixed(0)}% · Carbs ${carbsPct.toFixed(0)}% · Fat ${fatPct.toFixed(0)}%`}
    >
      <div className="bg-[#6366f1] transition-all duration-500" style={{ width: `${proteinPct}%` }} />
      <div className="bg-[#10b981] transition-all duration-500" style={{ width: `${carbsPct}%` }} />
      <div className="bg-[#f59e0b] transition-all duration-500" style={{ width: `${fatPct}%` }} />
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-between px-1 text-[9px] font-semibold text-white group-hover/bar:flex">
        <span>P {proteinPct.toFixed(0)}%</span>
        <span>C {carbsPct.toFixed(0)}%</span>
        <span>F {fatPct.toFixed(0)}%</span>
      </span>
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

function CompactIngredientRow({
  ingredient,
  onSelect,
}: {
  ingredient: Ingredient;
  onSelect: () => void;
}) {
  const protein = parseFloat(ingredient.protein);
  const carbs = parseFloat(ingredient.carbohydrates);
  const fat = parseFloat(ingredient.fat);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full border-b border-border bg-card text-left transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{ingredient.name}</h3>
          {ingredient.brand && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{ingredient.brand}</p>
          )}
        </div>
        <div className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#6366f1]" />
          <span className="text-xs tabular-nums text-muted-foreground">{protein.toFixed(1)}g</span>
        </div>
        <div className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" />
          <span className="text-xs tabular-nums text-muted-foreground">{carbs.toFixed(1)}g</span>
        </div>
        <div className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" />
          <span className="text-xs tabular-nums text-muted-foreground">{fat.toFixed(1)}g</span>
        </div>
        <div className="hidden w-24 shrink-0 md:block">
          <MacroBar protein={protein} carbs={carbs} fat={fat} />
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
          {ingredient.energy} kcal
        </span>
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
          <MacroPill label="Protein" value={protein.toFixed(1)} color="bg-[#6366f1]" />
          <MacroPill label="Carbs" value={carbs.toFixed(1)} color="bg-[#10b981]" />
          <MacroPill label="Fat" value={fat.toFixed(1)} color="bg-[#f59e0b]" />
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
                { label: "Protein", value: protein, max: 50, color: "bg-[#6366f1]" },
                { label: "Carbohydrates", value: carbs, max: 100, color: "bg-[#10b981]" },
                { label: "Fat", value: fat, max: 100, color: "bg-[#f59e0b]" },
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

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [macroFilter, setMacroFilter] = useState<MacroFilter>("all");
  const [aiMode, setAiMode] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const aiToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (aiToastTimerRef.current) clearTimeout(aiToastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setAiToast(message);
    if (aiToastTimerRef.current) clearTimeout(aiToastTimerRef.current);
    aiToastTimerRef.current = setTimeout(() => setAiToast(null), 3000);
  }, []);

  const parseMealWithAI = async () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiParsing(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/meal-parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API error: ${res.status}`);
      }
      const data: { items: { name: string }[] } = await res.json();
      const names = (data.items || []).map((item) => item.name);
      if (names.length === 0) {
        setAiError("No ingredients could be parsed from that text.");
        return;
      }
      setQuery(names.join(","));
      setDebouncedQuery(names.join(","));
      setAiMode(false);
      setAiInput("");
      showToast(
        `Found ${names.length} ingredient${names.length > 1 ? "s" : ""}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`,
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to parse meal");
    } finally {
      setAiParsing(false);
    }
  };

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

  const sortedIngredients = [...ingredients]
    .filter((ing) => {
      const p = parseFloat(ing.protein);
      const c = parseFloat(ing.carbohydrates);
      switch (macroFilter) {
        case "high-protein":
          return p > 20;
        case "low-carb":
          return c < 5;
        case "keto":
          return c < 10 && p > 5;
        default:
          return true;
      }
    })
    .sort((a, b) => {
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
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Search Ingredients</p>
              <button
                type="button"
                onClick={() => {
                  setAiMode((v) => !v);
                  setAiError(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  aiMode
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
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
                  <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                </svg>
                AI Meal Parser
              </button>
            </div>

            {aiMode ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <Input
                    placeholder='e.g. "I ate 3 scrambled eggs with 1 slice of cheddar and a slice of toast"'
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") parseMealWithAI();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={parseMealWithAI}
                    disabled={aiParsing || aiInput.trim() === ""}
                  >
                    {aiParsing ? "Parsing…" : "Parse"}
                  </Button>
                </div>
                {aiError && (
                  <p className="text-xs text-danger">{aiError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Type or paste what you ate, and the AI will identify the ingredients automatically.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Input
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
            )}
          </div>
        </div>

        {aiMode && (
          <div className="border-t border-border px-5 py-3 sm:px-6">
            <p className="text-xs text-muted-foreground">
              {`Tip: Try "2 eggs and a banana", "grilled chicken salad", or "oatmeal with berries".`}
            </p>
          </div>
        )}

        {filtersOpen && !aiMode && (
          <div className="border-t border-border p-5 pt-5 sm:px-6 sm:pb-6">
            <div className="space-y-6">
              {/* Macro target filter */}
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                  Macro target
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={macroFilter === "all" ? "primary" : "outline"}
                    onClick={() => setMacroFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={macroFilter === "high-protein" ? "primary" : "outline"}
                    onClick={() => setMacroFilter("high-protein")}
                  >
                    High Protein (&gt;20g)
                  </Button>
                  <Button
                    size="sm"
                    variant={macroFilter === "low-carb" ? "primary" : "outline"}
                    onClick={() => setMacroFilter("low-carb")}
                  >
                    Low Carb (&lt;5g)
                  </Button>
                  <Button
                    size="sm"
                    variant={macroFilter === "keto" ? "primary" : "outline"}
                    onClick={() => setMacroFilter("keto")}
                  >
                    Keto Friendly
                  </Button>
                </div>
              </div>

              {/* Sort by */}
              <div>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Ingredients</h2>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center overflow-hidden rounded-full border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
                  viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Grid view"
              >
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
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="Compact list view"
                className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
                  viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Compact list view"
              >
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
                  <line x1="8" x2="21" y1="6" y2="6" />
                  <line x1="8" x2="21" y1="12" y2="12" />
                  <line x1="8" x2="21" y1="18" y2="18" />
                  <line x1="3" x2="3.01" y1="6" y2="6" />
                  <line x1="3" x2="3.01" y1="12" y2="12" />
                  <line x1="3" x2="3.01" y1="18" y2="18" />
                </svg>
              </button>
            </div>
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
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {sortedIngredients.map((ingredient) => (
                <IngredientCard
                  key={ingredient.id}
                  ingredient={ingredient}
                  onSelect={() => setSelectedIngredient(ingredient)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="min-w-0 flex-1">Ingredient</div>
                <div className="hidden w-20 shrink-0 sm:block">Protein</div>
                <div className="hidden w-20 shrink-0 sm:block">Carbs</div>
                <div className="hidden w-20 shrink-0 sm:block">Fat</div>
                <div className="hidden w-24 shrink-0 md:block">Calorie Split</div>
                <div className="w-16 shrink-0 text-right">Energy</div>
              </div>
              {sortedIngredients.map((ingredient) => (
                <CompactIngredientRow
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

      {/* AI toast */}
      {aiToast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-primary/30 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
          {aiToast}
        </div>
      )}

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
