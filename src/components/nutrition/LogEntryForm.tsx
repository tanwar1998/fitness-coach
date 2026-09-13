"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type { Ingredient } from "@/lib/wger-data";
import {
  computeMacros,
  formatMacroPreview,
  gramsFor,
  mealLabel,
  unitOptionsFor,
  type ComputedMacros,
  type MealType,
  type UnitOption,
} from "@/lib/nutrition";

export interface LogResult {
  quantity: number;
  unit: string;
  mealType: MealType;
  macros: ComputedMacros;
}

const MEAL_SELECT_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export function LogEntryForm({
  ingredient,
  defaultQuantity,
  defaultUnit,
  defaultMealType,
  autoFocusQuantity = false,
  requireQuantity = false,
  busy = false,
  onLog,
  onCancel,
}: {
  ingredient: Ingredient;
  defaultQuantity?: number | null;
  defaultUnit?: string;
  defaultMealType?: MealType;
  autoFocusQuantity?: boolean;
  requireQuantity?: boolean;
  busy?: boolean;
  onLog: (result: LogResult) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [quantityText, setQuantityText] = useState(
    defaultQuantity != null && defaultQuantity > 0 ? String(defaultQuantity) : "",
  );
  const [unitValue, setUnitValue] = useState(defaultUnit ?? "g");
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? "breakfast");
  const [justLogged, setJustLogged] = useState(false);

  const unitOptions = useMemo(() => unitOptionsFor(ingredient), [ingredient]);
  const unitOption: UnitOption | undefined = useMemo(
    () => unitOptions.find((option) => option.value === unitValue) ?? unitOptions[0],
    [unitOptions, unitValue],
  );

  const quantity = Number(quantityText);
  const quantityValid = quantityText.trim() !== "" && Number.isFinite(quantity) && quantity > 0;
  const grams = quantityValid ? gramsFor(quantity, unitOption) : 0;
  const macros = useMemo(() => computeMacros(ingredient, grams), [ingredient, grams]);
  const preview = quantityValid ? formatMacroPreview(macros) : null;

  const handleLog = async () => {
    if (!quantityValid) return;
    setJustLogged(false);
    await onLog({
      quantity,
      unit: unitOption?.value ?? "g",
      mealType,
      macros,
    });
    setJustLogged(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Quantity"
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 150"
            value={quantityText}
            autoFocus={autoFocusQuantity}
            onChange={(e) => setQuantityText(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="w-[42%] shrink-0">
          <span className={labelClass}>Unit</span>
          <select
            value={unitValue}
            onChange={(e) => setUnitValue(e.target.value)}
            className={fieldClass}
            title={unitOption?.label}
          >
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelClass}>Meal</span>
        <div className="grid grid-cols-2 gap-1.5">
          {MEAL_SELECT_OPTIONS.map((meal) => {
            const selected = meal === mealType;
            return (
              <button
                key={meal}
                type="button"
                onClick={() => setMealType(meal)}
                aria-pressed={selected}
                className={`h-9 rounded-full border px-2 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {mealLabel(meal)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="md"
          onClick={() => void handleLog()}
          disabled={busy || justLogged || !quantityValid}
          className="flex-1"
        >
          {justLogged
            ? "Logged ✓"
            : busy
              ? "Logging…"
              : requireQuantity && quantityText.trim() === ""
                ? "Add quantity"
                : `Log to ${mealLabel(mealType)}`}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 cursor-pointer text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      <p
        className={`text-xs tabular-nums ${
          preview == null
            ? requireQuantity
              ? "text-warning"
              : "text-muted-foreground"
            : "text-muted-foreground"
        }`}
      >
        {preview == null
          ? requireQuantity
            ? "Add a quantity before logging this item."
            : "Enter a quantity to see calorie & macro preview."
          : preview}
      </p>
    </div>
  );
}