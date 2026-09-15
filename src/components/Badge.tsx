type BadgeVariant = "primary" | "secondary" | "outline" | "success" | "danger";

const variantMap: Record<BadgeVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground border border-foreground/20",
  outline: "border border-foreground/30 text-foreground",
  success: "bg-success/15 text-success border border-success/40",
  danger: "bg-danger/15 text-danger border border-danger/40",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "secondary",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`stamp inline-flex items-center px-2 py-0.5 ${variantMap[variant]} ${className}`}
      {...props}
    />
  );
}