"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/Button";
import { CustomMealForm } from "@/components/nutrition/CustomMealForm";
import type { CustomMealFormPayload } from "@/components/nutrition/CustomMealForm";
import { mealForDate } from "@/lib/nutrition";

export interface ScanEstimate {
  foodLabel: string;
  confidence: number;
  calories: number;
  protein: number;
  fat: number;
  fiber: number;
  carbs: number;
}

export function PhotoScan({
  busy = false,
  onCancel,
  onLog,
}: {
  busy?: boolean;
  onCancel?: () => void;
  onLog: (payload: CustomMealFormPayload) => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [estimate, setEstimate] = useState<ScanEstimate | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const selectFile = (next: File | null) => {
    if (!next || !next.type.startsWith("image/")) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setFile(next);
    setPreviewUrl(url);
    setEstimate(null);
    setScanError(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setScanning(true);
    setScanError(null);
    setEstimate(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/nutrition/scan", { method: "POST", body });
      const data = (await res.json()) as Partial<ScanEstimate> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Scan failed (${res.status}).`);
      }
      setEstimate(data as ScanEstimate);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : "Could not analyze that photo right now.",
      );
    } finally {
      setScanning(false);
    }
  };

  const macroItems = estimate
    ? [
        {
          label: "Calories",
          value: `${Math.round(estimate.calories)}`,
          suffix: "kcal",
          tint: "border-foreground/15 bg-[#6366f1]/10",
          text: "text-[#6366f1]",
        },
        {
          label: "Protein",
          value: estimate.protein.toFixed(1),
          suffix: "g",
          tint: "border-foreground/15 bg-[#10b981]/10",
          text: "text-[#10b981]",
        },
        {
          label: "Carbs",
          value: estimate.carbs.toFixed(1),
          suffix: "g",
          tint: "border-foreground/15 bg-[#f59e0b]/10",
          text: "text-[#f59e0b]",
        },
        {
          label: "Fat",
          value: estimate.fat.toFixed(1),
          suffix: "g",
          tint: "border-foreground/15 bg-[#f97316]/10",
          text: "text-[#f97316]",
        },
        {
          label: "Fiber",
          value: estimate.fiber.toFixed(1),
          suffix: "g",
          tint: "border-foreground/15 bg-[#c72a21]/10",
          text: "text-[#c72a21]",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative block w-full cursor-pointer overflow-hidden rounded-sm border border-dashed border-foreground/30 transition-colors hover:border-primary/50"
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Meal preview"
            width={720}
            height={384}
            unoptimized
            className="h-56 w-full object-cover"
          />
        ) : (
          <span className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="text-sm font-semibold">
              Upload a photo of your meal
            </span>
            <span className="text-xs">
              JPG, PNG or HEIC — clear, well-lit shots work best
            </span>
          </span>
        )}
        {previewUrl && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1.5 text-center text-xs font-semibold text-white">
            Change photo
          </span>
        )}
      </button>

      <div className="flex items-center gap-2">
        <Button
          size="md"
          onClick={() => void handleAnalyze()}
          disabled={scanning || busy || !file}
          className="flex-1"
        >
          {scanning ? "Analyzing…" : estimate ? "Re-analyze" : "Analyze photo"}
        </Button>
        <Button
          size="md"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          Choose different
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

      {scanError && <p className="text-xs text-danger">{scanError}</p>}

      {scanning && (
        <p className="text-xs text-muted-foreground">
          Identifying the food and estimating its macros — this usually takes a
          few seconds…
        </p>
      )}

      {estimate && (
        <div className="rounded-sm border border-foreground/15 bg-muted/30 p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {estimate.foodLabel}
            </h3>
            {estimate.confidence > 0 && (
              <span className="inline-flex items-center rounded-sm border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success stamp">
                {Math.round(estimate.confidence * 100)}% confident
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {macroItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-sm border px-2 py-1.5 ${item.tint}`}
              >
                <span className={`text-[10px] font-semibold ${item.text}`}>
                  {item.label} ({item.suffix})
                </span>
                <p className="mt-0.5 text-sm font-bold tabular-nums serial text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-foreground/10 pt-4">
            <CustomMealForm
              defaultName={estimate.foodLabel}
              defaultMacros={{
                kcal: estimate.calories,
                protein: estimate.protein,
                carbs: estimate.carbs,
                fat: estimate.fat,
              }}
              defaultMealType={mealForDate(new Date())}
              busy={busy}
              onSubmit={onLog}
              onCancel={onCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}