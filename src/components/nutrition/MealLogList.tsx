"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LogEntryForm, type LogResult } from "@/components/nutrition/LogEntryForm";
import { CustomMealForm } from "@/components/nutrition/CustomMealForm";
import type { CustomMealFormPayload } from "@/components/nutrition/CustomMealForm";
import type { Ingredient } from "@/lib/wger-data";
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type MealLogEntry,
  type MealType,
} from "@/lib/nutrition";

export interface LogUpdatePatch {
  quantity?: number;
  unit?: string;
  ingredientName?: string;
  mealType?: MealType;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

function unitLabel(entry: MealLogEntry, ingredient: Ingredient | undefined): string {
  if (!ingredient) return entry.unit;
  if (entry.unit.startsWith("wu_")) {
    const weightUnit = ingredient.weight_units.find(
      (wu) => `wu_${wu.id}` === entry.unit,
    );
    if (weightUnit) return weightUnit.name;
  }
  if (entry.unit === "oz") return "oz";
  return entry.unit;
}

function EntryRow({
  entry,
  ingredient,
  onUpdate,
  onDelete,
}: {
  entry: MealLogEntry;
  ingredient: Ingredient | undefined;
  onUpdate: (id: string, patch: LogUpdatePatch) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isCustom = Boolean(entry.isCustom);

  const handleSave = async (result: LogResult) => {
    setBusy(true);
    try {
      await onUpdate(entry.id, {
        quantity: result.quantity,
        unit: result.unit,
        mealType: result.mealType,
        kcal: result.macros.kcal,
        protein: result.macros.protein,
        carbs: result.macros.carbs,
        fat: result.macros.fat,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCustom = async (payload: CustomMealFormPayload) => {
    setBusy(true);
    try {
      await onUpdate(entry.id, {
        ingredientName: payload.name,
        mealType: payload.mealType,
        kcal: payload.kcal,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-sm border border-foreground/25 bg-card p-3">
      {editing && isCustom ? (
        <CustomMealForm
          defaultName={entry.ingredientName}
          defaultMacros={{
            kcal: entry.kcal,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
          }}
          defaultMealType={entry.mealType}
          busy={busy}
          onSubmit={handleSaveCustom}
          onCancel={() => setEditing(false)}
        />
      ) : editing && ingredient ? (
        <LogEntryForm
          ingredient={ingredient}
          defaultQuantity={entry.quantity}
          defaultUnit={entry.unit}
          defaultMealType={entry.mealType}
          busy={busy}
          onLog={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : editing ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            This entry can&apos;t be edited — the ingredient is no longer available.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            Close
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              <span className="truncate">{entry.ingredientName}</span>
              {isCustom && <Badge variant="secondary">Custom</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCustom ? (
                <span className="tabular-nums serial">
                  {Math.round(entry.kcal)} kcal · P {entry.protein.toFixed(1)}g · C{" "}
                  {entry.carbs.toFixed(1)}g · F {entry.fat.toFixed(1)}g
                </span>
              ) : (
                <>
                  {entry.quantity} × {unitLabel(entry, ingredient)} ·{" "}
                  <span className="tabular-nums serial">
                    {Math.round(entry.kcal)} kcal · P {entry.protein.toFixed(1)}g · C{" "}
                    {entry.carbs.toFixed(1)}g · F {entry.fat.toFixed(1)}g
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {!ingredient && !isCustom && (
              <Badge variant="outline">not editable</Badge>
            )}
            {confirmingDelete ? (
              <>
                <span className="text-xs text-muted-foreground">Remove?</span>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onDelete(entry.id);
                    } finally {
                      setBusy(false);
                      setConfirmingDelete(false);
                    }
                  }}
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </Button>
              </>
            ) : (
              <>
                {(ingredient || isCustom) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  aria-label={`Delete ${entry.ingredientName}`}
                >
                  ✕
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function MealLogList({
  entries,
  ingredientsById,
  onUpdate,
  onDelete,
}: {
  entries: MealLogEntry[];
  ingredientsById: Record<number, Ingredient>;
  onUpdate: (id: string, patch: LogUpdatePatch) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-sm border border-foreground/25 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">Today&apos;s meals</h2>
        <span className="rounded-sm border border-foreground/25 bg-card px-2.5 py-0.5 text-xs font-semibold text-muted-foreground stamp">
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-4">
        {MEAL_TYPES.map((mealType) => {
          const mealEntries = entries.filter((entry) => entry.mealType === mealType);
          if (mealEntries.length === 0) return null;

          return (
            <div key={mealType}>
              <h3 className="mb-2 stamp text-muted-foreground">
                {MEAL_LABELS[mealType]}
              </h3>
              <ul className="space-y-2">
                {mealEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    ingredient={
                      entry.ingredientId != null
                        ? ingredientsById[entry.ingredientId]
                        : undefined
                    }
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}