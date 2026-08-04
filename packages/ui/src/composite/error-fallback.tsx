import { cn } from "../utils/cn";

export interface ErrorFallbackProps {
  title?: string;
  description?: string;
  code?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorFallback({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  code,
  onRetry,
  className,
}: ErrorFallbackProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-8 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>
        {code && (
          <p className="text-xs font-mono text-[var(--color-muted-foreground)]">{code}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] shadow transition-colors hover:bg-[var(--color-primary)]/90"
        >
          Retry
        </button>
      )}
    </div>
  );
}
