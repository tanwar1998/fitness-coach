"use client";

import { useState } from "react";
import type { NutritionTargets } from "@/lib/nutrition";

export interface ConsumedTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const FIELDS = [
  { key: "kcal", label: "Calories", unit: "", color: "#6366f1" },
  { key: "protein", label: "Protein", unit: "g", color: "#10b981" },
  { key: "carbs", label: "Carbs", unit: "g", color: "#f59e0b" },
  { key: "fat", label: "Fat", unit: "g", color: "#f97316" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const TARGET_FIELDS: Record<FieldKey, keyof NutritionTargets> = {
  kcal: "kcal",
  protein: "proteinG",
  carbs: "carbsG",
  fat: "fatG",
};

function formatValue(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
}

function TargetField({
  field,
  value,
  onSave,
}: {
  field: (typeof FIELDS)[number];
  value: number;
  onSave: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const startEditing = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    const next = Number(draft);
    if (!editing || !Number.isFinite(next) || next < 0 || next === value) return;
    setBusy(true);
    try {
      await onSave(next);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        disabled={busy}
        className="w-20 rounded-sm border border-primary bg-card px-2 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={busy}
      title="Edit target"
      className={`cursor-pointer rounded-sm px-1.5 py-0.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted ${
        busy ? "opacity-50" : ""
      }`}
    >
      {formatValue(value)}
      {field.unit && <span className="text-foreground/50">{field.unit}</span>}
    </button>
  );
}

export function DailySummary({
  consumed,
  targets,
  onSaveTargets,
}: {
  consumed: ConsumedTotals;
  targets: NutritionTargets | null;
  onSaveTargets: (next: NutritionTargets) => Promise<void>;
}) {
  if (!targets) return null;

  const saveOne = async (key: FieldKey, next: number) => {
    await onSaveTargets({ ...targets, [TARGET_FIELDS[key]]: next });
  };

  return (
    <section className="rounded-sm border border-foreground/25 bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Today&apos;s nutrition</h2>
          <p className="text-sm text-muted-foreground">
            Tap a target to adjust it. Logged items update these totals instantly.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((field) => {
          const consumedValue = consumed[field.key];
          const targetValue = targets[TARGET_FIELDS[field.key]];
          const pct = targetValue > 0 ? Math.min(100, (consumedValue / targetValue) * 100) : 0;
          const over = targetValue > 0 && consumedValue > targetValue;

          return (
            <div
              key={field.key}
              className="rounded-sm border border-foreground/15 bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: field.color }}
                />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span
                  className={`text-2xl font-bold tabular-nums serial ${
                    over ? "text-warning" : "text-foreground"
                  }`}
                >
                  {formatValue(consumedValue)}
                </span>
                <span className="text-sm text-muted-foreground">/</span>
                <TargetField field={field} value={targetValue} onSave={(n) => saveOne(field.key, n)} />
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: over ? "var(--warning)" : field.color,
                  }}
                />
              </div>
              <p className={`mt-1 text-[11px] ${over ? "text-warning" : "text-muted-foreground"}`}>
                {over
                  ? `${Math.round(pct).toLocaleString()}% — over today&apos;s target`
                  : `${Math.round(pct)}% of target`}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}