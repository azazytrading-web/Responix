"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "@responix/auth";
import {
  platformBootstrapService,
  type PlatformBootstrapSnapshot
} from "@responix/state";
import { NavigationRegistry } from "../navigation/registry";

export type PlatformBootstrapState = "IDLE" | "LOADING" | "READY" | "ERROR";

export interface PlatformContextValue {
  state: PlatformBootstrapState;
  snapshot: PlatformBootstrapSnapshot | null;
  navigationRegistry: NavigationRegistry | null;
  error: unknown;
  isReady: boolean;
  retry: () => void;
  permissions: readonly string[];
  features: readonly string[];
  hasPermission: (code: string) => boolean;
  hasFeature: (flag: string) => boolean;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformBootstrapProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, workspace } = useAuth();
  const workspaceId = workspace?.id;
  const workspaceName = workspace?.name;
  const workspaceSlug = workspace?.slug;
  const workspaceStatus = workspace?.status;
  const [state, setState] = useState<PlatformBootstrapState>("IDLE");
  const [snapshot, setSnapshot] = useState<PlatformBootstrapSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !workspaceId || !workspaceName || !workspaceSlug || !workspaceStatus) {
      platformBootstrapService.invalidate();
      setSnapshot(null);
      setError(null);
      setState("IDLE");
      return;
    }

    let active = true;
    setSnapshot(null);
    setError(null);
    setState("LOADING");
    void platformBootstrapService.bootstrap({
      id: workspaceId,
      name: workspaceName,
      slug: workspaceSlug,
      status: workspaceStatus
    }).then(
      (next) => {
        if (!active) return;
        setSnapshot(next);
        setState("READY");
      },
      (reason: unknown) => {
        if (!active) return;
        setError(reason);
        setState("ERROR");
      }
    );
    return () => { active = false; };
  }, [attempt, isAuthenticated, workspaceId, workspaceName, workspaceSlug, workspaceStatus]);

  const retry = useCallback(() => {
    if (workspaceId) platformBootstrapService.invalidate(workspaceId);
    setAttempt((value) => value + 1);
  }, [workspaceId]);

  const navigationRegistry = useMemo(() => {
    if (!snapshot) return null;
    const registry = new NavigationRegistry();
    registry.load(snapshot.navigation);
    return registry;
  }, [snapshot]);

  const permissions = snapshot?.permissions ?? [];
  const features = snapshot?.features ?? [];
  const value = useMemo<PlatformContextValue>(() => ({
    state,
    snapshot,
    navigationRegistry,
    error,
    isReady: state === "READY",
    retry,
    permissions,
    features,
    hasPermission: (code) => permissions.includes(code),
    hasFeature: (flag) => features.includes(flag)
  }), [error, features, navigationRegistry, permissions, retry, snapshot, state]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatformBootstrap(): PlatformContextValue {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatformBootstrap must be used within PlatformBootstrapProvider");
  return context;
}

export function usePlatformPermissions() {
  const { permissions, hasPermission } = usePlatformBootstrap();
  return { permissions, hasPermission };
}

export function usePlatformFeatures() {
  const { features, hasFeature } = usePlatformBootstrap();
  return { features, hasFeature };
}
