import { NextResponse } from "next/server";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";
import {
  normalizeMetrics,
  syncWearableMetrics,
  WEARABLE_PROVIDERS,
  type WearableProvider,
} from "@/lib/server/wearable";

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const provider =
    typeof body === "object" && body !== null
      ? (body as { provider?: unknown }).provider
      : undefined;

  if (
    typeof provider !== "string" ||
    !WEARABLE_PROVIDERS.includes(provider as WearableProvider)
  ) {
    return NextResponse.json(
      {
        error: `A provider is required. Supported providers: ${WEARABLE_PROVIDERS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const payload = (body as Record<string, unknown>).metrics ?? body;
  const { metrics, errors } = normalizeMetrics(provider as WearableProvider, payload);

  if (metrics.length === 0) {
    return NextResponse.json(
      {
        error: "No usable metrics were provided.",
        errors,
      },
      { status: 400, headers: deviceCookieHeaders({ deviceId, setCookie }) },
    );
  }

  try {
    const result = await syncWearableMetrics(
      deviceId,
      provider as WearableProvider,
      metrics,
    );
    return NextResponse.json(
      {
        provider,
        imported: result.imported,
        checkInsDerived: result.checkInsDerived,
        errors: [...errors, ...result.errors],
      },
      {
        status: 201,
        headers: deviceCookieHeaders({ deviceId, setCookie }),
      },
    );
  } catch (error) {
    console.error("Wearable sync failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving your health data." },
      { status: 500, headers: deviceCookieHeaders({ deviceId, setCookie }) },
    );
  }
}