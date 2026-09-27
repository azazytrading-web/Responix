import type { DashboardPlugin } from "./types";
import { WorkspaceManagementPage } from "./workspace-management/page";

export const workspaceManagementPlugin: DashboardPlugin = {
  id: "workspace-management",
  name: "Workspace Management",
  version: "1.0.0",
  icon: "Building2",
  permissions: ["workspace.read"],
  routes: [
    {
      path: "/company",
      labelKey: "company",
      icon: "Building2",
      permissions: ["workspace.read"],
      component: WorkspaceManagementPage
    }
  ],
  navigation: [
    {
      labelKey: "company",
      route: "/company",
      icon: "Building2",
      permissions: ["workspace.read"]
    }
  ]
};
