"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type {
  BodyRegion,
  DailyCheckIn,
  InjuryReport,
  InjuryStatus,
} from "../../../../data";
import { InjuryReportForm } from "@/components/injury-recovery/InjuryReportForm";
import { InjuryList } from "@/components/injury-recovery/InjuryList";
import { DailyCheckIn as DailyCheckInCard } from "@/components/injury-recovery/DailyCheckIn";
import { AdjustedPlanView } from "@/components/injury-recovery/AdjustedPlanView";
import { computeReadinessScore } from "@/lib/injury-recovery";

export default function InjuryRecoveryPage() {
  const [injuries, setInjuries] = useState<InjuryReport[]>([]);
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [loadingInjuries, setLoadingInjuries] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [injuryRes, checkInsRes] = await Promise.all([
          fetch("/api/injury/injuries"),
          fetch("/api/injury/checkins"),
        ]);
        if (injuryRes.ok) setInjuries(await injuryRes.json());
        if (checkInsRes.ok) {
          const loaded: DailyCheckIn[] = await checkInsRes.json();
          setCheckIns(loaded);
          setReadinessScore(computeReadinessScore(loaded).score);
        }
      } catch {
        setError("Could not load your data. Please try again.");
      } finally {
        setLoadingInjuries(false);
      }
    };
    load();
  }, []);

  const activeInjuries = injuries.filter((i) => i.status !== "cleared");
  const hasInjuries = injuries.length > 0;

  const counts = {
    active: injuries.filter((i) => i.status === "active").length,
    healing: injuries.filter((i) => i.status === "healing").length,
    cleared: injuries.filter((i) => i.status === "cleared").length,
  };

  const handleCreateInjury = async (
    injury: Omit<
      InjuryReport,
      "id" | "reportedAt" | "updatedAt" | "medicalGuidanceShown"
    >,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/injury/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(injury),
      });
      if (!res.ok) throw new Error("Failed to save injury");
      const created: InjuryReport = await res.json();
      setInjuries((prev) => [created, ...prev]);
      setShowReportForm(false);
    } catch {
      setError("Failed to save injury. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: InjuryStatus) => {
    setError(null);
    try {
      const res = await fetch(`/api/injury/injuries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update injury");
      const updated: InjuryReport = await res.json();
      setInjuries((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch {
      setError("Failed to update injury status.");
    }
  };

  const handleDeleteInjury = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/injury/injuries/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete injury");
      setInjuries((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Failed to delete injury.");
    }
  };

  const handleCheckIn = async (
    checkIn: Omit<DailyCheckIn, "id" | "userId" | "source">,
  ) => {
    setError(null);
    try {
      const res = await fetch("/api/injury/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkIn,
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error("Failed to save check-in");
      const created: DailyCheckIn = await res.json();
      const merged = [created, ...checkIns].filter(
        (c, i, arr) => arr.findIndex((x) => x.date === c.date) === i,
      );
      setCheckIns(merged);
      setReadinessScore(computeReadinessScore(merged).score);
      setShowCheckIn(false);
    } catch {
      setError("Failed to save check-in. Please try again.");
    }
  };

  const handleDismissAction = () => {};
  const handleRestoreAction = () => {};

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="primary" className="mb-4">
          Injury & Recovery
        </Badge>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Train Smarter, Recover Better
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Report injuries, check in on recovery, and we&apos;ll adjust your
          plan to keep you moving — safely. This is plan adjustment, not
          medical advice.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm text-danger">
          {error}
        </div>
      )}

      {(hasInjuries || readinessScore != null) && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Active"
            value={String(counts.active)}
            tone={counts.active > 0 ? "danger" : "muted"}
          />
          <StatCard
            label="In recovery"
            value={String(counts.healing)}
            tone={counts.healing > 0 ? "primary" : "muted"}
          />
          <StatCard
            label="Cleared"
            value={String(counts.cleared)}
            tone="muted"
          />
          <StatCard
            label="Readiness"
            value={readinessScore != null ? `${readinessScore}/100` : "—"}
            tone={
              readinessScore == null
                ? "muted"
                : readinessScore >= 70
                  ? "success"
                  : readinessScore >= 50
                    ? "primary"
                    : "danger"
            }
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* LEFT COLUMN — Reporting & check-in */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          {/* Quick report entry point — always accessible */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                Report pain / injury
              </h2>
              <Button
                size="sm"
                variant={showReportForm ? "secondary" : "primary"}
                onClick={() => setShowReportForm((v) => !v)}
              >
                {showReportForm ? "Cancel" : "New report"}
              </Button>
            </div>
            {showReportForm ? (
              <div className="mt-5">
                <InjuryReportForm
                  onSubmit={handleCreateInjury}
                  existingRegions={activeInjuries.map((i) => i.region as BodyRegion)}
                  submitting={submitting}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Log where it hurts and we&apos;ll avoid or substitute exercises
                that could make it worse.
              </p>
            )}
          </section>

          {/* Daily check-in */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Daily check-in</h2>
              <Button
                size="sm"
                variant={showCheckIn ? "secondary" : "outline"}
                onClick={() => setShowCheckIn((v) => !v)}
              >
                {showCheckIn ? "Close" : "Check in"}
              </Button>
            </div>
            {showCheckIn ? (
              <div className="mt-5">
                <DailyCheckInCard
                  onSubmit={handleCheckIn}
                  latest={checkIns[0] ?? null}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                A 2-tap check-in helps us gauge your readiness and adjust
                intensity for the day.
              </p>
            )}
            {readinessScore != null && checkIns.length > 0 && (
              <div className="mt-4 rounded-xl bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your readiness</span>
                  <span className="text-sm font-semibold text-primary">
                    {readinessScore}/100
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      readinessScore >= 70
                        ? "bg-success"
                        : readinessScore >= 50
                          ? "bg-primary"
                          : "bg-danger"
                    }`}
                    style={{ width: `${readinessScore}%` }}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN — Your injuries */}
        <section className="self-start rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Your injuries</h2>
            {hasInjuries && (
              <Badge variant="secondary">{injuries.length} total</Badge>
            )}
          </div>
          <div className="mt-4">
            {loadingInjuries ? (
              <div className="flex animate-pulse flex-col gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-muted" />
                ))}
              </div>
            ) : (
              <InjuryList
                injuries={injuries}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteInjury}
              />
            )}
          </div>
        </section>
      </div>

      {/* PLAN ADJUSTMENTS */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">
          How your training plan adjusts
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          We&apos;ve pre-loaded a sample strength plan so you can see how injury
          and recovery logic works before connecting your real plan.
        </p>
        <div className="mt-5">
          {loadingInjuries ? (
            <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          ) : (
            <AdjustedPlanView
              injuries={injuries}
              readinessScore={readinessScore}
              onDismissAction={handleDismissAction}
              onRestoreAction={handleRestoreAction}
            />
          )}
        </div>
      </section>
    </div>
  );
}

type StatTone = "danger" | "primary" | "success" | "muted";

const STAT_TONES: Record<StatTone, string> = {
  danger: "text-danger",
  primary: "text-primary",
  success: "text-success",
  muted: "text-muted-foreground",
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatTone;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${STAT_TONES[tone]}`}>
        {value}
      </p>
    </div>
  );
}
