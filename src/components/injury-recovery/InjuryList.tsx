"use client";

import { useState } from "react";
import type { BodyRegion, InjuryReport, InjuryStatus } from "../../../data";
import { Badge } from "@/components/Badge";
import {
  BODY_REGION_LABELS,
  INJURY_SEVERITY_LABELS,
  INJURY_STATUS_LABELS,
  MOVEMENT_PATTERN_LABELS,
} from "@/lib/injury-recovery";

interface InjuryListProps {
  injuries: InjuryReport[];
  onSelect: (injury: InjuryReport) => void;
}

type Filter = "all" | InjuryStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "healing", label: "Healing" },
  { key: "cleared", label: "Cleared" },
];

function statusVariant(status: InjuryStatus) {
  switch (status) {
    case "active":
      return "danger" as const;
    case "healing":
      return "secondary" as const;
    case "cleared":
      return "success" as const;
  }
}

function severityColor(severity: InjuryReport["severity"]) {
  switch (severity) {
    case "severe":
      return "text-danger";
    case "moderate":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

export function InjuryList({ injuries, onSelect }: InjuryListProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts: Record<Filter, number> = {
    all: injuries.length,
    active: injuries.filter((i) => i.status === "active").length,
    healing: injuries.filter((i) => i.status === "healing").length,
    cleared: injuries.filter((i) => i.status === "cleared").length,
  };

  if (injuries.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-foreground/25 bg-card/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No injuries reported yet. Use the form to log one and we&apos;ll
          adjust your plan accordingly.
        </p>
      </div>
    );
  }

  const filtered = injuries.filter(
    (i) => filter === "all" || i.status === filter,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-foreground/25 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {f.label}
            <span
              className={`rounded-sm px-1.5 text-xs ${
                filter === f.key ? "bg-primary-foreground/20" : "bg-muted"
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 flex min-h-[160px] items-center justify-center rounded-sm border border-dashed border-foreground/25 bg-card/50">
          <p className="text-sm text-muted-foreground">
            No{" "}
            {filter === "all"
              ? ""
              : `${INJURY_STATUS_LABELS[filter].toLowerCase()} `}
            injuries right now.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((injury) => {
            const regionLabel =
              BODY_REGION_LABELS[injury.region as BodyRegion] ?? injury.region;
            const triggers = injury.painTriggerMovements?.length
              ? injury.painTriggerMovements.map(
                  (m) => MOVEMENT_PATTERN_LABELS[m] ?? m,
                )
              : [];
            return (
              <button
                key={injury.id}
                type="button"
                onClick={() => onSelect(injury)}
                className={`group flex w-full cursor-pointer flex-col rounded-sm border border-foreground/25 bg-card p-4 text-left transition-colors hover:border-primary/50 ${
                  injury.status === "cleared" ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {regionLabel}
                  </span>
                  <Badge variant={statusVariant(injury.status)}>
                    {INJURY_STATUS_LABELS[injury.status]}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-semibold ${severityColor(injury.severity)}`}
                  >
                    {INJURY_SEVERITY_LABELS[injury.severity]}
                  </span>
                  {injury.painScore != null && (
                    <span className="text-muted-foreground">
                      Pain {injury.painScore}/10
                    </span>
                  )}
                </div>
                {triggers.length > 0 && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                    Triggers: {triggers.join(", ")}
                  </p>
                )}
                {injury.notes && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {injury.notes}
                  </p>
                )}
                {injury.severity === "severe" && injury.status !== "cleared" && (
                  <p className="mt-2 text-xs font-medium text-danger">
                    Severe — see a physio
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}