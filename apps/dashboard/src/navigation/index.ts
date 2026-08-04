/**
 * Navigation Engine
 */

export { NavigationRegistry, type NavigationRegistryEntry } from "./registry";
export { resolveNavigation, resolveNavigationForPlacement } from "./resolver";
export { generateBreadcrumbs } from "./breadcrumbs";
export {
  StaticManifestLoader,
  type ManifestLoader,
} from "./manifest-loader";
export {
  useNavigationFilterContext,
  useResolvedNavigation,
  useBreadcrumbs,
  useActiveRouteId,
  useResolveNavigationItem,
} from "./hooks";
export type {
  ResolvedNavigationItem,
  NavigationFilterContext,
  BreadcrumbItem,
  NavigationEngineState,
  PlatformNavigationItemDto,
  PlatformNavigationSchemaDto,
  PlatformNavigationPlacement,
} from "./types";

// Re-export icon resolver for convenience
export { resolveIcon } from "../lib/icon-map";

// Re-export useNavigationRegistry from sidebar for convenience
export { useNavigationRegistry } from "../components/sidebar";
