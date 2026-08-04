"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { ApiError, NetworkError } from "@responix/api-client";
import { platformBootstrapService } from "@responix/state";
import { authApi } from "../auth-api";
import { createAuthSync } from "../cross-tab";
import type { AuthSync, AuthSyncEvent } from "../cross-tab";
import { clearAccessSession, setAccessSession } from "../session";
import type {
  AuthLifecycleState,
  AuthSession,
  AuthUser,
  AuthWorkspace,
  DisplayMetadata,
  LoginResult
} from "../types";
import { tokenExpirationDetector } from "../refresh/detector";
import { installAuthInterceptors } from "../refresh/interceptor";
import { silentRefreshManager } from "../refresh/refresh-manager";

const STORAGE_KEY = "responix:display-session";

const TRANSIENT_STATES: AuthLifecycleState[] = [
  "INITIALIZING", "RESTORING", "AUTHENTICATING", "HYDRATING", "REFRESHING",
  "SWITCHING_WORKSPACE", "LOGGING_OUT"
];

export interface AuthContextValue {
  state: AuthLifecycleState;
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  workspaces: AuthWorkspace[];
  permissions: string[];
  features: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (code: string) => boolean;
  hasFeature: (flag: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export interface AuthProviderProps {
  children: ReactNode;
  onSessionBoundary?: () => void | Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function readDisplayMetadata(): DisplayMetadata | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as DisplayMetadata) : null;
  } catch {
    return null;
  }
}

function persistDisplayMetadata(user: AuthUser, workspace: AuthWorkspace, workspaces: AuthWorkspace[]) {
  const metadata: DisplayMetadata = {
    user: { id: user.id, email: user.email, fullName: user.fullName },
    workspace,
    workspaces
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
}

export function AuthProvider({ children, onSessionBoundary }: AuthProviderProps) {
  const [state, setStateValue] = useState<AuthLifecycleState>("INITIALIZING");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
  const [workspaces, setWorkspaces] = useState<AuthWorkspace[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const selectionToken = useRef<string | null>(null);
  const stateRef = useRef<AuthLifecycleState>(state);
  const syncRef = useRef<AuthSync | null>(null);

  const setState = useCallback((next: AuthLifecycleState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const clearLocalSession = useCallback(async () => {
    clearAccessSession();
    tokenExpirationDetector.stop();
    selectionToken.current = null;
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setPermissions([]);
    setFeatures([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("responix:session");
    await onSessionBoundary?.();
  }, [onSessionBoundary]);

  const applySession = useCallback(async (
    session: AuthSession,
    knownWorkspaces: AuthWorkspace[] = []
  ) => {
    setAccessSession(session.accessToken, session.expiresIn);
    setState("HYDRATING");
    const platform = await platformBootstrapService.resolvePlatformCurrent(session.workspace.id);
    const merged = knownWorkspaces.some((item) => item.id === session.workspace.id)
      ? knownWorkspaces
      : [...knownWorkspaces, session.workspace];
    setUser(session.user);
    setWorkspace(session.workspace);
    setWorkspaces(merged);
    setPermissions(platform.permissions);
    setFeatures(platform.features);
    persistDisplayMetadata(session.user, session.workspace, merged);
    tokenExpirationDetector.start(() => { void silentRefreshManager.refresh().catch(() => undefined); });
    setState("AUTHENTICATED");
  }, [setState]);

  const handleFailure = useCallback(async (error: unknown) => {
    if (error instanceof NetworkError) {
      setState("RECOVERY_REQUIRED");
      return;
    }
    await clearLocalSession();
    setState(error instanceof ApiError && error.status === 403 ? "ACCESS_DENIED" : "ANONYMOUS");
  }, [clearLocalSession, setState]);

  const restoreSession = useCallback(async () => {
    setState("RESTORING");
    const display = readDisplayMetadata();
    localStorage.removeItem("responix:session");
    try {
      const session = await silentRefreshManager.refresh();
      await applySession(session, display?.workspaces ?? []);
    } catch (error) {
      await handleFailure(error);
    }
  }, [applySession, handleFailure, setState]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setState("AUTHENTICATING");
    try {
      const response = await authApi.login(email, password);
      if ("requiresWorkspaceSelection" in response) {
        selectionToken.current = response.selectionToken;
        setWorkspaces(response.workspaces);
        return { status: "workspace-selection-required", workspaces: response.workspaces };
      }
      await applySession(response);
      return { status: "authenticated" };
    } catch (error) {
      await handleFailure(error);
      throw error;
    }
  }, [applySession, handleFailure, setState]);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    if (!selectionToken.current) throw new Error("No workspace selection challenge is active");
    setState("AUTHENTICATING");
    try {
      const session = await authApi.selectWorkspace(selectionToken.current, workspaceId);
      selectionToken.current = null;
      await applySession(session, workspaces);
    } catch (error) {
      await handleFailure(error);
      throw error;
    }
  }, [applySession, handleFailure, setState, workspaces]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    if (workspace?.id === workspaceId) return;
    setState("SWITCHING_WORKSPACE");
    try {
      const session = await authApi.switchWorkspace(workspaceId);
      await onSessionBoundary?.();
      await applySession(session, workspaces);
      syncRef.current?.publish({ type: "SESSION_INVALIDATED" });
    } catch (error) {
      await handleFailure(error);
      throw error;
    }
  }, [applySession, handleFailure, onSessionBoundary, setState, workspace?.id, workspaces]);

  const logout = useCallback(async () => {
    setState("LOGGING_OUT");
    try {
      await authApi.logout();
    } finally {
      await clearLocalSession();
      setState("ANONYMOUS");
      syncRef.current?.publish({ type: "LOGOUT" });
    }
  }, [clearLocalSession, setState]);

  useEffect(() => {
    const removeInterceptors = installAuthInterceptors();
    const removeRefreshHandlers = silentRefreshManager.setHandlers({
      onRefreshing: () => {
        if (stateRef.current === "AUTHENTICATED") setState("REFRESHING");
      },
      onSuccess: (session) => {
        if (stateRef.current === "REFRESHING") {
          setUser(session.user);
          setWorkspace(session.workspace);
          setState("AUTHENTICATED");
          syncRef.current?.publish({ type: "SESSION_UPDATED", session });
        }
      },
      onInvalidated: () => { void clearLocalSession().then(() => setState("ANONYMOUS")); },
      onRecoveryRequired: () => setState("RECOVERY_REQUIRED")
    });
    const onSync = (event: AuthSyncEvent) => {
      if (event.type === "SESSION_UPDATED") {
        setAccessSession(event.session.accessToken, event.session.expiresIn);
        setUser(event.session.user);
      } else {
        void clearLocalSession().then(() => setState("ANONYMOUS"));
      }
    };
    syncRef.current = createAuthSync(onSync);
    void restoreSession();
    return () => {
      removeRefreshHandlers();
      removeInterceptors();
      syncRef.current?.close();
      syncRef.current = null;
      tokenExpirationDetector.stop();
    };
  }, [clearLocalSession, restoreSession, setState]);

  const value = useMemo<AuthContextValue>(() => ({
    state, user, workspace, workspaces, permissions, features,
    isLoading: TRANSIENT_STATES.includes(state),
    isAuthenticated: state === "AUTHENTICATED" || state === "REFRESHING",
    hasPermission: (code) => permissions.includes(code),
    hasFeature: (flag) => features.includes(flag),
    hasAnyPermission: (codes) => codes.some((code) => permissions.includes(code)),
    hasAllPermissions: (codes) => codes.every((code) => permissions.includes(code)),
    login, selectWorkspace, switchWorkspace, logout, restoreSession
  }), [features, login, logout, permissions, restoreSession, selectWorkspace, state, switchWorkspace, user, workspace, workspaces]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
