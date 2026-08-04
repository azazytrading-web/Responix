import type { User, Workspace } from "../api/auth.js";

export interface PlatformCurrent {
  user: User;
  workspace: Workspace;
  permissions: string[];
  features: string[];
}
