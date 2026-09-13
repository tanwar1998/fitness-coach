import { NextResponse } from "next/server";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";
import {
  createCustomMealEntry,
  isISODate,
  isMealType,
  todayISOLocal,
} from "@/lib/server/nutrition";

function isValidNumber(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
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

  const dateParam = data.date as string | undefined;
  const date = isISODate(dateParam) ? dateParam : todayISOLocal();

  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : null;
  if (name == null) {
    return NextResponse.json(
      { error: "A meal name is required." },
      { status: 400 },
    );
  }

  if (!isMealType(data.mealType)) {
    return NextResponse.json(
      { error: "mealType must be breakfast, lunch, dinner or snack." },
      { status: 400 },
    );
  }

  for (const field of ["kcal", "protein", "carbs", "fat"] as const) {
    const value = data[field];
    if (!isValidNumber(value, 0)) {
      return NextResponse.json(
        { error: `${field} must be a non-negative number.` },
        { status: 400 },
      );
    }
  }

  try {
    const entry = await createCustomMealEntry(deviceId, {
      date,
      name,
      mealType: data.mealType,
      kcal: data.kcal as number,
      protein: data.protein as number,
      carbs: data.carbs as number,
      fat: data.fat as number,
    });
    return NextResponse.json(
      { entry },
      { status: 201, headers: deviceCookieHeaders({ deviceId, setCookie }) },
    );
  } catch (error) {
    console.error("Custom meal create failed:", error);
    return NextResponse.json(
      { error: "Could not log that custom meal." },
      { status: 500 },
    );
  }
}