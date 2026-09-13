export type WearableProvider = "apple_health" | "google_fit";

export interface WearableMetric {
  id: string;
  date: string;
  provider: WearableProvider;
  steps?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  sleepDurationMinutes?: number;
  sleepScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WearableSyncResult {
  provider: WearableProvider;
  imported: number;
  checkInsDerived: number;
  errors: string[];
}

const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" };

export async function fetchWearableMetrics(
  days = 90,
): Promise<WearableMetric[]> {
  const response = await fetch(
    `/api/wearable/metrics?days=${Math.min(365, Math.max(1, days))}`,
  );
  if (!response.ok) {
    throw new Error(
      `Could not load your health data (${response.status}).`,
    );
  }
  return (await response.json()) as WearableMetric[];
}

export async function syncWearableMetrics(
  provider: WearableProvider,
  raw: unknown,
): Promise<WearableSyncResult> {
  const response = await fetch("/api/wearable/sync", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ provider, metrics: raw }),
  });
  const body = (await response.json()) as Partial<WearableSyncResult> & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? `Sync failed (${response.status}).`);
  }
  return body as WearableSyncResult;
}

/** Build a sample-free display label for a provider (no fabricated data). */
export function providerLabel(provider: WearableProvider): string {
  return provider === "apple_health"
    ? "Apple Health"
    : "Google Fit";
}