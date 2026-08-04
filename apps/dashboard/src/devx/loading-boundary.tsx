"use client";

import { Suspense, type ReactNode } from "react";
import { PageSkeleton } from "@responix/ui";

interface GlobalLoadingBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function GlobalLoadingBoundary({
  children,
  fallback,
}: GlobalLoadingBoundaryProps) {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <div className="flex min-h-screen items-center justify-center">
            <PageSkeleton rows={6} />
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}
