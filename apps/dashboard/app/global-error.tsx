"use client";

import { useTranslations } from "next-intl";
import { Inter } from "next/font/google";
import { useEffect } from "react";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="text-muted-foreground max-w-md">{t("description")}</p>
            {error.digest && (
              <p className="text-xs font-mono text-muted-foreground">{error.digest}</p>
            )}
            <button
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              {t("reload")}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
