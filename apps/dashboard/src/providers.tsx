"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@responix/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { platformBootstrapService, queryClient } from "@responix/state";
import { ThemeProvider } from "next-themes";
import { PlatformBootstrapProvider } from "./platform";
import { registerBuiltInPlugins } from "./plugins";

registerBuiltInPlugins();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider onSessionBoundary={() => {
          queryClient.clear();
          platformBootstrapService.invalidate();
        }}>
          <PlatformBootstrapProvider>{children}</PlatformBootstrapProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
