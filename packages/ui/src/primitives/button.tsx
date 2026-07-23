import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClassName =
    variant === "primary"
      ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
      : "border border-slate-300 bg-transparent text-slate-950 hover:bg-slate-100 dark:border-slate-700 dark:text-white dark:hover:bg-slate-900";

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:pointer-events-none disabled:opacity-50",
        variantClassName,
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
