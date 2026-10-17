export const OIC_PLATFORM_APPLICATION_KEY = "OIC_PLATFORM";
export const OIC_PLATFORM_ADMIN_PRINCIPAL_KEY = "platform-admin";
export const OIC_FOUNDATION_OPERATOR_PRINCIPAL_KEY = "oic-foundation-operator";
export const OIC_PLATFORM_APPLICATION_NAME = "OIC Platform";
export const OIC_PLATFORM_ADMIN_NAME = "OIC Platform Administrator";

export const OIC_FOUNDATION_ADMIN_SCOPES = [
  "oic:applications:read", "oic:applications:manage", "oic:tenants:read", "oic:tenants:manage",
  "oic:principals:read", "oic:principals:manage", "oic:credentials:rotate", "oic:credentials:revoke",
  "oic:audit:read", "oic:foundation:admin"
] as const;

export const OIC_PROVIDER_MODEL_ADMIN_SCOPES = [
  "oic:providers:read", "oic:providers:manage", "oic:connections:manage",
  "oic:catalog:read", "oic:catalog:manage", "oic:models:read", "oic:models:manage"
] as const;

// These scopes allow OIC-owned Console operations to cross application
// boundaries while each operation still requires its existing domain scope.
export const OIC_CONSOLE_SCOPES = ["oic:console:read", "oic:console:manage"] as const;
export const OIC_ECONOMICS_SCOPES = ["oic:economics:read", "oic:economics:manage"] as const;
export const OIC_USAGE_EVIDENCE_SCOPES = ["oic:usage:evidence:read"] as const;
export const OIC_ADMISSION_SCOPES = ["oic:admission:read", "oic:admission:manage"] as const;
export const OIC_RATING_SCOPES = ["oic:rating:read", "oic:rating:manage"] as const;
export const OIC_EVALUATION_SCOPES = ["oic:evaluation:read", "oic:evaluation:manage", "oic:evaluation:holdout:import"] as const;

// The operator is application-owned. It holds the evaluation scopes solely because
// Foundation's grant rule requires a grantor to hold the scope being granted.
export const OIC_FOUNDATION_OPERATOR_SCOPES = [
  "oic:principals:manage", "oic:credentials:rotate", "oic:credentials:revoke",
  "oic:evaluation:manage", "oic:evaluation:holdout:import"
] as const;
export const OIC_ELEVATED_SCOPES = ["oic:foundation:admin", "oic:evaluation:manage", "oic:evaluation:holdout:import"] as const;

export function hasOicConsoleRead(scopes: readonly string[]): boolean {
  return scopes.includes("oic:foundation:admin") || scopes.includes("oic:console:read") || scopes.includes("oic:console:manage");
}

export function hasOicConsoleManage(scopes: readonly string[]): boolean {
  return scopes.includes("oic:foundation:admin") || scopes.includes("oic:console:manage");
}
