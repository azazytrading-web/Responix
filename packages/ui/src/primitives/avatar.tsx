import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../utils/cn";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  fallback?: string;
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, src, alt, fallback, ...props }, ref) => {
    const initials = fallback
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <span
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        {src ? (
          <img src={src} alt={alt} className="aspect-square h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-muted)] text-sm font-medium text-[var(--color-muted-foreground)]">
            {initials}
          </span>
        )}
      </span>
    );
  }
);
Avatar.displayName = "Avatar";
