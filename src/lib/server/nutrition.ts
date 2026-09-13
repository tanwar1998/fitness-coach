import { randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export function isMealType(value: unknown): value is MealType {
  return (
    typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value)
  );
}

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

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyLog {
  date: string;
  entries: MealLogEntry[];
  summary: { kcal: number; protein: number; carbs: number; fat: number };
}

export const DEFAULT_TARGETS: NutritionTargets = {
  kcal: 2000,
  proteinG: 120,
  carbsG: 250,
  fatG: 70,
};

interface MealLogRow {
  id: string;
  device_id: string;
  ingredient_id: number | null;
  ingredient_name: string;
  quantity: number;
  unit: string;
  meal_type: MealType;
  date: Date | string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  is_custom: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TargetsRow {
  device_id: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function toISODate(value: Date | string): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate(),
    ).padStart(2, "0")}`;
  }
  return value.slice(0, 10);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function todayISOLocal(): string {
  return toISODate(new Date());
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mapRow(row: MealLogRow): MealLogEntry {
  return {
    id: row.id,
    date: toISODate(row.date),
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredient_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    mealType: row.meal_type,
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    isCustom: Boolean(row.is_custom),
  };
}

export async function fetchDailyLog(
  deviceId: string,
  date: string,
): Promise<DailyLog> {
  const rows = await query<MealLogRow>(
    `SELECT * FROM meal_log_entry WHERE device_id = $1 AND date = $2 ORDER BY created_at ASC`,
    [deviceId, date],
  );
  const entries = rows.map(mapRow);
  const summary = entries.reduce(
    (acc, entry) => ({
      kcal: round1(acc.kcal + entry.kcal),
      protein: round1(acc.protein + entry.protein),
      carbs: round1(acc.carbs + entry.carbs),
      fat: round1(acc.fat + entry.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { date, entries, summary };
}

export interface CreateMealEntryInput {
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

export async function createMealEntry(
  deviceId: string,
  input: CreateMealEntryInput,
): Promise<MealLogEntry> {
  const id = `ml_${randomUUID().slice(0, 8)}`;
  const rows = await query<MealLogRow>(
    `INSERT INTO meal_log_entry
       (id, device_id, ingredient_id, ingredient_name, quantity, unit, meal_type, date, kcal, protein, carbs, fat, is_custom, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, now())
     RETURNING *`,
    [
      id,
      deviceId,
      input.ingredientId,
      input.ingredientName,
      round1(input.quantity),
      input.unit,
      input.mealType,
      input.date,
      round1(input.kcal),
      round1(input.protein),
      round1(input.carbs),
      round1(input.fat),
    ],
  );
  return mapRow(rows[0]);
}

export interface CreateCustomMealInput {
  date: string;
  name: string;
  mealType: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function createCustomMealEntry(
  deviceId: string,
  input: CreateCustomMealInput,
): Promise<MealLogEntry> {
  const id = `ml_${randomUUID().slice(0, 8)}`;
  const rows = await query<MealLogRow>(
    `INSERT INTO meal_log_entry
       (id, device_id, ingredient_id, ingredient_name, quantity, unit, meal_type, date, kcal, protein, carbs, fat, is_custom, updated_at)
     VALUES ($1, $2, NULL, $3, 1, 'serving', $4, $5, $6, $7, $8, $9, TRUE, now())
     RETURNING *`,
    [
      id,
      deviceId,
      input.name,
      input.mealType,
      input.date,
      round1(input.kcal),
      round1(input.protein),
      round1(input.carbs),
      round1(input.fat),
    ],
  );
  return mapRow(rows[0]);
}

export interface PatchMealEntryInput {
  quantity?: number;
  unit?: string;
  ingredientName?: string;
  mealType?: MealType;
  date?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export async function updateMealEntry(
  deviceId: string,
  entryId: string,
  patch: PatchMealEntryInput,
): Promise<MealLogEntry | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.quantity != null) push("quantity", round1(patch.quantity));
  if (patch.unit != null) push("unit", patch.unit);
  if (patch.ingredientName != null) push("ingredient_name", patch.ingredientName);
  if (patch.mealType != null) push("meal_type", patch.mealType);
  if (patch.date != null) push("date", patch.date);
  if (patch.kcal != null) push("kcal", round1(patch.kcal));
  if (patch.protein != null) push("protein", round1(patch.protein));
  if (patch.carbs != null) push("carbs", round1(patch.carbs));
  if (patch.fat != null) push("fat", round1(patch.fat));

  if (sets.length === 0) return null;
  sets.push("updated_at = now()");

  params.push(deviceId, entryId);
  const rows = await query<MealLogRow>(
    `UPDATE meal_log_entry SET ${sets.join(", ")}
     WHERE device_id = $${params.length - 1} AND id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function deleteMealEntry(
  deviceId: string,
  entryId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM meal_log_entry WHERE device_id = $1 AND id = $2 RETURNING id`,
    [deviceId, entryId],
  );
  return rows.length > 0;
}

export async function fetchNutritionTargets(
  deviceId: string,
): Promise<NutritionTargets> {
  const rows = await query<TargetsRow>(
    `SELECT * FROM nutrition_targets WHERE device_id = $1`,
    [deviceId],
  );
  if (rows.length === 0) return { ...DEFAULT_TARGETS };
  return {
    kcal: rows[0].kcal,
    proteinG: rows[0].protein_g,
    carbsG: rows[0].carbs_g,
    fatG: rows[0].fat_g,
  };
}

export async function saveNutritionTargets(
  deviceId: string,
  targets: NutritionTargets,
): Promise<NutritionTargets> {
  await query(
    `INSERT INTO nutrition_targets (device_id, kcal, protein_g, carbs_g, fat_g, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (device_id)
     DO UPDATE SET kcal = EXCLUDED.kcal,
                   protein_g = EXCLUDED.protein_g,
                   carbs_g = EXCLUDED.carbs_g,
                   fat_g = EXCLUDED.fat_g,
                   updated_at = now()`,
    [deviceId, targets.kcal, targets.proteinG, targets.carbsG, targets.fatG],
  );
  return targets;
}