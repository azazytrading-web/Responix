export const OIC_PLATFORM_APPLICATION_KEY = "OIC_PLATFORM";
export const OIC_PLATFORM_ADMIN_PRINCIPAL_KEY = "platform-admin";
export const OIC_PLATFORM_APPLICATION_NAME = "OIC Platform";
export const OIC_PLATFORM_ADMIN_NAME = "OIC Platform Administrator";

export const OIC_FOUNDATION_ADMIN_SCOPES = [
  "oic:applications:read", "oic:applications:manage", "oic:tenants:read", "oic:tenants:manage",
  "oic:principals:read", "oic:principals:manage", "oic:credentials:rotate", "oic:credentials:revoke",
  "oic:audit:read", "oic:foundation:admin"
] as const;
