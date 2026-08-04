/**
 * Navigation Resolver
 */

import type { PlatformNavigationItemDto, PlatformVisibilityDto } from "@responix/types";
import type { NavigationRegistryEntry } from "./registry";
import type { NavigationFilterContext, ResolvedNavigationItem } from "./types";

function evaluateVisibility(
  visibility: PlatformVisibilityDto | undefined,
  context: NavigationFilterContext
): boolean {
  if (!visibility) return true;

  if (visibility.permissions && visibility.permissions.length > 0) {
    const hasPerm = visibility.permissions.some((p) => context.permissions.includes(p));
    if (!hasPerm) return false;
  }

  if (visibility.featureFlags && visibility.featureFlags.length > 0) {
    const hasFlag = visibility.featureFlags.some((f) => context.features.includes(f));
    if (!hasFlag) return false;
  }

  if (visibility.workspaceIds && visibility.workspaceIds.length > 0 && context.workspaceId) {
    if (!visibility.workspaceIds.includes(context.workspaceId)) return false;
  }

  if (visibility.roles && visibility.roles.length > 0 && context.roleIds) {
    const hasRole = visibility.roles.some((r) => context.roleIds?.includes(r));
    if (!hasRole) return false;
  }

  if (visibility.planIds && visibility.planIds.length > 0 && context.planId) {
    if (!visibility.planIds.includes(context.planId)) return false;
  }

  return true;
}

function filterItem(item: PlatformNavigationItemDto, context: NavigationFilterContext): boolean {
  return evaluateVisibility(item.visibility, context);
}

function filterChildren(
  children: PlatformNavigationItemDto[] | undefined,
  context: NavigationFilterContext
): PlatformNavigationItemDto[] | undefined {
  if (!children) return undefined;
  const filtered = children
    .filter((c) => filterItem(c, context))
    .map((c) => ({
      ...c,
      children: filterChildren(c.children, context),
    }));
  return filtered.length > 0 ? filtered : undefined;
}

export function resolveNavigation(
  entries: readonly NavigationRegistryEntry[],
  context: NavigationFilterContext,
  currentPath: string
): ResolvedNavigationItem[] {
  const resolved: ResolvedNavigationItem[] = [];

  for (const entry of entries) {
    if (!filterItem(entry.item, context)) continue;

    const children = filterChildren(entry.item.children, context);

    const isActive = Boolean(
      entry.item.route === currentPath ||
        (entry.item.route && entry.item.route !== "/" && currentPath.startsWith(`${entry.item.route}/`))
    );

    resolved.push({
      ...entry.item,
      children,
      placement: entry.placement as ResolvedNavigationItem["placement"],
      active: isActive,
      depth: entry.depth,
      parentId: entry.parentId,
    });
  }

  return resolved;
}

export function resolveNavigationForPlacement(
  entries: readonly NavigationRegistryEntry[],
  context: NavigationFilterContext,
  currentPath: string,
  placement: string
): ResolvedNavigationItem[] {
  return resolveNavigation(
    entries.filter((e) => e.placement === placement),
    context,
    currentPath
  );
}
