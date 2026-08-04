"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ErrorFallback } from "@responix/ui";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteErrorBoundary({ error, reset }: ErrorProps) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <ErrorFallback
        title={t("title")}
        description={t("description")}
        code={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
