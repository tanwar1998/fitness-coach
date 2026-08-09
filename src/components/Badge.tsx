type BadgeVariant = "primary" | "secondary" | "outline" | "success";

const variantMap: Record<BadgeVariant, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-muted-foreground",
  success: "bg-success/10 text-success",
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantMap[variant]} ${className}`}
      {...props}
    />
  );
}
