/**
 * Breadcrumb Generator
 */

import type { NavigationRegistry } from "./registry";
import type { BreadcrumbItem } from "./types";

export function generateBreadcrumbs(
  registry: NavigationRegistry,
  currentPath: string,
  t: (key: string) => string
): BreadcrumbItem[] {
  const entry = registry.findByRoute(currentPath);
  if (!entry) {
    // Fallback: derive from path segments
    const segments = currentPath
      .split("/")
      .filter(Boolean)
      .filter((s) => !["en", "ar"].includes(s));

    const items: BreadcrumbItem[] = [
      { id: "root", label: t("dashboard"), href: "/", active: segments.length === 0 },
    ];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;
      const href = "/" + segments.slice(0, i + 1).join("/");
      items.push({
        id: segment,
        label: segment.replace(/-/g, " "),
        href,
        active: i === segments.length - 1,
      });
    }

    return items;
  }

  const breadcrumbs: BreadcrumbItem[] = [];

  // Add root
  breadcrumbs.push({
    id: "root",
    label: t("dashboard"),
    href: "/",
    active: false,
  });

  // Add ancestors
  const ancestors = registry.findAncestors(entry.item.id);
  for (const ancestor of ancestors) {
    if (ancestor.item.route) {
      breadcrumbs.push({
        id: ancestor.item.id,
        label: ancestor.item.label,
        href: ancestor.item.route,
        active: false,
      });
    }
  }

  // Add current
  breadcrumbs.push({
    id: entry.item.id,
    label: entry.item.label,
    href: entry.item.route,
    active: true,
  });

  return breadcrumbs;
}
