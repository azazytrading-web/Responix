/**
 * Navigation Engine React Hooks
 */

import { useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@responix/auth";
import { usePlatformBootstrap } from "../platform";
import type { NavigationRegistry } from "./registry";
import { resolveNavigationForPlacement } from "./resolver";
import { generateBreadcrumbs } from "./breadcrumbs";
import type { ResolvedNavigationItem, BreadcrumbItem, NavigationFilterContext } from "./types";

export function useNavigationFilterContext(): NavigationFilterContext {
  const { workspace } = useAuth();
  const { permissions, features } = usePlatformBootstrap();

  return useMemo(
    () => ({
      permissions,
      features,
      workspaceId: workspace?.id,
    }),
    [permissions, features, workspace]
  );
}

export function useResolvedNavigation(
  registry: NavigationRegistry,
  placement: string
): ResolvedNavigationItem[] {
  const pathname = usePathname();
  const context = useNavigationFilterContext();

  return useMemo(() => {
    return resolveNavigationForPlacement(registry.getAll(), context, pathname, placement);
  }, [registry, context, pathname, placement]);
}

export function useBreadcrumbs(
  registry: NavigationRegistry,
  t: (key: string) => string
): BreadcrumbItem[] {
  const pathname = usePathname();

  return useMemo(() => {
    return generateBreadcrumbs(registry, pathname, t);
  }, [registry, pathname, t]);
}

export function useActiveRouteId(registry: NavigationRegistry): string | null {
  const pathname = usePathname();

  return useMemo(() => {
    const entry = registry.findByRoute(pathname);
    return entry?.item.id ?? null;
  }, [registry, pathname]);
}

export function useResolveNavigationItem(
  registry: NavigationRegistry
): (id: string) => ResolvedNavigationItem | undefined {
  const pathname = usePathname();

  return useCallback(
    (id: string) => {
      const entry = registry.getById(id);
      if (!entry) return undefined;

      const isActive = Boolean(
        entry.item.route === pathname ||
          (entry.item.route && entry.item.route !== "/" && pathname.startsWith(`${entry.item.route}/`))
      );

      return {
        ...entry.item,
        placement: entry.placement as ResolvedNavigationItem["placement"],
        active: isActive,
        depth: entry.depth,
        parentId: entry.parentId,
      };
    },
    [registry, pathname]
  );
}
