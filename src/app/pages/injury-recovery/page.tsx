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
import {
  BODY_REGION_LABELS,
  computeReadinessScore,
  INJURY_SEVERITY_LABELS,
  INJURY_STATUS_LABELS,
  INJURY_TYPE_LABELS,
  MOVEMENT_PATTERN_LABELS,
} from "@/lib/injury-recovery";

export default function InjuryRecoveryPage() {
  const [injuries, setInjuries] = useState<InjuryReport[]>([]);
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [loadingInjuries, setLoadingInjuries] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [selectedInjuryId, setSelectedInjuryId] = useState<string | null>(null);

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

  const selectedInjury =
    injuries.find((i) => i.id === selectedInjuryId) ?? null;

  useEffect(() => {
    if (!selectedInjury) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedInjuryId(null);
    };
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedInjury]);

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
        <h1 className="font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
          Train Smarter, Recover Better
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Report injuries, check in on recovery, and we&apos;ll adjust your
          plan to keep you moving — safely. This is plan adjustment, not
          medical advice.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-2xl rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm text-danger">
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Quick report entry point — always accessible */}
          <section className="rounded-sm border border-foreground/25 bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-black uppercase tracking-tight">
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
          <section className="rounded-sm border border-foreground/25 bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-black uppercase tracking-tight">Daily check-in</h2>
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
              <div className="mt-4 rounded-sm bg-muted/40 p-3">
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

      {/* YOUR INJURIES */}
      <section className="mt-8 rounded-sm border border-foreground/25 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-black uppercase tracking-tight">Your injuries</h2>
          {hasInjuries && (
            <Badge variant="secondary">{injuries.length} total</Badge>
          )}
        </div>
        <div className="mt-4">
          {loadingInjuries ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-sm bg-muted"
                />
              ))}
            </div>
          ) : (
            <InjuryList
              injuries={injuries}
              onSelect={(injury) => setSelectedInjuryId(injury.id)}
            />
          )}
        </div>
      </section>

      {/* PLAN ADJUSTMENTS */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-black uppercase tracking-tight">
          How your training plan adjusts
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          We&apos;ve pre-loaded a sample strength plan so you can see how injury
          and recovery logic works before connecting your real plan.
        </p>
        <div className="mt-5">
          {loadingInjuries ? (
            <div className="h-40 animate-pulse rounded-sm bg-muted" />
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

      {/* Slide-in injury detail */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          selectedInjury ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSelectedInjuryId(null)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Injury details"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-foreground/15 bg-card transition-transform duration-300 ease-out ${
          selectedInjury ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-foreground/15 px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-black uppercase tracking-tight">Injury Details</h2>
          <button
            type="button"
            onClick={() => setSelectedInjuryId(null)}
            aria-label="Close details"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-sm border border-foreground/25 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedInjury && (
            <InjuryDetail
              injury={selectedInjury}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteInjury}
            />
          )}
        </div>
      </aside>
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
    <div className="rounded-sm border border-foreground/25 bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${STAT_TONES[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function injuryStatusVariant(status: InjuryStatus) {
  switch (status) {
    case "active":
      return "danger" as const;
    case "healing":
      return "secondary" as const;
    case "cleared":
      return "success" as const;
  }
}

function injurySeverityColor(severity: InjuryReport["severity"]) {
  switch (severity) {
    case "severe":
      return "text-danger";
    case "moderate":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function InjuryDetail({
  injury,
  onUpdateStatus,
  onDelete,
}: {
  injury: InjuryReport;
  onUpdateStatus: (id: string, status: InjuryStatus) => void;
  onDelete: (id: string) => void;
}) {
  const regionLabel =
    BODY_REGION_LABELS[injury.region as BodyRegion] ?? injury.region;
  const triggers = injury.painTriggerMovements?.length
    ? injury.painTriggerMovements.map((m) => MOVEMENT_PATTERN_LABELS[m] ?? m)
    : [];

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">{regionLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {INJURY_TYPE_LABELS[injury.type]}
          </p>
        </div>
        <Badge variant={injuryStatusVariant(injury.status)}>
          {INJURY_STATUS_LABELS[injury.status]}
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-sm bg-muted/50 p-4 text-center">
          <p
            className={`text-2xl font-bold ${injurySeverityColor(injury.severity)}`}
          >
            {INJURY_SEVERITY_LABELS[injury.severity]}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Severity</p>
        </div>
        <div className="rounded-sm bg-muted/50 p-4 text-center">
          <p className="text-2xl font-bold">
            {injury.painScore != null ? `${injury.painScore}/10` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Pain</p>
        </div>
      </div>

      {triggers.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pain triggers
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {triggers.map((t) => (
              <span
                key={t}
                className="rounded-sm border border-foreground/25 bg-muted/50 px-3 py-1 text-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {injury.notes && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {injury.notes}
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-foreground/15 pt-5">
        <InfoRow label="Reported" value={formatDate(injury.reportedAt)} />
        <InfoRow label="Last updated" value={formatDate(injury.updatedAt)} />
        {injury.clearedAt && (
          <InfoRow label="Cleared" value={formatDate(injury.clearedAt)} />
        )}
      </div>

      {injury.severity === "severe" && injury.status !== "cleared" && (
        <div className="mt-5 rounded-sm border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          Severe — consult a physiotherapist. Plan adjustment is not medical
          advice.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {injury.status === "active" && (
          <Button
            variant="secondary"
            onClick={() => onUpdateStatus(injury.id, "healing")}
          >
            Mark healing
          </Button>
        )}
        {(injury.status === "active" || injury.status === "healing") && (
          <Button
            variant="primary"
            onClick={() => onUpdateStatus(injury.id, "cleared")}
          >
            Mark cleared
          </Button>
        )}
        {injury.status === "cleared" && (
          <Button
            variant="secondary"
            onClick={() => onUpdateStatus(injury.id, "active")}
          >
            Reactivate
          </Button>
        )}
        <Button variant="danger" onClick={() => onDelete(injury.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}
