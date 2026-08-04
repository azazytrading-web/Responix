/**
 * Mock Auth Provider
 *
 * Test utility that provides mock auth context values for component testing.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "@responix/auth";
import type { AuthContextValue } from "@responix/auth";

export interface MockAuthProviderProps {
  children: ReactNode;
  user?: AuthContextValue["user"];
  workspace?: AuthContextValue["workspace"];
  workspaces?: AuthContextValue["workspaces"];
  permissions?: AuthContextValue["permissions"];
  features?: AuthContextValue["features"];
  isLoading?: AuthContextValue["isLoading"];
  isAuthenticated?: AuthContextValue["isAuthenticated"];
  state?: AuthContextValue["state"];
}

export function MockAuthProvider({
  children,
  user = null,
  workspace = null,
  workspaces = [],
  permissions = [],
  features = [],
  isLoading = false,
  isAuthenticated = false,
  state = isAuthenticated ? "AUTHENTICATED" : "ANONYMOUS",
}: MockAuthProviderProps) {
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      workspace,
      workspaces,
      permissions,
      features,
      isLoading,
      isAuthenticated,
      state,
      hasPermission: (code: string) => permissions.includes(code),
      hasFeature: (flag: string) => features.includes(flag),
      hasAnyPermission: (codes: string[]) => codes.some((code) => permissions.includes(code)),
      hasAllPermissions: (codes: string[]) => codes.every((code) => permissions.includes(code)),
      login: () => Promise.resolve({ status: "authenticated" }),
      logout: () => Promise.resolve(),
      selectWorkspace: () => Promise.resolve(),
      switchWorkspace: () => Promise.resolve(),
      restoreSession: () => Promise.resolve(),
    }),
    [user, workspace, workspaces, permissions, features, isLoading, isAuthenticated, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
