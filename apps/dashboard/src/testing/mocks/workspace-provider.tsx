/**
 * Mock Workspace Provider
 *
 * Test utility for workspace-aware components.
 */

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Workspace } from "@responix/types";

interface MockWorkspaceContextValue {
  workspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (id: string) => void;
}

const MockWorkspaceContext = createContext<MockWorkspaceContextValue | null>(null);

export interface MockWorkspaceProviderProps {
  children: ReactNode;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}

export function MockWorkspaceProvider({
  children,
  workspaces = [],
  activeWorkspaceId,
}: MockWorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null
  );

  const switchWorkspace = (id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    if (ws) setWorkspace(ws);
  };

  return (
    <MockWorkspaceContext.Provider value={{ workspace, workspaces, switchWorkspace }}>
      {children}
    </MockWorkspaceContext.Provider>
  );
}

export function useMockWorkspace(): MockWorkspaceContextValue {
  const ctx = useContext(MockWorkspaceContext);
  if (!ctx) throw new Error("useMockWorkspace must be used within MockWorkspaceProvider");
  return ctx;
}
