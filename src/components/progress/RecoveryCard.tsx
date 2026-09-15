"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { computeReadinessScore, fetchCheckIns } from "@/lib/injury-recovery";
import type { DailyCheckIn } from "../../../data";

function HeartPulseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}

function readinessTone(score: number) {
  if (score < 35) return "text-danger";
  if (score < 55) return "text-warning";
  if (score < 70) return "text-lime";
  return "text-success";
}

function readinessLabel(score: number) {
  if (score < 35) return "Needs rest";
  if (score < 55) return "Keep it light";
  if (score < 70) return "Moderate";
  return "Ready to train";
}

function fmtDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function RecoveryCard() {
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCheckIns()
      .then((loaded) => {
        if (cancelled) return;
        setCheckIns(loaded);
      })
      .catch(() => {
        if (cancelled) return;
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const readiness = useMemo(() => computeReadinessScore(checkIns), [checkIns]);
  const recent = useMemo(() => checkIns.slice(0, 5), [checkIns]);

  return (
    <div className="border border-foreground/25 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display font-black uppercase tracking-tight text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
            <HeartPulseIcon />
          </span>
          Recovery &amp; rest
        </h2>
        <Link
          href="/pages/injury-recovery"
          className="text-xs font-medium text-primary hover:underline"
        >
          Log check-in
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Loading your recovery data…
        </p>
      ) : checkIns.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            No recovery check-ins yet. Log how you slept and how sore you feel
            after training so we can suggest rest or lighter days.
          </p>
          <div className="mt-4">
            <Link href="/pages/injury-recovery">
              <Button size="sm" variant="outline">
                Add today&apos;s check-in
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <p className={`text-4xl font-bold tabular-nums ${readinessTone(readiness.score)}`}>
              {readiness.score}
            </p>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {readinessLabel(readiness.score)} · <span className="tabular-nums">{readiness.score}/100</span>
              </p>
<p className="text-xs text-muted-foreground">
                  Based on your latest check-ins
                </p>
            </div>
          </div>

          {readiness.score < 55 && (
            <div className="mt-4 rounded-sm border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
              <p className="font-medium">
                Your readiness is {readiness.score}/100 — consider a rest day or
                a lighter session.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/pages/generate-workout">
                  <Button size="sm">Generate a lighter session</Button>
                </Link>
                <Link href="/pages/injury-recovery">
                  <Button size="sm" variant="outline">
                    Check in / rest
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {recent.map((checkIn) => (
                <li
                  key={checkIn.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {fmtDate(checkIn.date)}
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <span title="Sleep">
                      😴 {checkIn.sleepHours != null ? `${checkIn.sleepHours}h` : "—"}
                    </span>
                    <span title="Soreness">
                      🔴 {checkIn.sorenessScore}/5
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}