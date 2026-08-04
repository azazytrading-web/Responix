import { useAuth } from "../providers/auth-provider";

export { useAuth };

export function usePermissions() {
  const { permissions, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  return { permissions, hasPermission, hasAnyPermission, hasAllPermissions };
}

export function useWorkspace() {
  const { workspace, workspaces, switchWorkspace } = useAuth();
  return { workspace, workspaces, switchWorkspace };
}

export function useTenant() {
  const { user, workspace } = useAuth();
  return { user, workspace };
}

export function useFeatures() {
  const { features, hasFeature } = useAuth();
  return { features, hasFeature };
}
