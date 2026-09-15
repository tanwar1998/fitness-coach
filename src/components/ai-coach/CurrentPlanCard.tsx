"use client";

import type { WorkoutPlan } from "@/lib/coach-types";

/**
 * Today's plan rendered as a hung garment tag. The coach revises the plan
 * mid-conversation from check-in answers (energy, pain, time) and stamps a
 * re-issue line onto the tag: old numbers struck, new numbers measured in.
 */
export function CurrentPlanCard({
  plan,
  highlighted = false,
}: {
  plan: WorkoutPlan | null;
  highlighted?: boolean;
}) {
  if (!plan || plan.items.length === 0) return null;

  return (
    <section
      aria-label="Today's plan"
      className={`relative mx-auto w-full max-w-xl animate-tag-drop ${
        highlighted ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
      }`}
    >
      {/* Hang ring: the tag loop */}
      <span
        aria-hidden="true"
        className="absolute -top-[7px] left-6 h-[14px] w-[14px] rounded-full border-2 border-foreground/50 bg-background"
      />

      <div className="plate-stock overflow-hidden">
        {/* Top rule: the folded tag edge */}
        <div className="seam" />

        <div className="p-4 sm:p-5">
          <header className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="stamp text-muted-foreground">
                FitPulse · S/N {plan.date.replaceAll("-", "")}
              </p>
              <h2 className="mt-1 font-display text-lg font-black uppercase tracking-tight">
                Today&apos;s plan
              </h2>
              <p className="serial mt-0.5 text-[11px] text-muted-foreground">
                {plan.adjustedReason ? `RE-CUT · ${plan.date}` : plan.date}
              </p>
            </div>
            {plan.adjustedReason && (
              <span className="shrink-0 bg-primary px-2 py-1 text-xs font-black uppercase tracking-wider text-primary-foreground">
                Adjusted
              </span>
            )}
          </header>

          <div className="flex flex-col gap-1.5">
            {plan.items.map((item, index) => (
              <div
                key={`${item.exerciseId}-${item.name}-${index}`}
                className="rule-spec flex items-baseline gap-3 pb-2"
              >
                <span className="serial w-6 shrink-0 text-right text-[11px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold uppercase tracking-wide">
                    {item.name}
                  </p>
                  {item.notes && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
                <span className="serial shrink-0 text-sm font-bold">
                  {item.sets} × {item.reps}
                </span>
              </div>
            ))}
          </div>

          {plan.adjustedReason && (
            <div className="mt-3 flex items-center gap-2 border border-foreground/25 bg-secondary px-2.5 py-2 animate-stamp-in">
              <span className="h-2 w-2 shrink-0 bg-lime animate-pulse-live" />
              <p className="text-xs font-bold uppercase tracking-wide leading-snug">
                Re-cut for {plan.adjustedReason}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}