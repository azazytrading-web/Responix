import type { components } from "@responix/api-client";

export type AuthUser = components["schemas"]["AuthUserDto"];
export type AuthWorkspace = components["schemas"]["AuthWorkspaceDto"];
export type AuthSession = components["schemas"]["AuthSuccessResponseDto"];
export type WorkspaceSelectionChallenge =
  components["schemas"]["WorkspaceSelectionRequiredResponseDto"];
export type PlatformCurrent = components["schemas"]["PlatformCurrentResponseDto"];

export type AuthLifecycleState =
  | "INITIALIZING"
  | "RESTORING"
  | "AUTHENTICATING"
  | "HYDRATING"
  | "AUTHENTICATED"
  | "REFRESHING"
  | "SWITCHING_WORKSPACE"
  | "LOGGING_OUT"
  | "ANONYMOUS"
  | "ACCESS_DENIED"
  | "RECOVERY_REQUIRED";

export interface DisplayMetadata {
  user: Pick<AuthUser, "id" | "email" | "fullName">;
  workspace: AuthWorkspace;
  workspaces: AuthWorkspace[];
}

export type LoginResult =
  | { status: "authenticated" }
  | { status: "workspace-selection-required"; workspaces: AuthWorkspace[] };
