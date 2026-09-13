import { NextResponse } from "next/server";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";
import { fetchWearableMetrics } from "@/lib/server/wearable";

export async function GET(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days") ?? "90");
  const days = Number.isFinite(daysParam)
    ? Math.min(365, Math.max(1, Math.floor(daysParam)))
    : 90;

  try {
    const metrics = await fetchWearableMetrics(deviceId, days);
    return NextResponse.json(metrics, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    console.error("Wearable metrics fetch failed:", error);
    return NextResponse.json(
      { error: "Could not load your health data." },
      { status: 500 },
    );
  }
}