import type { WeeklyCheckinStats } from "@/lib/server/weekly-checkin";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface WeeklyCheckin {
  id: string;
  weekStart: string;
  summary: string;
  adjustments: string[];
  stats: WeeklyCheckinStats;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyCheckinStatus {
  today: string;
  weekStart: string;
  latest: WeeklyCheckin | null;
  currentWeek: { weekStart: string; hasCheckin: boolean };
  hasActivity: boolean;
}

// ------------------------------------------------------------
// Local date helpers (same shape as the server helpers but for
// the client's local calendar).
// ------------------------------------------------------------

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ------------------------------------------------------------
// Client API
// ------------------------------------------------------------

const API_BASE = "/api/ai/weekly-checkin";

/**
 * Fetch the latest check-in status for this device.
 */
export async function fetchWeeklyCheckinStatus(): Promise<WeeklyCheckinStatus> {
  const today = todayLocalISO();
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set("today", today);

  const res = await fetch(url.toString(), { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error("Could not load weekly check-in status.");
  }
  return res.json();
}

/**
 * Generate the weekly check-in for the current week.
 */
export async function generateWeeklyCheckin(
  opts: { force?: boolean; provider?: string } = {},
): Promise<{ checkin: WeeklyCheckin; created: boolean }> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      force: opts.force ?? false,
      provider: opts.provider,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? "Could not generate weekly check-in.");
  }

  return data;
}

/**
 * Format a Monday-based week start to a human label like "Sep 7 – Sep 13".
 */
export function formatWeekLabel(weekStartISO: string): string {
  const [y, m, d] = weekStartISO.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);

  const fmt = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return `${fmt(start)} – ${fmt(end)}`;
}