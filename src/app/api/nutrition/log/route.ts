import { NextResponse } from "next/server";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";
import {
  createMealEntry,
  deleteMealEntry,
  fetchDailyLog,
  isISODate,
  isMealType,
  todayISOLocal,
  updateMealEntry,
  type MealLogEntry,
  type MealType,
} from "@/lib/server/nutrition";

function isValidNumber(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export async function GET(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date") ?? "";
  const date = isISODate(dateParam) ? dateParam : todayISOLocal();

  try {
    const log = await fetchDailyLog(deviceId, date);
    return NextResponse.json(log, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    console.error("Daily log fetch failed:", error);
    return NextResponse.json(
      { error: "Could not load today's food log." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const date = data.date as string | undefined;
  if (!isISODate(date)) {
    return NextResponse.json(
      { error: "A valid date (YYYY-MM-DD) is required." },
      { status: 400 },
    );
  }

  const ingredientId =
    typeof data.ingredientId === "number" && Number.isInteger(data.ingredientId)
      ? data.ingredientId
      : null;
  const ingredientName =
    typeof data.ingredientName === "string" && data.ingredientName.trim()
      ? data.ingredientName.trim()
      : null;
  const quantity = data.quantity;
  const unit =
    typeof data.unit === "string" && data.unit.trim() ? data.unit.trim() : "g";
  const mealType = data.mealType as MealType | undefined;

  if (ingredientId == null || ingredientName == null) {
    return NextResponse.json(
      { error: "ingredientId and ingredientName are required." },
      { status: 400 },
    );
  }
  if (!isValidNumber(quantity, 0.001)) {
    return NextResponse.json(
      { error: "A positive quantity is required." },
      { status: 400 },
    );
  }
  if (!isMealType(mealType)) {
    return NextResponse.json(
      { error: "mealType must be breakfast, lunch, dinner or snack." },
      { status: 400 },
    );
  }

  try {
    const entry = await createMealEntry(deviceId, {
      date,
      ingredientId,
      ingredientName,
      quantity,
      unit,
      mealType,
      kcal: numOrNull(data.kcal) ?? 0,
      protein: numOrNull(data.protein) ?? 0,
      carbs: numOrNull(data.carbs) ?? 0,
      fat: numOrNull(data.fat) ?? 0,
    });
    return NextResponse.json(
      { entry },
      { status: 201, headers: deviceCookieHeaders({ deviceId, setCookie }) },
    );
  } catch (error) {
    console.error("Meal entry create failed:", error);
    return NextResponse.json(
      { error: "Could not log that item." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const url = new URL(request.url);
  const entryId = url.searchParams.get("id");

  if (!entryId) {
    return NextResponse.json(
      { error: "An entry id is required." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const patch: {
    quantity?: number;
    unit?: string;
    ingredientName?: string;
    mealType?: MealType;
    date?: string;
    kcal?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  } = {};

  const quantity = data.quantity;
  if (quantity !== undefined && !isValidNumber(quantity, 0.001)) {
    return NextResponse.json(
      { error: "quantity must be a positive number." },
      { status: 400 },
    );
  }
  if (quantity !== undefined) patch.quantity = quantity;

  if (data.unit !== undefined) {
    if (typeof data.unit !== "string" || !data.unit.trim()) {
      return NextResponse.json(
        { error: "unit must be a non-empty string." },
        { status: 400 },
      );
    }
    patch.unit = data.unit.trim();
  }

  if (data.ingredientName !== undefined) {
    if (typeof data.ingredientName !== "string" || !data.ingredientName.trim()) {
      return NextResponse.json(
        { error: "ingredientName must be a non-empty string." },
        { status: 400 },
      );
    }
    patch.ingredientName = data.ingredientName.trim();
  }

  if (data.mealType !== undefined) {
    if (!isMealType(data.mealType)) {
      return NextResponse.json(
        { error: "mealType must be breakfast, lunch, dinner or snack." },
        { status: 400 },
      );
    }
    patch.mealType = data.mealType;
  }

  if (data.date !== undefined) {
    if (!isISODate(data.date)) {
      return NextResponse.json(
        { error: "date must be a valid YYYY-MM-DD." },
        { status: 400 },
      );
    }
    patch.date = data.date;
  }

  for (const field of ["kcal", "protein", "carbs", "fat"] as const) {
    const value = data[field];
    if (value !== undefined) {
      if (!isValidNumber(value, 0)) {
        return NextResponse.json(
          { error: `${field} must be a non-negative number.` },
          { status: 400 },
        );
      }
      patch[field] = value;
    }
  }

  try {
    const updated: MealLogEntry | null = await updateMealEntry(deviceId, entryId, patch);
    if (!updated) {
      return NextResponse.json(
        { error: "Entry not found." },
        { status: 404, headers: deviceCookieHeaders({ deviceId, setCookie }) },
      );
    }
    return NextResponse.json(updated, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    console.error("Meal entry update failed:", error);
    return NextResponse.json(
      { error: "Could not update that entry." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  const url = new URL(request.url);
  const entryId = url.searchParams.get("id");

  if (!entryId) {
    return NextResponse.json(
      { error: "An entry id is required." },
      { status: 400 },
    );
  }

  try {
    const ok = await deleteMealEntry(deviceId, entryId);
    if (!ok) {
      return NextResponse.json(
        { error: "Entry not found." },
        { status: 404, headers: deviceCookieHeaders({ deviceId, setCookie }) },
      );
    }
    return NextResponse.json(
      { ok: true },
      { headers: deviceCookieHeaders({ deviceId, setCookie }) },
    );
  } catch (error) {
    console.error("Meal entry delete failed:", error);
    return NextResponse.json(
      { error: "Could not delete that entry." },
      { status: 500 },
    );
  }
}