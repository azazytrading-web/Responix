import type { ReactNode } from "react";
import { useAuth } from "../hooks/use-auth";

interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

interface AnyPermissionGuardProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function AnyPermissionGuard({ permissions, children, fallback = null }: AnyPermissionGuardProps) {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(permissions) ? <>{children}</> : <>{fallback}</>;
}

interface AllPermissionsGuardProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function AllPermissionsGuard({ permissions, children, fallback = null }: AllPermissionsGuardProps) {
  const { hasAllPermissions } = useAuth();
  return hasAllPermissions(permissions) ? <>{children}</> : <>{fallback}</>;
}

interface WorkspaceGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function WorkspaceGuard({ children, fallback = null }: WorkspaceGuardProps) {
  const { workspace } = useAuth();
  return workspace ? <>{children}</> : <>{fallback}</>;
}

interface FeatureFlagGuardProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlagGuard({ flag, children, fallback = null }: FeatureFlagGuardProps) {
  const { hasFeature } = useAuth();
  return hasFeature(flag) ? <>{children}</> : <>{fallback}</>;
}

interface AuthenticatedGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthenticatedGuard({ children, fallback = null }: AuthenticatedGuardProps) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}
