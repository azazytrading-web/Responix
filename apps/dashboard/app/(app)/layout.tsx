"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@responix/auth";
import { PageSkeleton } from "@responix/ui";
import { AppShell } from "../../src/components/app-shell";
import { usePlatformBootstrap } from "../../src/platform";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { state, isAuthenticated, isLoading, restoreSession } = useAuth();
  const platform = usePlatformBootstrap();
  const router = useRouter();

  useEffect(() => {
    if (state === "ACCESS_DENIED") {
      router.replace("/forbidden");
    } else if (!isLoading && state !== "RECOVERY_REQUIRED" && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router, state]);

  if (isLoading || (isAuthenticated && platform.state === "LOADING")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageSkeleton rows={6} />
      </div>
    );
  }

  if (state === "ACCESS_DENIED") {
    return null;
  }

  if (state === "RECOVERY_REQUIRED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p>Unable to restore the session. Check your connection and try again.</p>
        <button type="button" onClick={() => { void restoreSession(); }} className="underline">
          Retry
        </button>
      </div>
    );
  }

  if (isAuthenticated && platform.state === "ERROR") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p>Unable to initialize the application.</p>
        <button type="button" onClick={platform.retry} className="underline">Retry</button>
      </div>
    );
  }

  if (!isAuthenticated || !platform.isReady) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
