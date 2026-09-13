import { NextResponse } from "next/server";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";
import {
  fetchNutritionTargets,
  saveNutritionTargets,
} from "@/lib/server/nutrition";

interface TargetInput {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function readTargets(data: Record<string, unknown>): TargetInput | null {
  const kcal = data.kcal;
  const proteinG = data.proteinG;
  const carbsG = data.carbsG;
  const fatG = data.fatG;

  const fields = [
    ["kcal", kcal],
    ["proteinG", proteinG],
    ["carbsG", carbsG],
    ["fatG", fatG],
  ] as const;

  for (const [, value] of fields) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return null;
    }
  }

  return {
    kcal: Math.round(kcal as number),
    proteinG: Math.round(proteinG as number),
    carbsG: Math.round(carbsG as number),
    fatG: Math.round(fatG as number),
  };
}

export async function GET(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  try {
    const targets = await fetchNutritionTargets(deviceId);
    return NextResponse.json(targets, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    console.error("Nutrition targets fetch failed:", error);
    return NextResponse.json(
      { error: "Could not load your nutrition targets." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const targets = readTargets((body ?? {}) as Record<string, unknown>);
  if (!targets) {
    return NextResponse.json(
      {
        error: "kcal, proteinG, carbsG and fatG are required non-negative numbers.",
      },
      { status: 400 },
    );
  }

  try {
    const saved = await saveNutritionTargets(deviceId, targets);
    return NextResponse.json(saved, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    console.error("Nutrition targets save failed:", error);
    return NextResponse.json(
      { error: "Could not save your nutrition targets." },
      { status: 500 },
    );
  }
}