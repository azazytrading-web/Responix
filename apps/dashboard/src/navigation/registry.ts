/**
 * Navigation Registry
 *
 * Immutable storage for navigation items loaded from a manifest.
 * Supports registration, lookup, and flat/traversal access.
 */

import type { PlatformNavigationItemDto, PlatformNavigationSchemaDto } from "@responix/types";

export interface NavigationRegistryEntry {
  item: PlatformNavigationItemDto;
  placement: string;
  depth: number;
  parentId?: string;
}

export class NavigationRegistry {
  private entries: NavigationRegistryEntry[] = [];
  private byId: Map<string, NavigationRegistryEntry> = new Map();

  load(manifest: PlatformNavigationSchemaDto): void {
    this.entries = [];
    this.byId = new Map();

    for (const item of manifest.items) {
      this.registerItem(item, item.placement, 0, undefined);
    }
  }

  private registerItem(
    item: PlatformNavigationItemDto,
    placement: string,
    depth: number,
    parentId?: string
  ): void {
    const entry: NavigationRegistryEntry = { item, placement, depth, parentId };
    this.entries.push(entry);
    this.byId.set(item.id, entry);

    if (item.children) {
      for (const child of item.children) {
        this.registerItem(child, placement, depth + 1, item.id);
      }
    }
  }

  getAll(): readonly NavigationRegistryEntry[] {
    return this.entries;
  }

  getById(id: string): NavigationRegistryEntry | undefined {
    return this.byId.get(id);
  }

  getChildren(parentId: string): NavigationRegistryEntry[] {
    return this.entries.filter((e) => e.parentId === parentId);
  }

  getRoots(): NavigationRegistryEntry[] {
    return this.entries.filter((e) => e.depth === 0);
  }

  getByPlacement(placement: string): NavigationRegistryEntry[] {
    return this.entries.filter((e) => e.placement === placement);
  }

  findByRoute(route: string): NavigationRegistryEntry | undefined {
    return this.entries.find((e) => e.item.route === route);
  }

  findAncestors(id: string): NavigationRegistryEntry[] {
    const ancestors: NavigationRegistryEntry[] = [];
    let current = this.byId.get(id);
    while (current?.parentId) {
      const parent = this.byId.get(current.parentId);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }
    return ancestors;
  }

  clear(): void {
    this.entries = [];
    this.byId = new Map();
  }
}
