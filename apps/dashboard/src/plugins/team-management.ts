import type { DashboardPlugin } from "./types";
import { TeamManagementPage } from "./team-management/page";

export const teamManagementPlugin: DashboardPlugin = {
  id: "team-management",
  name: "Team Management",
  version: "1.0.0",
  icon: "Users",
  permissions: ["workspace.members.read"],
  routes: [
    {
      path: "/company/members",
      labelKey: "members",
      icon: "Users",
      permissions: ["workspace.members.read"],
      component: TeamManagementPage
    },
  ],
  navigation: [
    {
      labelKey: "members",
      route: "/company/members",
      icon: "Users",
      permissions: ["workspace.members.read"]
    }
  ]
};
