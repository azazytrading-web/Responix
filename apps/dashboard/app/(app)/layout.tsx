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

  // Dev-only bypass: when running on localhost in development, avoid redirecting
  // to /login so developers can view the dashboard UI quickly. This does NOT
  // change production behavior. API auth is unchanged; this only prevents the
  // client-side redirect in local dev environments.
  const devBypass = typeof window !== "undefined" && process.env.NODE_ENV === "development" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  useEffect(() => {
    if (state === "ACCESS_DENIED") {
      router.replace("/forbidden");
    } else if (!isLoading && state !== "RECOVERY_REQUIRED" && !isAuthenticated && !devBypass) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router, state, devBypass]);

  if (isLoading || platform.state === "LOADING") {
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

  if (!isAuthenticated && !devBypass) {
    return null;
  }

  if (!platform.isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageSkeleton rows={6} />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
