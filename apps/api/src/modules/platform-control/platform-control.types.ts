export type JsonRecord = Record<string, unknown>;

export interface PermissionOverride {
  permission: string;
  effect: "GRANT" | "REVOKE";
}

export interface PermissionSnapshot {
  workspaceId: string;
  userId: string;
  roleId: string;
  roleName: string;
  roles: Array<{ id: string; parentRoleIds: string[]; permissions: string[] }>;
  permissionInheritance: Array<{ permission: string; inheritedPermission: string }>;
  workspaceOverrides: PermissionOverride[];
  userOverrides: PermissionOverride[];
  temporaryRoleIds: string[];
  temporaryPermissionOverrides: PermissionOverride[];
  hasActiveTemporaryAssignments: boolean;
}

export interface PermissionExplanation {
  permission: string;
  decision: "GRANT" | "DENY";
  sources: string[];
}

export interface ResolvedPermissionSnapshot {
  workspaceId: string;
  userId: string;
  revision: number;
  permissions: string[];
  explanations: PermissionExplanation[];
}

export interface FeatureSnapshot {
  key: string;
  state: "ENABLED" | "DISABLED" | "HIDDEN";
  experimental: boolean;
  dependencies: string[];
  workspaceId: string | null;
}

export interface LicenseSnapshot {
  workspaceId: string;
  planId: string | null;
  planName: string | null;
  status: string | null;
  expiresAt: Date | null;
  graceEndsAt: Date | null;
  limits: Record<string, string | number>;
  features: string[];
  entitlements: Record<string, unknown>;
  metadata: JsonRecord | null;
}

export interface BrandingSnapshot {
  workspaceId: string;
  appName: string;
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  language: string;
  timezone: string;
  currency: string;
  locale: string | null;
  dateFormat: string | null;
  timeFormat: string | null;
  direction: string | null;
  darkTheme: JsonRecord | null;
  lightTheme: JsonRecord | null;
  fonts: JsonRecord | null;
  icons: JsonRecord | null;
  faviconMetadata: JsonRecord | null;
  emailBranding: JsonRecord | null;
  loginBackground: string | null;
  dashboardStyle: JsonRecord | null;
  revision: number;
}

export interface ManifestSnapshot {
  workspaceId: string;
  schemaVersion: string;
  compatibilityVersion: string;
  revision: number;
  manifest: JsonRecord;
  migrationMetadata: JsonRecord | null;
  updatedAt: Date;
}
