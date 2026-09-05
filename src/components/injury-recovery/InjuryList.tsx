"use client";

import { useState } from "react";
import type { BodyRegion, InjuryReport, InjuryStatus } from "../../../data";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  BODY_REGION_LABELS,
  INJURY_SEVERITY_LABELS,
  INJURY_STATUS_LABELS,
  MOVEMENT_PATTERN_LABELS,
} from "@/lib/injury-recovery";

interface InjuryListProps {
  injuries: InjuryReport[];
  onUpdateStatus: (id: string, status: InjuryStatus) => void;
  onDelete: (id: string) => void;
}

function statusVariant(status: InjuryStatus) {
  switch (status) {
    case "active":
      return "danger" as const;
    case "healing":
      return "primary" as const;
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

function ChevronIcon() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function InjuryList({
  injuries,
  onUpdateStatus,
  onDelete,
}: InjuryListProps) {
  const [showCleared, setShowCleared] = useState(false);

  const open = injuries.filter((i) => i.status !== "cleared");
  const cleared = injuries.filter((i) => i.status === "cleared");

  if (injuries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No injuries reported yet. Use the form to log one and we&apos;ll
          adjust your plan accordingly.
        </p>
      </div>
    );
  }

  const renderRow = (injury: InjuryReport, muted = false) => {
    const regionLabel =
      BODY_REGION_LABELS[injury.region as BodyRegion] ?? injury.region;

    const details = [
      injury.painScore != null ? `Pain ${injury.painScore}/10` : null,
      injury.painTriggerMovements?.length
        ? `Triggers: ${injury.painTriggerMovements
            .map((m) => MOVEMENT_PATTERN_LABELS[m] ?? m)
            .join(", ")}`
        : null,
    ].filter(Boolean) as string[];

    return (
      <li key={injury.id} className={`px-1 py-3 ${muted ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{regionLabel}</span>
            <span
              className={`whitespace-nowrap text-xs font-semibold ${severityColor(injury.severity)}`}
            >
              {INJURY_SEVERITY_LABELS[injury.severity]}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={statusVariant(injury.status)}>
              {INJURY_STATUS_LABELS[injury.status]}
            </Badge>
            {injury.status === "active" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateStatus(injury.id, "healing")}
              >
                Healing
              </Button>
            )}
            {(injury.status === "active" || injury.status === "healing") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateStatus(injury.id, "cleared")}
              >
                Cleared
              </Button>
            )}
            {injury.status === "cleared" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateStatus(injury.id, "active")}
              >
                Reactivate
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(injury.id)}
              aria-label={`Delete ${regionLabel} injury`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </Button>
          </div>
        </div>

        {(details.length > 0 || injury.notes) && (
          <div className="mt-1 flex flex-col gap-0.5">
            {details.length > 0 && (
              <p className="truncate text-xs text-muted-foreground">
                {details.join(" · ")}
              </p>
            )}
            {injury.notes && (
              <p className="truncate text-xs text-muted-foreground">
                {injury.notes}
              </p>
            )}
          </div>
        )}

        {injury.severity === "severe" && injury.status !== "cleared" && (
          <p className="mt-1 text-xs text-danger">
            Severe — consult a physiotherapist. Plan adjustment is not medical
            advice.
          </p>
        )}
      </li>
    );
  };

  return (
    <div>
      <ul className="divide-y divide-border">
        {open.map((injury) => renderRow(injury))}

        {cleared.length > 0 && (
          <li className="px-1 py-2">
            <button
              type="button"
              onClick={() => setShowCleared((v) => !v)}
              aria-expanded={showCleared}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronIcon />
              <span>
                {showCleared ? "Hide" : "Show"} cleared ({cleared.length})
              </span>
            </button>
            {showCleared && (
              <ul className="mt-1 divide-y divide-border">
                {cleared.map((injury) => renderRow(injury, true))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}