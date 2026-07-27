import type { PlatformVisibilityDto } from "./access.js";
import type { PlatformJsonValue } from "./common.js";
import type { PlatformDashboardSchemaDto } from "./dashboard.js";
import type { PlatformNavigationSchemaDto } from "./navigation.js";

export interface PlatformThemeManifestDto {
  id: string;
  brand: { name: string; shortName?: string };
  colors: { primary: string; secondary?: string; light?: Record<string, string>; dark?: Record<string, string> };
  typography?: Record<string, string>;
  radius?: Record<string, string>;
  spacing?: Record<string, string>;
  icons?: Record<string, string>;
  assets?: { logo?: string; favicon?: string; [key: string]: string | undefined };
}

export interface PlatformWhiteLabelManifestDto {
  company: { name: string; legalName?: string; supportEmail?: string };
  domains?: string[];
  brandAssets?: PlatformThemeManifestDto["assets"];
  login?: Record<string, PlatformJsonValue>;
  emails?: Record<string, PlatformJsonValue>;
  reports?: Record<string, PlatformJsonValue>;
  themeId?: string;
  modules?: string[];
  featureFlags?: string[];
  customerDashboard?: string;
  companyDashboard?: string;
}

export interface PlatformFeatureManifestDto {
  id: string;
  dependencies?: string[];
  capabilities?: string[];
  permissions?: string[];
  planRequirements?: string[];
  visibility?: PlatformVisibilityDto;
  experimental?: boolean;
  deprecated?: boolean;
}

export interface PlatformPluginManifestDto {
  id: string;
  version: string;
  category: "channel" | "crm" | "voice" | "payment" | "calendar" | "storage" | "analytics" | (string & {});
  capabilities?: string[];
  dependencies?: string[];
  permissions?: string[];
  featureFlags?: string[];
  visibility?: PlatformVisibilityDto;
  metadata?: Record<string, PlatformJsonValue>;
}

/** Metadata only; it intentionally does not publish or generate OpenAPI. */
export interface PlatformOpenApiMetadataDto {
  tags?: string[];
  operationId?: string;
  summary?: string;
  description?: string;
  security?: string[];
  requestSchemaId?: string;
  responseSchemaIds?: Record<string, string>;
}

export interface PlatformManifestDto {
  schemaVersion: "1.0";
  id: string;
  dashboard: PlatformDashboardSchemaDto;
  navigation: PlatformNavigationSchemaDto;
  themes?: PlatformThemeManifestDto[];
  whiteLabel?: PlatformWhiteLabelManifestDto;
  features?: PlatformFeatureManifestDto[];
  plugins?: PlatformPluginManifestDto[];
  openApi?: Record<string, PlatformOpenApiMetadataDto>;
}
