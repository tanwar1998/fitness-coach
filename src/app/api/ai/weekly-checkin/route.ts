import { NextResponse } from "next/server";
import { resolveDeviceId, deviceCookieHeaders } from "@/lib/server/device";
import {
  generateCheckin,
  isValidISODate,
  loadWeeklyCheckinStatus,
  todayLocal,
} from "@/lib/server/weekly-checkin";
import { AiProviderError } from "@/lib/server/ai";

export async function GET(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);

  const url = new URL(request.url);
  const todayParam = url.searchParams.get("today");
  const today =
    isValidISODate(todayParam) && todayParam ? todayParam : todayLocal();

  try {
    const status = await loadWeeklyCheckinStatus(deviceId, today);
    return NextResponse.json(status, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    console.error("Weekly check-in status failed:", error);
    return NextResponse.json(
      { error: "Could not load your weekly check-in status." },
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
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const force =
    typeof body === "object" && body !== null
      ? (body as { force?: unknown }).force === true
      : false;

  const provider =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { provider?: unknown }).provider === "string"
      ? (body as { provider: string }).provider
      : undefined;

  try {
    const result = await generateCheckin(deviceId, todayLocal(), {
      force,
      provider,
    });

    if ("providerError" in result) {
      return NextResponse.json(
        { error: result.providerError.message },
        {
          status: 502,
          headers: deviceCookieHeaders({ deviceId, setCookie }),
        },
      );
    }

    if ("unparseable" in result) {
      return NextResponse.json(
        {
          error:
            "The AI coach couldn't produce a summary for this week. Please try again.",
        },
        {
          status: 502,
          headers: deviceCookieHeaders({ deviceId, setCookie }),
        },
      );
    }

    return NextResponse.json(result, {
      headers: deviceCookieHeaders({ deviceId, setCookie }),
    });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return NextResponse.json(
        { error: error.message },
        { status: 502, headers: deviceCookieHeaders({ deviceId, setCookie }) },
      );
    }
    console.error("Weekly check-in generation failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while generating your weekly check-in." },
      { status: 500, headers: deviceCookieHeaders({ deviceId, setCookie }) },
    );
  }
}