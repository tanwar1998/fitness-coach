import type { Ingredient } from "@/lib/wger-data";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export interface MealLogEntry {
  id: string;
  date: string;
  ingredientId: number | null;
  ingredientName: string;
  quantity: number;
  unit: string;
  mealType: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isCustom: boolean;
}

export interface DailyLog {
  date: string;
  entries: MealLogEntry[];
  summary: { kcal: number; protein: number; carbs: number; fat: number };
}

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const DEFAULT_TARGETS: NutritionTargets = {
  kcal: 2000,
  proteinG: 120,
  carbsG: 250,
  fatG: 70,
};

export interface LogEntryPayload {
  date: string;
  ingredientId: number;
  ingredientName: string;
  quantity: number;
  unit: string;
  mealType: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CustomMealPayload {
  date: string;
  name: string;
  mealType: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ComputedMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface UnitOption {
  value: string;
  label: string;
  gram: number;
}

const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" };

function todayLocalISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function mealForDate(date: Date): MealType {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export { todayLocalISO };

export function mealLabel(mealType: MealType): string {
  return MEAL_LABELS[mealType];
}

/** Units available for quantity entry: grams, ounces, plus the ingredient's common servings (weight_units). */
export function unitOptionsFor(ingredient: Ingredient): UnitOption[] {
  const options: UnitOption[] = [
    { value: "g", label: "g", gram: 1 },
    { value: "oz", label: "oz", gram: 28.3495 },
  ];
  for (const weightUnit of ingredient.weight_units.slice(0, 3)) {
    options.push({
      value: `wu_${weightUnit.id}`,
      label: weightUnit.name,
      gram: weightUnit.gram,
    });
  }
  return options;
}

export function gramsFor(quantity: number, option: UnitOption | undefined): number {
  return quantity * (option?.gram ?? 1);
}

/** Scale an ingredient's per-100g values to an entered amount. */
export function computeMacros(ingredient: Ingredient, grams: number): ComputedMacros {
  const scale = grams / 100;
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    kcal: round1(ingredient.energy * scale),
    protein: round1(parseFloat(ingredient.protein) * scale),
    carbs: round1(parseFloat(ingredient.carbohydrates) * scale),
    fat: round1(parseFloat(ingredient.fat) * scale),
    fiber: round1(parseFloat(ingredient.fiber) * scale),
  };
}

export function formatMacroPreview(macros: ComputedMacros): string {
  return `~${macros.kcal} kcal · P ${macros.protein}g · C ${macros.carbs}g · F ${macros.fat}g`;
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export async function fetchDailyLog(date?: string): Promise<DailyLog> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(`/api/nutrition/log${query}`);
  if (!response.ok) {
    throw new Error(`Could not load your food log (${response.status}).`);
  }
  return (await response.json()) as DailyLog;
}

export async function addLogEntry(payload: LogEntryPayload): Promise<MealLogEntry> {
  const response = await fetch("/api/nutrition/log", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { entry?: MealLogEntry; error?: string };
  if (!response.ok || !body.entry) {
    throw new Error(body.error ?? `Could not log that item (${response.status}).`);
  }
  return body.entry;
}

export async function updateLogEntry(
  entryId: string,
  patch: Partial<
    Omit<LogEntryPayload, "ingredientId" | "ingredientName">
  > & { ingredientName?: string },
): Promise<MealLogEntry> {
  const response = await fetch(`/api/nutrition/log?id=${encodeURIComponent(entryId)}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  });
  const body = (await response.json()) as Partial<MealLogEntry> & { error?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.error ?? `Could not update that entry (${response.status}).`);
  }
  return body as MealLogEntry;
}

export async function removeLogEntry(entryId: string): Promise<void> {
  const response = await fetch(`/api/nutrition/log?id=${encodeURIComponent(entryId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Could not delete that entry (${response.status}).`);
  }
}

export async function addCustomMeal(payload: CustomMealPayload): Promise<MealLogEntry> {
  const response = await fetch("/api/nutrition/custom", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { entry?: MealLogEntry; error?: string };
  if (!response.ok || !body.entry) {
    throw new Error(body.error ?? `Could not log that custom meal (${response.status}).`);
  }
  return body.entry;
}

export async function fetchNutritionTargets(): Promise<NutritionTargets> {
  const response = await fetch("/api/nutrition/targets");
  if (!response.ok) {
    throw new Error(`Could not load targets (${response.status}).`);
  }
  return (await response.json()) as NutritionTargets;
}

export async function saveNutritionTargets(
  targets: NutritionTargets,
): Promise<NutritionTargets> {
  const response = await fetch("/api/nutrition/targets", {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(targets),
  });
  const body = (await response.json()) as Partial<NutritionTargets> & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Could not save targets (${response.status}).`);
  }
  return body as NutritionTargets;
}