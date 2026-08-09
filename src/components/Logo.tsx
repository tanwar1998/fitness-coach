export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
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
      <span className="text-lg font-bold tracking-tight">FitCoach</span>
    </span>
  );
}
