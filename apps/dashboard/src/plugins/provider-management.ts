import type { DashboardPlugin } from "./types";
import { ProviderManagementPage } from "./provider-management/page";

export const providerManagementPlugin: DashboardPlugin = {
  id: "provider-management",
  name: "AI Providers",
  version: "1.0.0",
  icon: "Plug",
  permissions: ["ai.configure"],
  routes: [{ path: "/ai/providers", labelKey: "providers", icon: "Plug", permissions: ["ai.configure"], component: ProviderManagementPage }],
  navigation: [{ labelKey: "providers", route: "/ai/providers", icon: "Plug", permissions: ["ai.configure"] }]
};
