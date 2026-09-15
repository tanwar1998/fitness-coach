"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import {
  fetchWeeklyCheckinStatus,
  formatWeekLabel,
  generateWeeklyCheckin,
  type WeeklyCheckinStatus,
} from "@/lib/weekly-checkin";

interface WeeklyCheckInCardProps {
  onFollowUp?: (question: string) => void;
  providerId?: string;
}

function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v3" />
      <path d="m15.5 5.5 1.5 1.5" />
      <path d="M5.5 5.5 7 7" />
      <path d="M12 15l-2.5 5" />
      <path d="m4.5 10.5-3 1.5 3 1.5" />
      <path d="m19.5 10.5 3 1.5-3 1.5" />
      <path d="M15 21l1.5-3" />
      <path d="M9 21l-1.5-3" />
      <path d="M12 15c1.5-1.5 2-3.5 2-5.5 0-2-1-3.5-2-4.5-1 1-2 2.5-2 4.5 0 2 .5 4 2 5.5Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function WeeklyCheckInCard({
  onFollowUp,
  providerId,
}: WeeklyCheckInCardProps) {
  const [status, setStatus] = useState<WeeklyCheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoGenRan = useRef(false);

  const runGenerate = useCallback(
    async (opts: { force?: boolean } = {}) => {
      setError(null);
      setGenerating(true);
      try {
        const result = await generateWeeklyCheckin({
          force: opts.force,
          provider: providerId || undefined,
        });
        setStatus((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            latest: result.checkin,
            currentWeek: {
              weekStart: result.checkin.weekStart,
              hasCheckin: true,
            },
          };
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not generate your weekly check-in.",
        );
      } finally {
        setGenerating(false);
      }
    },
    [providerId],
  );

  useEffect(() => {
    let cancelled = false;

    fetchWeeklyCheckinStatus()
      .then((loaded) => {
        if (cancelled) return;
        setStatus(loaded);
        setLoading(false);
        const dueForRecap =
          !loaded.currentWeek.hasCheckin &&
          (loaded.hasActivity || loaded.latest !== null);
        if (dueForRecap && !autoGenRan.current) {
          autoGenRan.current = true;
          void runGenerate();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError("Could not load your weekly check-in.");
      });

    return () => {
      cancelled = true;
    };
  }, [runGenerate]);

  const display = status?.latest ?? null;

  if (loading && !status) {
    return (
      <div className="plate-stock p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <SparkleIcon />
          Weekly check-in
        </div>
        <p className="mt-3 h-16 animate-pulse bg-muted/60" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="plate-stock p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <SparkleIcon />
            Weekly check-in
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchWeeklyCheckinStatus()
                .then((loaded) => {
                  setStatus(loaded);
                  setLoading(false);
                })
                .catch(() => {
                  setLoading(false);
                  setError("Could not load your weekly check-in.");
                });
            }}
          >
            Retry
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (generating) {
    return (
      <div className="plate-stock p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="grid h-7 w-7 place-items-center bg-primary/10 text-primary">
            <SparkleIcon />
          </span>
          Weekly check-in
          <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sitting down to recap your week…
        </p>
      </div>
    );
  }

  if (!display) {
    return (
      <div className="plate-stock p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <SparkleIcon />
          Weekly check-in
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          There isn’t enough data to recap a training week yet. Log workouts and
          daily recovery check-ins, then generate your first recap.
        </p>
        <div className="mt-4">
          <Button size="sm" onClick={() => void runGenerate()}>
            Generate weekly recap
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="plate-stock p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center bg-primary/10 text-primary">
            <SparkleIcon />
          </span>
          <p className="text-sm font-semibold text-foreground">
            Weekly check-in
          </p>
          <span className="border border-foreground/20 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {formatWeekLabel(display.weekStart)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void runGenerate({ force: true })}
          disabled={generating}
        >
          <span className="mr-1.5 inline-flex">
            <RefreshIcon />
          </span>
          Refresh
        </Button>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {display.summary}
      </p>

      {display.adjustments.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {display.adjustments.map((item, index) => (
            <li
              key={`${display.id}-${index}`}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {(display.stats.workouts > 0 ||
        display.stats.readiness !== null ||
        display.stats.avgSleepHours !== null ||
        display.stats.activeInjuries > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <StatChip label="Workouts" value={String(display.stats.workouts)} />
          <StatChip label="Days trained" value={String(display.stats.daysTrained)} />
          {display.stats.avgSleepHours !== null && (
            <StatChip
              label="Avg sleep"
              value={`${display.stats.avgSleepHours.toFixed(1)}h`}
            />
          )}
          {display.stats.readiness !== null && (
            <StatChip
              label="Readiness"
              value={`${display.stats.readiness}/100`}
            />
          )}
          {display.stats.activeInjuries > 0 && (
            <StatChip
              label="Active injuries"
              value={String(display.stats.activeInjuries)}
            />
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            onFollowUp?.(
              "Turn this week's check-in into a training plan for next week.",
            )
          }
        >
          Plan next week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onFollowUp?.("Explain one adjustment from my weekly check-in.")
          }
        >
          Ask about it
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-foreground/25 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  );
}