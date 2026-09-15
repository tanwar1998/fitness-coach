"use client";

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/**
 * Transient strip shown right after the coach re-cuts today's plan, with the
 * reason it gave. Dismissed by the user, reappears whenever the plan changes.
 */
export function PlanChangeBanner({
  reason,
  onDismiss,
}: {
  reason: string | null;
  onDismiss: () => void;
}) {
  if (!reason) return null;

  return (
    <div className="flex items-start gap-2.5 border border-foreground/20 bg-secondary px-3.5 py-2.5 animate-stamp-in">
      <div className="min-w-0 flex-1">
        <p className="stamp flex items-center gap-2 text-foreground">
          <span className="h-2 w-2 shrink-0 bg-lime animate-pulse-live" />
          Plan re-issued
        </p>
        <p className="mt-0.5 text-sm leading-snug text-foreground">{reason}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss plan update"
        className="shrink-0 cursor-pointer p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}