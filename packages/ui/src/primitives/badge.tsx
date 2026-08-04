import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../utils/cn";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2",
          {
            "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow hover:bg-[var(--color-primary)]/80":
              variant === "default",
            "border-transparent bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:bg-[var(--color-secondary)]/80":
              variant === "secondary",
            "border-transparent bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] shadow hover:bg-[var(--color-destructive)]/80":
              variant === "destructive",
            "text-[var(--color-foreground)]": variant === "outline",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
