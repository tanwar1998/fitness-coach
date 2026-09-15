"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MEAL_LABELS, mealLabel, type MealType } from "@/lib/nutrition";

export interface CustomMealFormPayload {
  name: string;
  mealType: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MACRO_FIELDS = [
  { key: "kcal", label: "Calories", suffix: "kcal", tint: "border-foreground/15 bg-[#6366f1]/10", text: "text-[#6366f1]" },
  { key: "protein", label: "Protein", suffix: "g", tint: "border-foreground/15 bg-[#10b981]/10", text: "text-[#10b981]" },
  { key: "carbs", label: "Carbs", suffix: "g", tint: "border-foreground/15 bg-[#f59e0b]/10", text: "text-[#f59e0b]" },
  { key: "fat", label: "Fat", suffix: "g", tint: "border-foreground/15 bg-[#f97316]/10", text: "text-[#f97316]" },
] as const;

type MacroKey = (typeof MACRO_FIELDS)[number]["key"];

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function toValue(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function CustomMealForm({
  defaultName = "",
  defaultMacros = { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  defaultMealType,
  busy = false,
  onCancel,
  onSubmit,
}: {
  defaultName?: string;
  defaultMacros?: { kcal: number; protein: number; carbs: number; fat: number };
  defaultMealType?: MealType;
  busy?: boolean;
  onCancel?: () => void;
  onSubmit: (payload: CustomMealFormPayload) => Promise<unknown>;
}) {
  const [name, setName] = useState(defaultName);
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? "breakfast");
  const [raw, setRaw] = useState<Record<MacroKey, string>>({
    kcal: defaultMacros.kcal > 0 ? String(defaultMacros.kcal) : "",
    protein: defaultMacros.protein > 0 ? String(defaultMacros.protein) : "",
    carbs: defaultMacros.carbs > 0 ? String(defaultMacros.carbs) : "",
    fat: defaultMacros.fat > 0 ? String(defaultMacros.fat) : "",
  });
  const [justSaved, setJustSaved] = useState(false);

  const nameValid = name.trim() !== "";
  const macros = {
    kcal: toValue(raw.kcal),
    protein: toValue(raw.protein),
    carbs: toValue(raw.carbs),
    fat: toValue(raw.fat),
  };

  const handleSubmit = async () => {
    if (!nameValid) return;
    setJustSaved(false);
    await onSubmit({
      name: name.trim(),
      mealType,
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    });
    setJustSaved(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Meal name"
        placeholder="e.g. Homemade granola bowl"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        className="h-10"
      />

      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Meal
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {MEAL_TYPES.map((meal) => {
            const selected = meal === mealType;
            return (
              <button
                key={meal}
                type="button"
                onClick={() => setMealType(meal)}
                aria-pressed={selected}
                className={`h-9 rounded-sm border px-1 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/25 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {MEAL_LABELS[meal]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Macros for this meal
        </span>
        <div className="grid grid-cols-2 gap-2">
          {MACRO_FIELDS.map((field) => (
            <div
              key={field.key}
              className={`rounded-sm border px-2 py-1.5 ${field.tint}`}
            >
              <span className={`text-[10px] font-semibold ${field.text}`}>
                {field.label} ({field.suffix})
              </span>
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={raw[field.key]}
                onChange={(e) =>
                  setRaw((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder="0"
                className="mt-0.5 w-full bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="md"
          onClick={() => void handleSubmit()}
          disabled={busy || justSaved || !nameValid}
          className="flex-1"
        >
          {justSaved
            ? "Logged ✓"
            : busy
              ? "Logging…"
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

      <p className="text-xs tabular-nums serial text-muted-foreground">
        {nameValid
          ? `${macros.kcal} kcal · P ${macros.protein}g · C ${macros.carbs}g · F ${macros.fat}g`
          : "Enter a name to enable logging."}
      </p>
    </div>
  );
}