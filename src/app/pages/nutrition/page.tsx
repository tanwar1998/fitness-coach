"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { DailySummary } from "@/components/nutrition/DailySummary";
import type { ConsumedTotals } from "@/components/nutrition/DailySummary";
import { LogEntryForm } from "@/components/nutrition/LogEntryForm";
import type { LogResult } from "@/components/nutrition/LogEntryForm";
import { CustomMealForm } from "@/components/nutrition/CustomMealForm";
import type { CustomMealFormPayload } from "@/components/nutrition/CustomMealForm";
import { MealLogList } from "@/components/nutrition/MealLogList";
import { loadIngredientInfo } from "@/lib/wger-data";
import type { Ingredient } from "@/lib/wger-data";
import {
  DEFAULT_TARGETS,
  addCustomMeal,
  addLogEntry,
  computeMacros,
  fetchDailyLog,
  fetchNutritionTargets,
  gramsFor,
  mealForDate,
  mealLabel,
  removeLogEntry,
  saveNutritionTargets,
  todayLocalISO,
  unitOptionsFor,
  updateLogEntry,
  type MealLogEntry,
  type MealType,
  type NutritionTargets,
} from "@/lib/nutrition";

const PAGE_SIZE = 20;

type MacroTab = "all" | "protein" | "carbs" | "fat";
type MacroFilter = "all" | "high-protein" | "low-carb" | "keto";
type ViewMode = "grid" | "list";

interface ParsedPlanItem {
  uid: string;
  name: string;
  ingredient: Ingredient | null;
  quantity: number | null;
  unit: string | null;
}

let planUid = 0;
function nextPlanUid(): string {
  planUid += 1;
  return `plan_${Date.now()}_${planUid}`;
}

/** Best-effort match of an AI-parsed food name against the local ingredient DB. */
function matchIngredient(name: string, list: Ingredient[]): Ingredient | null {
  const normalized = name.toLowerCase().trim();
  const terms = normalized.split(/\s+/).filter((term) => term.length > 1);
  if (normalized === "") return null;

  let best: Ingredient | null = null;
  let bestScore = 0;

  for (const ingredient of list) {
    const candidate = ingredient.name.toLowerCase();
    let score = 0;
    if (candidate === normalized) {
      score = 1000;
    } else if (candidate.includes(normalized)) {
      score = 500;
    } else {
      let hits = 0;
      for (const term of terms) {
        if (candidate.includes(term)) hits += 1;
      }
      if (hits === 0) continue;
      score = hits * 100;
      if (candidate.startsWith(terms[hits - 1] ?? "")) score += 20;
    }
    if (score > bestScore) {
      bestScore = score;
      best = ingredient;
    }
  }

  return best;
}

function resolveParsedUnit(
  raw: string | null | undefined,
  ingredient: Ingredient,
): string {
  const options = unitOptionsFor(ingredient);
  if (!raw) return options[0]?.value ?? "g";
  const unit = raw.toLowerCase().replace(/s$/, "");

  if (unit === "g" || unit === "gram") return "g";
  if (unit === "oz" || unit === "ounce") return "oz";

  const weight = ingredient.weight_units.find((wu) =>
    wu.name
      .toLowerCase()
      .replace(/^1\s*/, "")
      .replace(/s$/, "")
      .startsWith(unit),
  );
  if (weight) return `wu_${weight.id}`;

  const option = options.find((o) =>
    o.label
      .toLowerCase()
      .replace(/^1\s*/, "")
      .replace(/s$/, "")
      .startsWith(unit),
  );
  return option?.value ?? options[0]?.value ?? "g";
}

function MacroBar({
  protein,
  carbs,
  fat,
  fiber,
}: {
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  const fiberValid = fiber != null && Number.isFinite(fiber);

  if (total === 0) {
    return (
      <div
        className="group/bar relative flex h-2 w-full overflow-hidden rounded-full bg-muted"
        title={fiberValid ? `Fiber ${fiber.toFixed(1)}g` : undefined}
      >
        {fiberValid && fiber > 0 && (
          <div className="bg-[#c72a21]" style={{ width: "100%" }} />
        )}
      </div>
    );
  }

  const proteinPct = (protein * 4 / total) * 100;
  const carbsPct = (carbs * 4 / total) * 100;
  const fatPct = (fat * 9 / total) * 100;
  const fiberPct =
    fiberValid && fiber > 0 ? Math.min(fiber / 30, 1) * 22 : 0;
  const scale = (100 - fiberPct) / 100;
  const fiberLabel = fiberValid ? ` · Fiber ${fiber.toFixed(1)}g` : "";

  return (
    <div
      className="group/bar relative flex h-2 w-full overflow-hidden rounded-full bg-muted"
      title={`Protein ${proteinPct.toFixed(0)}% · Carbs ${carbsPct.toFixed(0)}% · Fat ${fatPct.toFixed(0)}%${fiberLabel}`}
    >
      <div className="bg-[#6366f1] transition-all duration-500" style={{ width: `${proteinPct * scale}%` }} />
      <div className="bg-[#10b981] transition-all duration-500" style={{ width: `${carbsPct * scale}%` }} />
      <div className="bg-[#f59e0b] transition-all duration-500" style={{ width: `${fatPct * scale}%` }} />
      {fiberValid && fiber > 0 && (
        <div
          className="bg-[#c72a21] transition-all duration-500"
          style={{ width: `${fiberPct}%` }}
        />
      )}
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-between px-1 text-[9px] font-semibold text-white group-hover/bar:flex">
        <span>P {proteinPct.toFixed(0)}%</span>
        <span>C {carbsPct.toFixed(0)}%</span>
        <span>F {fatPct.toFixed(0)}%</span>
        {fiberValid && fiber > 0 && (
          <span>Fi {fiber.toFixed(1)}g</span>
        )}
      </span>
    </div>
  );
}

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold serial tabular-nums">{value}g</span>
    </div>
  );
}

function IngredientCard({
  ingredient,
  onSelect,
  onLog,
}: {
  ingredient: Ingredient;
  onSelect: () => void;
  onLog: (ingredient: Ingredient, result: LogResult) => Promise<MealLogEntry | null>;
}) {
  const protein = parseFloat(ingredient.protein);
  const carbs = parseFloat(ingredient.carbohydrates);
  const fat = parseFloat(ingredient.fat);
  const fiber = parseFloat(ingredient.fiber);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  const handleLog = async (result: LogResult) => {
    setBusy(true);
    try {
      const entry = await onLog(ingredient, result);
      if (!entry) return;
      setJustLogged(true);
      setExpanded(false);
      setTimeout(() => setJustLogged(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group flex w-full flex-col overflow-hidden rounded-sm border border-foreground/25 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50">
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 cursor-pointer text-left"
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold leading-snug">{ingredient.name}</h3>
              {ingredient.brand && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{ingredient.brand}</p>
              )}
            </div>
            <span className="shrink-0 border border-foreground/25 bg-card px-2 py-0.5 text-[11px] font-bold text-muted-foreground stamp">
              {ingredient.energy} kcal
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
            <div className="border border-foreground/15 bg-[#6366f1]/10 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground">Protein</p>
              <p className="mt-0.5 text-xs font-bold tabular-nums serial text-[#6366f1]">{protein.toFixed(1)}g</p>
            </div>
            <div className="border border-foreground/15 bg-[#10b981]/10 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground">Carbs</p>
              <p className="mt-0.5 text-xs font-bold tabular-nums serial text-[#10b981]">{carbs.toFixed(1)}g</p>
            </div>
            <div className="border border-foreground/15 bg-[#f59e0b]/10 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground">Fat</p>
              <p className="mt-0.5 text-xs font-bold tabular-nums serial text-[#f59e0b]">{fat.toFixed(1)}g</p>
            </div>
            <div className="border border-foreground/15 bg-[#c72a21]/10 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground">Fiber</p>
              <p className="mt-0.5 text-xs font-bold tabular-nums serial text-[#c72a21]">{fiber.toFixed(1)}g</p>
            </div>
          </div>

          <div className="mt-2">
            <MacroBar protein={protein} carbs={carbs} fat={fat} fiber={fiber} />
          </div>
        </div>
      </button>

      <div className="border-t border-foreground/15 p-3">
        {expanded ? (
          <LogEntryForm
            ingredient={ingredient}
            defaultMealType={mealForDate(new Date())}
            busy={busy}
            onLog={handleLog}
            onCancel={() => setExpanded(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              justLogged
                ? "border-success/40 bg-success/10 text-success"
                : "border-foreground/25 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {justLogged ? (
              <>✓ Logged · add more</>
            ) : (
              <>＋ Add to log</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CompactIngredientRow({
  ingredient,
  onSelect,
  onLog,
}: {
  ingredient: Ingredient;
  onSelect: () => void;
  onLog: (ingredient: Ingredient, result: LogResult) => Promise<MealLogEntry | null>;
}) {
  const protein = parseFloat(ingredient.protein);
  const carbs = parseFloat(ingredient.carbohydrates);
  const fat = parseFloat(ingredient.fat);
  const fiber = parseFloat(ingredient.fiber);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLog = async (result: LogResult) => {
    setBusy(true);
    try {
      const entry = await onLog(ingredient, result);
      if (!entry) return;
      setExpanded(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group w-full border-b border-foreground/15 bg-card transition-colors last:border-b-0">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left hover:bg-muted/40"
        >
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{ingredient.name}</h3>
            {ingredient.brand && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{ingredient.brand}</p>
            )}
          </div>
          <div className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#6366f1]" />
            <span className="text-xs tabular-nums serial text-muted-foreground">{protein.toFixed(1)}g</span>
          </div>
          <div className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" />
            <span className="text-xs tabular-nums serial text-muted-foreground">{carbs.toFixed(1)}g</span>
          </div>
          <div className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" />
            <span className="text-xs tabular-nums serial text-muted-foreground">{fat.toFixed(1)}g</span>
          </div>
          <div
            className="hidden w-20 shrink-0 items-center gap-1.5 sm:flex"
            title={`Fiber ${fiber.toFixed(1)}g`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#c72a21]" />
            <span className="text-xs tabular-nums serial text-[#c72a21]">{fiber.toFixed(1)}g</span>
          </div>
          <div className="hidden w-24 shrink-0 md:block">
            <MacroBar protein={protein} carbs={carbs} fat={fat} fiber={fiber} />
          </div>
          <span className="shrink-0 border border-foreground/25 bg-card px-2 py-0.5 text-[11px] font-bold text-muted-foreground stamp">
            {ingredient.energy} kcal
          </span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`Add ${ingredient.name} to today's log`}
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-sm border border-foreground/25 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {expanded ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <span className="text-sm font-bold leading-none">＋</span>
          )}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-foreground/15 bg-muted/20 px-4 py-3">
          <LogEntryForm
            ingredient={ingredient}
            defaultMealType={mealForDate(new Date())}
            busy={busy}
            onLog={handleLog}
          />
        </div>
      )}
    </div>
  );
}

function IngredientLookup({
  ingredients,
  onPick,
}: {
  ingredients: Ingredient[];
  onPick: (ingredient: Ingredient) => void;
}) {
  const [text, setText] = useState("");

  const matches = useMemo(() => {
    const query = text.trim().toLowerCase();
    if (!query) return [];
    return ingredients
      .filter((ingredient) => ingredient.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [text, ingredients]);

  return (
    <div className="w-full">
      <Input
        label="Pick the right ingredient"
        placeholder="Search the database…"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        className="h-9"
      />
      {matches.length > 0 && (
        <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
          {matches.map((ingredient) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() => onPick(ingredient)}
              className="cursor-pointer rounded-sm border border-foreground/25 bg-card px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <span className="font-medium">{ingredient.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {ingredient.energy} kcal
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
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
        <div className="rounded-sm bg-primary px-3 py-1.5 text-center">
          <p className="text-xl font-bold text-primary-foreground">{ingredient.energy}</p>
          <p className="text-[11px] font-medium text-primary-foreground/80">kcal / 100g</p>
        </div>
      </div>

      <div className="mx-5 mb-6 sm:mx-6">
        <MacroBar protein={protein} carbs={carbs} fat={fat} fiber={fiber} />
        <div className="mt-3 flex flex-wrap gap-4">
          <MacroPill label="Protein" value={protein.toFixed(1)} color="bg-[#6366f1]" />
          <MacroPill label="Carbs" value={carbs.toFixed(1)} color="bg-[#10b981]" />
          <MacroPill label="Fat" value={fat.toFixed(1)} color="bg-[#f59e0b]" />
        </div>
      </div>

      <div className="px-5 pb-6 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="stamp text-muted-foreground">
              Macronutrients
            </h3>
            <div className="space-y-3">
              {[
                { label: "Protein", value: protein, max: 50, color: "bg-[#6366f1]" },
                { label: "Carbohydrates", value: carbs, max: 100, color: "bg-[#10b981]" },
                { label: "Fat", value: fat, max: 100, color: "bg-[#f59e0b]" },
                { label: "Fiber", value: fiber, max: 30, color: "bg-[#c72a21]" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value.toFixed(1)}g</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${item.value > 0 ? Math.min(Math.max((item.value / item.max) * 100, 4), 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="stamp text-muted-foreground">
              Breakdown
            </h3>
            <div className="space-y-3 rounded-sm border border-foreground/15 bg-muted/30 p-4">
              {[
                { label: "Sugar", value: sugar, parent: carbs },
                { label: "Saturated Fat", value: satFat, parent: fat },
                { label: "Sodium", value: sodium, unit: "mg" },
                { label: "Fiber", value: fiber, unit: "g" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium serial tabular-nums">
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
                <h3 className="stamp text-muted-foreground">
                  Common Servings
                </h3>
                <div className="space-y-2">
                  {ingredient.weight_units.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between rounded-sm border border-foreground/25 bg-card px-3 py-2 text-sm"
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
    <div className="animate-pulse overflow-hidden rounded-sm border border-foreground/25 bg-card">
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-6 w-16 rounded-sm bg-muted" />
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-sm bg-muted/60 px-1 py-1.5">
              <div className="mx-auto h-3 w-10 rounded bg-muted" />
              <div className="mx-auto mt-1 h-4 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 w-full rounded-sm bg-muted" />
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
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<MacroTab>("all");
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [resultFlash, setResultFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [macroFilter, setMacroFilter] = useState<MacroFilter>("all");
  const [aiMode, setAiMode] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const aiToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dailyEntries, setDailyEntries] = useState<MealLogEntry[]>([]);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [logLoadError, setLogLoadError] = useState<string | null>(null);
  const [parsedPlan, setParsedPlan] = useState<ParsedPlanItem[] | null>(null);
  const [planBusy, setPlanBusy] = useState(false);

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

  const consumed: ConsumedTotals = useMemo(
    () =>
      dailyEntries.reduce<ConsumedTotals>(
        (acc, entry) => ({
          kcal: acc.kcal + Number(entry.kcal) || 0,
          protein: acc.protein + Number(entry.protein) || 0,
          carbs: acc.carbs + Number(entry.carbs) || 0,
          fat: acc.fat + Number(entry.fat) || 0,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [dailyEntries],
  );

  useEffect(() => {
    let cancelled = false;
    const date = todayLocalISO();

    fetchDailyLog(date)
      .then((log) => {
        if (cancelled) return;
        setDailyEntries(log.entries);
      })
      .catch((err) => {
        if (cancelled) return;
        setLogLoadError(
          err instanceof Error ? err.message : "Could not load today's food log.",
        );
      });

    fetchNutritionTargets()
      .then((next) => {
        if (!cancelled) setTargets(next);
      })
      .catch(() => {
        if (!cancelled) setTargets(DEFAULT_TARGETS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogEntry = useCallback(
    async (
      ingredient: Ingredient,
      result: LogResult,
): Promise<MealLogEntry | null> => {
      try {
        const date = todayLocalISO();
        const entry = await addLogEntry({
          date,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity: result.quantity,
          unit: result.unit,
          mealType: result.mealType,
          kcal: result.macros.kcal,
          protein: result.macros.protein,
          carbs: result.macros.carbs,
          fat: result.macros.fat,
        });
        setDailyEntries((prev) => [...prev, entry]);
        showToast(`Logged ${ingredient.name} to ${mealLabel(result.mealType)}`);
        return entry;
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not log that item.");
        return null;
      }
    },
    [showToast],
  );

  const handleUpdateEntry = useCallback(
    async (
      id: string,
      patch: {
        quantity?: number;
        unit?: string;
        mealType?: MealType;
        kcal?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      },
    ) => {
      try {
        const updated = await updateLogEntry(id, patch);
        setDailyEntries((prev) =>
          prev.map((entry) => (entry.id === id ? updated : entry)),
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not update that entry.");
      }
    },
    [showToast],
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      try {
        await removeLogEntry(id);
        setDailyEntries((prev) => prev.filter((entry) => entry.id !== id));
        showToast("Entry removed from today's log.");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not delete that entry.");
      }
    },
    [showToast],
  );

  const handleSaveTargets = useCallback(
    async (next: NutritionTargets) => {
      try {
        const saved = await saveNutritionTargets(next);
        setTargets(saved);
        showToast("Daily nutrition targets updated.");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not save targets.");
      }
    },
    [showToast],
  );

  const handleCustomMeal = useCallback(
    async (payload: CustomMealFormPayload) => {
      try {
        const entry = await addCustomMeal({
          date: todayLocalISO(),
          name: payload.name,
          mealType: payload.mealType,
          kcal: payload.kcal,
          protein: payload.protein,
          carbs: payload.carbs,
          fat: payload.fat,
        });
        setDailyEntries((prev) => [...prev, entry]);
        setCustomMode(false);
        showToast(`Logged ${payload.name} as a custom meal.`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Could not log that custom meal.",
        );
      }
    },
    [showToast],
  );

  const assignPlanIngredient = useCallback(
    (uid: string, ingredient: Ingredient) => {
      setParsedPlan((prev) =>
        prev
          ? prev.map((item) =>
              item.uid === uid
                ? {
                    ...item,
                    ingredient,
                    unit: unitOptionsFor(ingredient)[0]?.value ?? "g",
                  }
                : item,
            )
          : prev,
      );
    },
    [],
  );

  const logParsedPlanItem = useCallback(
    async (item: ParsedPlanItem, result: LogResult) => {
      if (!item.ingredient) return;
      setPlanBusy(true);
      try {
        const entry = await handleLogEntry(item.ingredient, result);
        if (entry) {
          setParsedPlan((prev) =>
            prev ? prev.filter((planItem) => planItem.uid !== item.uid) : prev,
          );
        }
      } finally {
        setPlanBusy(false);
      }
    },
    [handleLogEntry],
  );

  const logAllParsed = useCallback(async () => {
    if (!parsedPlan) return;
    const ready = parsedPlan.filter(
      (item) =>
        item.ingredient != null && item.quantity != null && item.quantity > 0,
    );
    if (ready.length === 0) return;
    setPlanBusy(true);
    try {
      for (const item of ready) {
        const ingredient = item.ingredient as Ingredient;
        const unit = item.unit ?? unitOptionsFor(ingredient)[0]?.value ?? "g";
        const unitOption = unitOptionsFor(ingredient).find((o) => o.value === unit);
        const grams = gramsFor(item.quantity as number, unitOption ?? unitOptionsFor(ingredient)[0]);
        const macros = computeMacros(ingredient, grams);
        const entry = await handleLogEntry(ingredient, {
          quantity: item.quantity as number,
          unit,
          mealType: mealForDate(new Date()),
          macros,
        });
        if (entry) {
          setParsedPlan((prev) =>
            prev ? prev.filter((planItem) => planItem.uid !== item.uid) : prev,
          );
        }
      }
    } finally {
      setPlanBusy(false);
    }
  }, [parsedPlan, handleLogEntry]);

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
      const data: {
        items: { name?: string; quantity?: number | null; unit?: string | null }[];
      } = await res.json();
      const rawItems = (data.items || []).filter(
        (item) =>
          typeof item?.name === "string" && item.name.trim() !== "",
      );
      if (rawItems.length === 0) {
        setAiError("No ingredients could be parsed from that text.");
        return;
      }

      const plan: ParsedPlanItem[] = rawItems.map((item) => {
        const name = item.name as string;
        const ingredient = matchIngredient(name, allIngredients);
        const quantity =
          typeof item.quantity === "number" && item.quantity > 0
            ? item.quantity
            : null;
        const unit = ingredient ? resolveParsedUnit(item.unit, ingredient) : null;
        return { uid: nextPlanUid(), name, ingredient, quantity, unit };
      });

      const matched = plan.filter((item) => item.ingredient).length;
      const ambiguous = plan.filter(
        (item) => item.ingredient && item.quantity == null,
      ).length;

      setParsedPlan(plan);
      setAiInput("");
      showToast(
        `Parsed ${plan.length} item${plan.length > 1 ? "s" : ""}${
          matched === plan.length ? "" : ` — ${plan.length - matched} need a match`
        }${
          ambiguous > 0
            ? ` · ${ambiguous} need${ambiguous > 1 ? "" : "s"} a quantity`
            : ""
        }`,
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

  const showMore = useCallback(() => {
    setVisibleCount((count) => count + PAGE_SIZE);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    loadIngredientInfo()
      .then((list) => {
        if (cancelled) return;
        setAllIngredients(list);
        setError(null);
        setInitialLoadComplete(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load ingredients",
        );
        setInitialLoadComplete(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const searchResults = useMemo(() => {
    const terms = debouncedQuery
      .split(",")
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);
    return terms.length === 0
      ? allIngredients
      : allIngredients.filter((ing) =>
          terms.some((term) => ing.name.toLowerCase().includes(term)),
        );
  }, [debouncedQuery, allIngredients]);

  const ingredientsById = useMemo(() => {
    const map: Record<number, Ingredient> = {};
    for (const ingredient of allIngredients) map[ingredient.id] = ingredient;
    return map;
  }, [allIngredients]);

  const readyCount = useMemo(
    () =>
      parsedPlan?.filter(
        (item) =>
          item.ingredient != null && item.quantity != null && item.quantity > 0,
      ).length ?? 0,
    [parsedPlan],
  );

  useEffect(() => {
    if (debouncedQuery === "") return;
    const timer = setTimeout(() => {
      triggerResultFlash();
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const sortedIngredients = useMemo(
    () =>
      [...searchResults]
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
        }),
    [searchResults, macroFilter, sortBy],
  );
  const hasMore = visibleCount < sortedIngredients.length;

  useEffect(() => {
    if (!observerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          showMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, showMore]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl sm:text-5xl">
          Nutrition
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          Log meals, track your daily totals against your targets, and search
          thousands of ingredients for detailed nutritional info.
        </p>
      </div>

      {/* Daily summary */}
      {!loading && (
        <div className="mx-auto mt-8 max-w-6xl">
          <DailySummary
            consumed={consumed}
            targets={targets}
            onSaveTargets={handleSaveTargets}
          />
        </div>
      )}

      {/* Today's log */}
      <div className="mx-auto mt-6 max-w-6xl">
        <MealLogList
          entries={dailyEntries}
          ingredientsById={ingredientsById}
          onUpdate={handleUpdateEntry}
          onDelete={handleDeleteEntry}
        />
        {logLoadError && (
          <div className="mt-4 rounded-sm border border-warning/30 bg-warning/10 px-5 py-3 text-center text-sm text-warning">
            {logLoadError}
          </div>
        )}
      </div>

      {/* Search + sort */}
      <div className="mx-auto mt-8 max-w-6xl rounded-sm border border-foreground/25 bg-card shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Search Ingredients</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setAiMode((v) => !v);
                    setAiError(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
                    aiMode
                      ? "bg-primary text-primary-foreground"
                      : "border border-foreground/25 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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
                <button
                  type="button"
                  onClick={() => {
                    setAiMode(false);
                    setAiError(null);
                    setCustomMode((v) => !v);
                  }}
                  className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
                    customMode
                      ? "bg-primary text-primary-foreground"
                      : "border border-foreground/25 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Custom meal
                </button>
              </div>
            </div>

            {customMode ? (
              <div className="rounded-sm border border-foreground/15 bg-muted/30 p-3 sm:p-4">
                <CustomMealForm
                  defaultMealType={mealForDate(new Date())}
                  onSubmit={handleCustomMeal}
                  onCancel={() => setCustomMode(false)}
                />
              </div>
            ) : aiMode ? (
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
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setVisibleCount(PAGE_SIZE);
                      }}
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
          <div className="border-t border-foreground/15 px-5 py-3 sm:px-6">
            <p className="text-xs text-muted-foreground">
              {`Tip: Try "2 eggs and a banana", "grilled chicken salad", or "oatmeal with berries".`}
            </p>
          </div>
        )}

        {filtersOpen && !aiMode && !customMode && (
          <div className="border-t border-foreground/15 p-5 pt-5 sm:px-6 sm:pb-6">
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

      {/* AI parsed meal plan */}
      {parsedPlan && parsedPlan.length > 0 && (
        <div className="mx-auto mt-6 max-w-6xl rounded-sm border border-foreground/25 bg-card shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-black uppercase tracking-tight text-lg">
                  Parsed meal <span className="text-muted-foreground">— confirm before logging</span>
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Items flagged as needing a quantity or an ingredient match must be fixed before they can be logged.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setParsedPlan(null)}
                  disabled={planBusy}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  disabled={planBusy || readyCount === 0}
                  onClick={() => void logAllParsed()}
                >
                  {planBusy ? "Logging…" : `Log all (${readyCount})`}
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {parsedPlan.map((item) => (
                <div
                  key={item.uid}
                  className="rounded-sm border border-foreground/15 bg-muted/30 p-3"
                >
                  {item.ingredient ? (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="success">✓ Matched</Badge>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.ingredient.name}
                        </p>
                        {item.quantity == null && (
                          <span className="inline-flex items-center rounded-sm border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning stamp">
                            ⚠ Quantity needed
                          </span>
                        )}
                        {item.quantity != null && (
                          <span className="inline-flex items-center rounded-sm border border-foreground/25 bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground stamp">
                            {item.quantity} {item.unit}
                          </span>
                        )}
                      </div>
                      <LogEntryForm
                        ingredient={item.ingredient}
                        defaultQuantity={item.quantity}
                        defaultUnit={item.unit ?? undefined}
                        autoFocusQuantity={item.quantity == null}
                        requireQuantity
                        busy={planBusy}
                        onLog={(result) => logParsedPlanItem(item, result)}
                      />
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        No match found for “{item.name}”
                      </p>
                      <IngredientLookup
                        ingredients={allIngredients}
                        onPick={(ingredient) =>
                          assignPlanIngredient(item.uid, ingredient)
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto mt-6 max-w-6xl rounded-sm border border-danger/30 bg-danger/10 px-5 py-4 text-center text-sm text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="mx-auto mt-10 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-black uppercase tracking-tight text-lg">Ingredients</h2>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center overflow-hidden rounded-sm border border-foreground/25 bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`grid h-7 w-7 place-items-center rounded-sm transition-colors ${
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
                className={`grid h-7 w-7 place-items-center rounded-sm transition-colors ${
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
              className={`rounded-sm border px-3 py-1 text-sm font-semibold transition-all duration-500 stamp ${
                resultFlash
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-foreground/25 bg-card text-muted-foreground"
              }`}
              aria-live="polite"
            >
              {searchResults.length.toLocaleString()} loaded
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
            <div className="flex min-h-[240px] items-center justify-center rounded-sm border border-dashed border-foreground/25">
              <p className="text-center text-muted-foreground">
                No ingredients found.
                <br />
                Try a different search.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {sortedIngredients.slice(0, visibleCount).map((ingredient) => (
                <IngredientCard
                  key={ingredient.id}
                  ingredient={ingredient}
                  onSelect={() => setSelectedIngredient(ingredient)}
                  onLog={handleLogEntry}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-sm border border-foreground/25 bg-card shadow-sm">
              <div className="flex items-center gap-4 border-b border-foreground/15 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="min-w-0 flex-1">Ingredient</div>
                <div className="hidden w-20 shrink-0 sm:block">Protein</div>
                <div className="hidden w-20 shrink-0 sm:block">Carbs</div>
                <div className="hidden w-20 shrink-0 sm:block">Fat</div>
                <div className="hidden w-20 shrink-0 sm:block">Fiber</div>
                <div className="hidden w-24 shrink-0 md:block">Calorie Split</div>
                <div className="w-16 shrink-0 text-right">Energy</div>
              </div>
              {sortedIngredients.slice(0, visibleCount).map((ingredient) => (
                <CompactIngredientRow
                  key={ingredient.id}
                  ingredient={ingredient}
                  onSelect={() => setSelectedIngredient(ingredient)}
                  onLog={handleLogEntry}
                />
              ))}
            </div>
          )}
          <div ref={observerRef} className="h-4" />
          {!loading && hasMore && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Scroll for more ingredients…
            </p>
          )}
        </div>
      </div>

      {/* AI toast */}
      {aiToast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-sm border border-primary/30 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm">
          {aiToast}
        </div>
      )}

      {/* Slide-in detail panel */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          selectedIngredient ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSelectedIngredient(null)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ingredient nutrition details"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-card shadow-sm transition-transform duration-300 ease-out ${
          selectedIngredient ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-foreground/15 px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-bold">Nutrition Details</h2>
          <button
            type="button"
            onClick={() => setSelectedIngredient(null)}
            aria-label="Close details"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-sm border border-foreground/25 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
