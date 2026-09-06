"use client";

import { useState } from "react";
import Image from "next/image";
import { FRONT_MUSCLES, BACK_MUSCLES } from "@/components/injury-recovery/muscleArt";

const VIEWBOX = { w: 200, h: 369 };

const HIGHLIGHT_COLOR = "#ef4444";

interface MuscleRegion {
  id: number;
  label: string;
  layerIndex: number;
}

// Front muscles: biceps(1), deltoid/shoulders(2), serratus(3), chest(4),
// abs(6), quads(10), brachialis(13), obliques(14)
const FRONT_REGIONS: MuscleRegion[] = [
  { id: 1, label: "Biceps", layerIndex: 0 },
  { id: 2, label: "Shoulders", layerIndex: 1 },
  { id: 3, label: "Serratus", layerIndex: 2 },
  { id: 4, label: "Chest", layerIndex: 3 },
  { id: 6, label: "Abs", layerIndex: 4 },
  { id: 10, label: "Quads", layerIndex: 5 },
  { id: 13, label: "Brachialis", layerIndex: 6 },
  { id: 14, label: "Obliques", layerIndex: 7 },
];

// Back muscles: triceps(5), calves(7), glutes(8), traps(9),
// hamstrings(11), lats(12), soleus(15)
const BACK_REGIONS: MuscleRegion[] = [
  { id: 5, label: "Triceps", layerIndex: 0 },
  { id: 7, label: "Calves", layerIndex: 1 },
  { id: 8, label: "Glutes", layerIndex: 2 },
  { id: 9, label: "Traps", layerIndex: 3 },
  { id: 11, label: "Hamstrings", layerIndex: 4 },
  { id: 12, label: "Lats", layerIndex: 5 },
  { id: 15, label: "Soleus", layerIndex: 6 },
];

interface MuscleBodySelectorProps {
  value: number[];
  onChange: (id: number) => void;
}

/**
 * An interactive human figure (front/back) built from the same muscle
 * artwork used across the app. Each muscle group is tappable to add or
 * remove it from the exercise filter, complementing the round-button list.
 */
export function MuscleBodySelector({
  value,
  onChange,
}: MuscleBodySelectorProps) {
  const [view, setView] = useState<"front" | "back">("front");
  const [hovered, setHovered] = useState<number | null>(null);

  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const layers = view === "front" ? FRONT_MUSCLES : BACK_MUSCLES;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
      {/* Front / back toggle + figure */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1 rounded-full border border-border bg-muted p-0.5">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div
          className="relative w-full max-w-[190px]"
          style={{ aspectRatio: `${VIEWBOX.w} / ${VIEWBOX.h}` }}
        >
          <Image
            src={`/exercise/muscles/silhouette-${view}.svg`}
            alt=""
            fill
            sizes="190px"
            className="object-fill"
            unoptimized
          />

          <svg
            viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
            className="absolute inset-0 h-full w-full"
            role="group"
            aria-label="Muscle map"
          >
            {regions.map(({ id, label, layerIndex }) => {
              const layer = layers[layerIndex];
              const selected = value.includes(id);
              const hovering = hovered === id;

              const fillOpacity = selected ? 0.9 : hovering ? 0.6 : 0.25;
              const showLabel = selected || hovering;

              return (
                <g
                  key={id}
                  className="cursor-pointer"
                  onClick={() => onChange(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  role="button"
                  aria-label={label}
                  aria-pressed={selected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onChange(id);
                    }
                  }}
                >
                  <g transform={`translate(${layer.tx} ${layer.ty})`}>
                    {layer.shapes.map((d, si) => (
                      <path
                        key={si}
                        d={d}
                        fill={HIGHLIGHT_COLOR}
                        fillOpacity={fillOpacity}
                        stroke={
                          selected || hovering ? "var(--primary)" : "none"
                        }
                        strokeWidth={selected ? 1.5 : 1}
                        className="transition-colors duration-150"
                      />
                    ))}
                  </g>
                  {showLabel && (
                    <text
                      x={100}
                      y={labelYFor(view, id)}
                      fontSize={8}
                      textAnchor="middle"
                      fill={selected ? "#fff" : "var(--foreground)"}
                      fontWeight={700}
                      pointerEvents="none"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

{value.length > 0 && (
          <p className="w-[190px] text-center text-sm font-medium text-foreground">
            Selected:{" "}
            <span className="text-primary">
              {value
                .map(
                  (v) =>
                    [...FRONT_REGIONS, ...BACK_REGIONS].find((r) => r.id === v)
                      ?.label ?? "—",
                )
                .filter(Boolean)
                .join(", ")}
            </span>
          </p>
        )}
        <p className="w-[190px] text-center text-xs text-muted-foreground">
          Tap muscles to add, tap again to remove.
        </p>
      </div>
    </div>
  );
}

function labelYFor(view: "front" | "back", id: number): number {
  if (view === "back") {
    switch (id) {
      case 5:
        return 140; // triceps
      case 7:
        return 315; // calves
      case 8:
        return 235; // glutes
      case 9:
        return 100; // traps
      case 11:
        return 260; // hamstrings
      case 12:
        return 190; // lats
      case 15:
        return 340; // soleus
      default:
        return 100;
    }
  }
  switch (id) {
    case 1:
      return 165; // biceps
    case 2:
      return 95; // shoulders
    case 3:
      return 120; // serratus
    case 4:
      return 100; // chest
    case 6:
      return 150; // abs
    case 10:
      return 240; // quads
    case 13:
      return 150; // brachialis
    case 14:
      return 190; // obliques
    default:
      return 100;
  }
}
