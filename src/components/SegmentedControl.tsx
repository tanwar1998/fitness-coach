interface SegmentedControlOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  label?: string;
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
