"use client";

import { useState } from "react";
import Image from "next/image";
import type { BodyRegion } from "../../../data";
import { BODY_REGION_GROUPS, BODY_REGION_LABELS } from "@/lib/injury-recovery";
import { FRONT_MUSCLES, BACK_MUSCLES } from "./muscleArt";

interface BodyRegionPickerProps {
  value?: BodyRegion;
  onChange: (region: BodyRegion) => void;
  activeRegions?: BodyRegion[];
  disabledRegions?: BodyRegion[];
  compact?: boolean;
}

/**
 * An interactive anatomical region selector.
 * A labeled silhouette figure (front/back) whose regions are directly
 * tappable, plus grouped buttons as an alternative for precise selection.
 */
export function BodyRegionPicker({
  value,
  onChange,
  activeRegions = [],
  disabledRegions = [],
  compact = false,
}: BodyRegionPickerProps) {
  const [view, setView] = useState<"front" | "back">("front");

  const isActive = (region: BodyRegion) => activeRegions.includes(region);
  const isDisabled = (region: BodyRegion) => disabledRegions.includes(region);
  const isSelected = (region: BodyRegion) => region === value;

  const visibleRegions =
    view === "front"
      ? FRONT_REGION_ORDER
      : BACK_REGION_ORDER;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Body region</span>
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
      </div>

      {!compact && (
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          {/* Labeled, tappable figure */}
          <div className="flex flex-col items-center md:min-w-[180px]">
            <BodyFigure
              view={view}
              onSelect={(region) => {
                if (!isDisabled(region)) onChange(region);
              }}
              selectedRegion={value}
              activeRegions={activeRegions}
              disabledRegions={disabledRegions}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Tap the affected area, or pick from the list.
            </p>
          </div>

          {/* Grouped region buttons */}
          <div className="max-h-[420px] overflow-y-auto pr-1">
            {BODY_REGION_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.regions.map((region) => {
                    const visible = visibleRegions.includes(region);
                    const selected = isSelected(region);
                    const disabled = isDisabled(region);
                    const existing = isActive(region);
                    return (
                      <button
                        key={region}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(region)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected
                            ? "border-transparent bg-primary text-primary-foreground"
                            : existing
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : visible
                                ? "border-border bg-card text-foreground hover:bg-muted"
                                : "border-border bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {BODY_REGION_LABELS[region]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {compact && (
        <div className="flex flex-wrap gap-2">
          {BODY_REGION_GROUPS.flatMap((group) => group.regions).map((region) => {
            const selected = isSelected(region);
            const disabled = isDisabled(region);
            const existing = isActive(region);
            return (
              <button
                key={region}
                type="button"
                disabled={disabled}
                onClick={() => onChange(region)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : existing
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {BODY_REGION_LABELS[region]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Body Figure — an anatomical figure built from the same muscle
// artwork the app uses for exercise diagrams.
//
// Rendering layers (all in the 200 x 369 figure space shared by
// public/exercise/muscles):
//   1. silhouette-<view>.svg   — shaded full-body outline (Image)
//   2. muscle art (main-*.svg) — red musculature drawn at low opacity
//   3. transparent region zones — the tappable hit areas aligned to
//      the anatomy; they highlight (tint + outline + label) on
//      hover / selection / existing injury.
// The zone coordinates below were measured from the artwork so they
// sit on the actual body parts rather than on a generic figure.
// ============================================================

const VIEWBOX = { w: 200, h: 369 };

const MUSCLE_COLOR = "#ef4444"; // red, matches the muscle diagram look

// --- measured anatomy anchors (figure space 0-200 x 0-369) --------

// Neck column
const NECK = { x: 86, y: 44, w: 27, h: 18 };

// Torso vertical bands (front and back share these)
const YOKE_Y = 60; // shoulders widen from the neck
const CHEST_Y0 = 70; // top of the chest / upper back band
const CHEST_Y1 = 118;
const CORE_Y1 = 158; // core / lower back bottom
const HIP_Y1 = 196; // hips / pelvis bottom (groin)
// Leg bands
const LEG_Y0 = 196; // hips -> leg start
const KNEE_Y = 266;
const KNEE_Y1 = 288;
const CALF_Y1 = 334;
const ANKLE_Y1 = 346;

type Side = "L" | "R";

interface RegionDef {
  region: BodyRegion;
  d: string;
  // label position (x, y) within the region
  labelX: number;
  labelY: number;
  // label rotation in degrees (for limbs)
  rotate?: number;
}

interface BodyFigureProps {
  view: "front" | "back";
  onSelect: (region: BodyRegion) => void;
  selectedRegion?: BodyRegion;
  activeRegions: BodyRegion[];
  disabledRegions: BodyRegion[];
}

function BodyFigure({
  view,
  onSelect,
  selectedRegion,
  activeRegions,
  disabledRegions,
}: BodyFigureProps) {
  const defs = view === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const muscles = view === "front" ? FRONT_MUSCLES : BACK_MUSCLES;
  const [hovered, setHovered] = useState<BodyRegion | null>(null);

  return (
    <div
      className="relative w-full max-w-[210px]"
      style={{ aspectRatio: `${VIEWBOX.w} / ${VIEWBOX.h}` }}
    >
      {/* Shaded full-body outline */}
      <Image
        src={`/exercise/muscles/silhouette-${view}.svg`}
        alt=""
        fill
        sizes="210px"
        className="object-fill"
        unoptimized
      />

      {/* Muscle art overlaying the silhouette */}
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        {muscles.map((layer, li) => (
          <g key={li} transform={`translate(${layer.tx} ${layer.ty})`}>
            {layer.shapes.map((d, si) => (
              <path
                key={si}
                d={d}
                fill={MUSCLE_COLOR}
                fillOpacity={0.32}
                stroke="none"
              />
            ))}
          </g>
        ))}
      </svg>

      {/* Interactive region zones */}
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="absolute inset-0 h-full w-full"
        role="group"
        aria-label="Anatomical map"
      >
        {defs.map(({ region, d, labelX, labelY, rotate }) => {
          const selected = selectedRegion === region;
          const active = activeRegions.includes(region);
          const disabled = disabledRegions.includes(region);
          const hovering = hovered === region;

          const fill = selected
            ? "var(--primary)"
            : active
              ? "var(--danger)"
              : disabled
                ? "var(--muted)"
                : "transparent";

          const fillOpacity = selected || active ? 0.32 : 0;

          const stroke = selected
            ? "var(--primary)"
            : active
              ? "var(--danger)"
              : hovering
                ? "var(--secondary)"
                : "var(--border)";

          const strokeOpacity = hovering || selected || active ? 0.9 : 0;

          const showLabel = selected || active || hovering;

          return (
            <g
              key={region}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(region)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(region)}
              role="button"
              aria-label={BODY_REGION_LABELS[region]}
              aria-pressed={selected}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelect(region);
                }
              }}
            >
              <path
                d={d}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                strokeWidth={selected || active ? 2 : 1.2}
                className="transition-colors duration-150"
              />
              {showLabel && (
                <text
                  x={labelX}
                  y={labelY}
                  fontSize={7}
                  textAnchor="middle"
                  fill={selected || active ? "#fff" : "var(--foreground)"}
                  fontWeight={selected || active ? 700 : 500}
                  transform={
                    rotate ? `rotate(${rotate} ${labelX} ${labelY})` : undefined
                  }
                  pointerEvents="none"
                >
                  {SHORT_LABELS[region]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Short labels for display inside the small figure regions
const SHORT_LABELS: Record<BodyRegion, string> = {
  neck: "Neck",
  shoulder_left: "Shldr",
  shoulder_right: "Shldr",
  elbow_left: "Elbow",
  elbow_right: "Elbow",
  wrist_left: "Wrist",
  wrist_right: "Wrist",
  upper_back: "U. Back",
  lower_back: "L. Back",
  chest: "Chest",
  core: "Core",
  hip_left: "Hip",
  hip_right: "Hip",
  knee_left: "Knee",
  knee_right: "Knee",
  ankle_left: "Ankle",
  ankle_right: "Ankle",
  foot_left: "Foot",
  foot_right: "Foot",
  hamstring_left: "Hamstr",
  hamstring_right: "Hamstr",
  quad_left: "Quad",
  quad_right: "Quad",
  calf_left: "Calf",
  calf_right: "Calf",
};

// Path helpers ---------------------------------------------------
function RoundedRect(x: number, y: number, w: number, h: number, rx: number) {
  return `M${x + rx} ${y} L${x + w - rx} ${y} A${rx} ${rx} 0 0 1 ${x + w} ${y + rx} L${x + w} ${y + h - rx} A${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h} L${x + rx} ${y + h} A${rx} ${rx} 0 0 1 ${x} ${y + h - rx} L${x} ${y + rx} A${rx} ${rx} 0 0 1 ${x + rx} ${y} Z`;
}

const RR = RoundedRect;

// A leg band for one side (mirrored about x=100).
// For the left side the band spans x [x0, x1]; the right side mirrors to
// [200 - x1, 200 - x0].
function LegBand(
  side: Side,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  rx: number,
) {
  const x = side === "L" ? x0 : 200 - x1;
  return RR(x, y0, x1 - x0, y1 - y0, rx);
}

const FRONT_REGION_ORDER: BodyRegion[] = [
  "neck",
  "shoulder_left",
  "shoulder_right",
  "chest",
  "core",
  "elbow_left",
  "elbow_right",
  "wrist_left",
  "wrist_right",
  "hip_left",
  "hip_right",
  "quad_left",
  "quad_right",
  "knee_left",
  "knee_right",
  "calf_left",
  "calf_right",
  "ankle_left",
  "ankle_right",
  "foot_left",
  "foot_right",
];

const BACK_REGION_ORDER: BodyRegion[] = [
  "neck",
  "shoulder_left",
  "shoulder_right",
  "elbow_left",
  "elbow_right",
  "wrist_left",
  "wrist_right",
  "upper_back",
  "lower_back",
  "hip_left",
  "hip_right",
  "hamstring_left",
  "hamstring_right",
  "knee_left",
  "knee_right",
  "calf_left",
  "calf_right",
  "ankle_left",
  "ankle_right",
  "foot_left",
  "foot_right",
];

// === Region zones (aligned to the artwork in public/exercise/muscles) ===

const FRONT_REGIONS: RegionDef[] = [
  {
    region: "neck",
    d: RR(NECK.x, NECK.y, NECK.w, NECK.h, 6),
    labelX: 100,
    labelY: NECK.y + NECK.h - 4,
  },
  {
    region: "shoulder_left",
    d: RR(46, YOKE_Y + 2, 18, 42, 8),
    labelX: 55,
    labelY: 80,
    rotate: -84,
  },
  {
    region: "shoulder_right",
    d: RR(136, YOKE_Y + 2, 18, 42, 8),
    labelX: 145,
    labelY: 80,
    rotate: 84,
  },
  {
    region: "chest",
    d: RR(56, CHEST_Y0, 88, CHEST_Y1 - CHEST_Y0, 10),
    labelX: 100,
    labelY: 96,
  },
  {
    region: "core",
    d: RR(62, CHEST_Y1, 76, CORE_Y1 - CHEST_Y1, 10),
    labelX: 100,
    labelY: 140,
  },
  {
    region: "elbow_left",
    d: RR(30, 102, 36, 54, 9),
    labelX: 48,
    labelY: 132,
    rotate: -86,
  },
  {
    region: "elbow_right",
    d: RR(134, 102, 36, 54, 9),
    labelX: 152,
    labelY: 132,
    rotate: 86,
  },
  {
    region: "wrist_left",
    d: `M6 156 L46 156 L34 210 L10 210 Z`,
    labelX: 25,
    labelY: 184,
    rotate: -82,
  },
  {
    region: "wrist_right",
    d: `M154 156 L194 156 L190 210 L166 210 Z`,
    labelX: 175,
    labelY: 184,
    rotate: 82,
  },
  {
    region: "hip_left",
    d: RR(62, 158, 37, HIP_Y1 - 158, 9),
    labelX: 80,
    labelY: 178,
    rotate: -85,
  },
  {
    region: "hip_right",
    d: RR(101, 158, 37, HIP_Y1 - 158, 9),
    labelX: 120,
    labelY: 178,
    rotate: 85,
  },
  {
    region: "quad_left",
    d: LegBand("L", 63, 97, LEG_Y0, KNEE_Y, 10),
    labelX: 80,
    labelY: 232,
    rotate: -85,
  },
  {
    region: "quad_right",
    d: LegBand("R", 63, 97, LEG_Y0, KNEE_Y, 10),
    labelX: 120,
    labelY: 232,
    rotate: 85,
  },
  {
    region: "knee_left",
    d: LegBand("L", 68, 98, KNEE_Y, KNEE_Y1, 8),
    labelX: 83,
    labelY: 280,
    rotate: -85,
  },
  {
    region: "knee_right",
    d: LegBand("R", 68, 98, KNEE_Y, KNEE_Y1, 8),
    labelX: 117,
    labelY: 280,
    rotate: 85,
  },
  {
    region: "calf_left",
    d: LegBand("L", 70, 98, KNEE_Y1, CALF_Y1, 9),
    labelX: 84,
    labelY: 313,
    rotate: -85,
  },
  {
    region: "calf_right",
    d: LegBand("R", 70, 98, KNEE_Y1, CALF_Y1, 9),
    labelX: 116,
    labelY: 313,
    rotate: 85,
  },
  {
    region: "ankle_left",
    d: RR(78, 334, 20, 12, 5),
    labelX: 86,
    labelY: 342,
    rotate: -85,
  },
  {
    region: "ankle_right",
    d: RR(102, 334, 20, 12, 5),
    labelX: 114,
    labelY: 342,
    rotate: 85,
  },
  {
    region: "foot_left",
    d: RR(64, 342, 34, 16, 7),
    labelX: 82,
    labelY: 355,
    rotate: -82,
  },
  {
    region: "foot_right",
    d: RR(102, 342, 34, 16, 7),
    labelX: 118,
    labelY: 355,
    rotate: 82,
  },
];

const BACK_REGIONS: RegionDef[] = [
  {
    region: "neck",
    d: RR(86, 46, 28, 16, 6),
    labelX: 100,
    labelY: 58,
  },
  {
    region: "shoulder_left",
    d: RR(46, 62, 18, 44, 8),
    labelX: 55,
    labelY: 84,
    rotate: -84,
  },
  {
    region: "shoulder_right",
    d: RR(136, 62, 18, 44, 8),
    labelX: 145,
    labelY: 84,
    rotate: 84,
  },
  {
    region: "upper_back",
    d: RR(54, 62, 92, 56, 10),
    labelX: 100,
    labelY: 92,
  },
  {
    region: "lower_back",
    d: RR(62, 118, 76, 42, 10),
    labelX: 100,
    labelY: 138,
  },
  {
    region: "elbow_left",
    d: RR(28, 106, 36, 52, 9),
    labelX: 46,
    labelY: 134,
    rotate: -86,
  },
  {
    region: "elbow_right",
    d: RR(136, 106, 36, 52, 9),
    labelX: 154,
    labelY: 134,
    rotate: 86,
  },
  {
    region: "wrist_left",
    d: RR(2, 158, 38, 72, 10),
    labelX: 21,
    labelY: 196,
    rotate: -72,
  },
  {
    region: "wrist_right",
    d: RR(160, 158, 38, 72, 10),
    labelX: 179,
    labelY: 196,
    rotate: 72,
  },
  {
    region: "hip_left",
    d: RR(62, 160, 37, 38, 9),
    labelX: 80,
    labelY: 180,
    rotate: -85,
  },
  {
    region: "hip_right",
    d: RR(101, 160, 37, 38, 9),
    labelX: 120,
    labelY: 180,
    rotate: 85,
  },
  {
    region: "hamstring_left",
    d: LegBand("L", 63, 99, 198, 268, 10),
    labelX: 81,
    labelY: 234,
    rotate: -85,
  },
  {
    region: "hamstring_right",
    d: LegBand("R", 63, 99, 198, 268, 10),
    labelX: 119,
    labelY: 234,
    rotate: 85,
  },
  {
    region: "knee_left",
    d: LegBand("L", 68, 99, KNEE_Y, KNEE_Y1 + 4, 8),
    labelX: 83,
    labelY: 282,
    rotate: -85,
  },
  {
    region: "knee_right",
    d: LegBand("R", 68, 99, KNEE_Y, KNEE_Y1 + 4, 8),
    labelX: 117,
    labelY: 282,
    rotate: 85,
  },
  {
    region: "calf_left",
    d: LegBand("L", 70, 98, KNEE_Y1 + 4, CALF_Y1 + 4, 9),
    labelX: 84,
    labelY: 318,
    rotate: -85,
  },
  {
    region: "calf_right",
    d: LegBand("R", 70, 98, KNEE_Y1 + 4, CALF_Y1 + 4, 9),
    labelX: 116,
    labelY: 318,
    rotate: 85,
  },
  {
    region: "ankle_left",
    d: LegBand("L", 70, 96, CALF_Y1 + 4, ANKLE_Y1 + 6, 5),
    labelX: 83,
    labelY: 346,
    rotate: -85,
  },
  {
    region: "ankle_right",
    d: LegBand("R", 70, 96, CALF_Y1 + 4, ANKLE_Y1 + 6, 5),
    labelX: 117,
    labelY: 346,
    rotate: 85,
  },
  {
    region: "foot_left",
    d: LegBand("L", 63, 98, 352, 369, 7),
    labelX: 80,
    labelY: 360,
    rotate: -82,
  },
  {
    region: "foot_right",
    d: LegBand("R", 63, 98, 352, 369, 7),
    labelX: 120,
    labelY: 360,
    rotate: 82,
  },
];