import type { DashboardPlugin } from "./types";

const registry = new Map<string, DashboardPlugin>();

export function registerPlugin(plugin: DashboardPlugin): void {
  if (registry.has(plugin.id)) {
    console.warn(`Plugin ${plugin.id} is already registered. Overwriting.`);
  }
  registry.set(plugin.id, plugin);
}

export function unregisterPlugin(id: string): boolean {
  return registry.delete(id);
}

export function getPlugin(id: string): DashboardPlugin | undefined {
  return registry.get(id);
}

export function getAllPlugins(): DashboardPlugin[] {
  return Array.from(registry.values());
}

export function getAuthorizedPlugins(
  userPermissions: readonly string[],
  userFeatures: readonly string[]
): DashboardPlugin[] {
  return getAllPlugins().filter((plugin) => {
    const hasPermissions = plugin.permissions.every((p) => userPermissions.includes(p));
    const hasFeatures = plugin.featureFlags
      ? plugin.featureFlags.every((f) => userFeatures.includes(f))
      : true;
    return hasPermissions && hasFeatures;
  });
}

export function createPluginManifest(): { plugins: DashboardPlugin[]; version: string } {
  return {
    plugins: getAllPlugins(),
    version: "1.0.0",
  };
}

export function clearRegistry(): void {
  registry.clear();
}
