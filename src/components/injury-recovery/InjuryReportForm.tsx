"use client";

import { useState } from "react";
import type {
  BodyRegion,
  InjuryReport,
  InjurySeverity,
  InjuryType,
  MovementPattern,
} from "../../../data";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Input } from "@/components/Input";
import { BodyRegionPicker } from "@/components/injury-recovery/BodyRegionPicker";
import {
  INJURY_SEVERITY_LABELS,
  INJURY_TYPE_LABELS,
  MOVEMENT_PATTERN_LABELS,
} from "@/lib/injury-recovery";

const SEVERITY_OPTIONS = (["mild", "moderate", "severe"] as const).map((s) => ({
  value: s,
  label: INJURY_SEVERITY_LABELS[s as InjurySeverity],
}));

const TYPE_OPTIONS = (["acute", "chronic"] as const).map((t) => ({
  value: t,
  label: INJURY_TYPE_LABELS[t as InjuryType],
}));

const MOVEMENT_OPTIONS = (Object.keys(MOVEMENT_PATTERN_LABELS) as MovementPattern[]).map(
  (m) => ({
    value: m,
    label: MOVEMENT_PATTERN_LABELS[m],
  }),
);

interface InjuryReportFormProps {
  onSubmit: (
    injury: Omit<
      InjuryReport,
      "id" | "reportedAt" | "updatedAt" | "medicalGuidanceShown"
    >,
  ) => void;
  existingRegions?: BodyRegion[];
  submitting?: boolean;
}

export function InjuryReportForm({
  onSubmit,
  existingRegions = [],
  submitting = false,
}: InjuryReportFormProps) {
  const [region, setRegion] = useState<BodyRegion | null>(null);
  const [type, setType] = useState<InjuryType>("acute");
  const [severity, setSeverity] = useState<InjurySeverity>("mild");
  const [painScore, setPainScore] = useState<number | null>(null);
  const [painTriggers, setPainTriggers] = useState<MovementPattern[]>([]);
  const [notes, setNotes] = useState("");

  const canSubmit = region !== null;

  const toggleTrigger = (pattern: MovementPattern) => {
    setPainTriggers((prev) =>
      prev.includes(pattern)
        ? prev.filter((p) => p !== pattern)
        : [...prev, pattern],
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!region || !canSubmit) return;
    onSubmit({
      userId: "",
      region,
      type,
      severity,
      status: "active",
      painScore: painScore ?? undefined,
      painTriggerMovements: painTriggers.length ? painTriggers : undefined,
      notes: notes.trim() || undefined,
    });
    // reset
    setRegion(null);
    setPainScore(null);
    setPainTriggers([]);
    setNotes("");
    setType("acute");
    setSeverity("mild");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <BodyRegionPicker
        value={region ?? undefined}
        onChange={setRegion}
        activeRegions={existingRegions}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SegmentedControl
          label="Type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => setType(v as InjuryType)}
        />
        <SegmentedControl
          label="Severity"
          options={SEVERITY_OPTIONS}
          value={severity}
          onChange={(v) => setSeverity(v as InjurySeverity)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Pain level (0–10)</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={10}
            value={painScore ?? 0}
            onChange={(e) => setPainScore(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
            aria-label="Pain score"
          />
          <span className="min-w-8 text-center text-sm font-semibold text-primary">
            {painScore ?? 0}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Pain during movement (optional)</span>
        <p className="text-xs text-muted-foreground">
          Tag movements that hurt so we can avoid them in your plan
        </p>
        <div className="flex flex-wrap gap-2">
          {MOVEMENT_OPTIONS.map((option) => {
            const active = painTriggers.includes(option.value as MovementPattern);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTrigger(option.value as MovementPattern)}
                className={`h-8 rounded-full px-3 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <Input
        label="Notes (optional)"
        placeholder="e.g. sharp pain when pressing overhead"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {region && severity === "severe" && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">
            <strong>Severe injury detected.</strong> This is plan adjustment, not
            medical advice — please consult a physiotherapist or doctor for a
            proper evaluation before continuing to train.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit || submitting}
          className="w-full"
        >
          {submitting ? "Saving…" : "Report Injury"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Not a substitute for professional medical guidance.
        </p>
      </div>
    </form>
  );
}
