/**
 * Navigation Engine Types
 *
 * Renderer-neutral navigation contracts that extend platform DTOs
 * with runtime resolution helpers.
 */

import type {
  PlatformNavigationItemDto,
  PlatformNavigationSchemaDto,
  PlatformNavigationPlacement,
} from "@responix/types";

export type { PlatformNavigationItemDto, PlatformNavigationSchemaDto, PlatformNavigationPlacement };

export interface ResolvedNavigationItem extends PlatformNavigationItemDto {
  placement: PlatformNavigationPlacement;
  active: boolean;
  depth: number;
  parentId?: string;
}

export interface NavigationFilterContext {
  permissions: readonly string[];
  features: readonly string[];
  workspaceId?: string;
  roleIds?: string[];
  planId?: string;
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  href?: string;
  active: boolean;
}

export interface NavigationEngineState {
  items: ResolvedNavigationItem[];
  breadcrumbs: BreadcrumbItem[];
  activeItemId: string | null;
  placementGroups: Record<PlatformNavigationPlacement, ResolvedNavigationItem[]>;
}
