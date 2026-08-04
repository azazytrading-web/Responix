import { apiClient } from "@responix/api-client";
import type {
  AuthSession,
  WorkspaceSelectionChallenge
} from "./types";

export type LoginResponse = AuthSession | WorkspaceSelectionChallenge;

const cookieConfig = { credentials: "include" as const };

export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/api/v1/auth/login", { email, password }, cookieConfig);
  },
  selectWorkspace(selectionToken: string, workspaceId: string): Promise<AuthSession> {
    return apiClient.post<AuthSession>(
      "/api/v1/auth/select-workspace",
      { selectionToken, workspaceId },
      cookieConfig
    );
  },
  refresh(): Promise<AuthSession> {
    return apiClient.post<AuthSession>("/api/v1/auth/refresh", undefined, {
      ...cookieConfig,
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
  },
  logout(): Promise<{ status: "ok" }> {
    return apiClient.post<{ status: "ok" }>("/api/v1/auth/logout", undefined, cookieConfig);
  },
  switchWorkspace(workspaceId: string): Promise<AuthSession> {
    return apiClient.post<AuthSession>(
      "/api/v1/auth/switch-workspace",
      { workspaceId },
      cookieConfig
    );
  }
};
