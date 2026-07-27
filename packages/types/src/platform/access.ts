import type { PlatformConditionDto } from "./common.js";

/**
 * An allowlist of audience constraints. Renderers must evaluate every
 * specified category; this metadata never grants server-side authorization.
 */
export interface PlatformVisibilityDto {
  permissions?: string[];
  roles?: string[];
  planIds?: string[];
  workspaceIds?: string[];
  featureFlags?: string[];
  condition?: PlatformConditionDto;
}
