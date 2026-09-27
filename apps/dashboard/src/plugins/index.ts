import type { DashboardPlugin } from "./types";
import { dashboardHomePlugin } from "./dashboard-home";
import { platformControlPlugin } from "./platform-control";
import { teamManagementPlugin } from "./team-management";
import { workspaceManagementPlugin } from "./workspace-management";
import { agentManagementPlugin } from "./agent-management";
import { knowledgeBasePlugin } from "./knowledge-base";

import { providerManagementPlugin } from "./provider-management";
import { promptLibraryPlugin } from "./prompt-library";
import { whatsappOnboardingPlugin } from "./whatsapp-onboarding";
import { conversationInboxPlugin } from "./conversation-inbox";

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

export function registerBuiltInPlugins(): void {
  if (!getPlugin(dashboardHomePlugin.id)) registerPlugin(dashboardHomePlugin);
  if (!getPlugin(workspaceManagementPlugin.id)) registerPlugin(workspaceManagementPlugin);
  if (!getPlugin(teamManagementPlugin.id)) registerPlugin(teamManagementPlugin);
  if (!getPlugin(platformControlPlugin.id)) registerPlugin(platformControlPlugin);
  if (!getPlugin(agentManagementPlugin.id)) registerPlugin(agentManagementPlugin);
  if (!getPlugin(knowledgeBasePlugin.id)) registerPlugin(knowledgeBasePlugin);

  if (!getPlugin(providerManagementPlugin.id)) registerPlugin(providerManagementPlugin);
  if (!getPlugin(promptLibraryPlugin.id)) registerPlugin(promptLibraryPlugin);
  if (!getPlugin(whatsappOnboardingPlugin.id)) registerPlugin(whatsappOnboardingPlugin);
  if (!getPlugin(conversationInboxPlugin.id)) registerPlugin(conversationInboxPlugin);
}

export { dashboardHomePlugin } from "./dashboard-home";
export { platformControlPlugin } from "./platform-control";
export { teamManagementPlugin } from "./team-management";
export { workspaceManagementPlugin } from "./workspace-management";
export { agentManagementPlugin } from "./agent-management";
export { knowledgeBasePlugin } from "./knowledge-base";
export { providerManagementPlugin } from "./provider-management";
export { promptLibraryPlugin } from "./prompt-library";
export { whatsappOnboardingPlugin } from "./whatsapp-onboarding";
export { conversationInboxPlugin } from "./conversation-inbox";
