export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="plate-violet grid h-9 w-9 shrink-0 place-items-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6.5 6.5 17.5 17.5" />
          <path d="M21 21l-1-1" />
          <path d="M3 3l1 1" />
          <path d="M18 22l4-4" />
          <path d="M2 6l4-4" />
          <path d="M3 10l7-7" />
          <path d="M14 21l7-7" />
        </svg>
      </span>
      <span className="font-display text-lg font-black uppercase tracking-tight">
        FitPulse
      </span>
    </span>
  );
}