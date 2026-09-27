import type { DashboardPlugin } from "./types";
import { AgentListPage } from "./agent-management/list-page";

export const agentManagementPlugin: DashboardPlugin = {
  id: "agent-management",
  name: "Agent Studio",
  version: "1.0.0",
  icon: "Bot",
  permissions: ["agent.studio.read"],
  routes: [
    {
      path: "/ai/agents",
      labelKey: "agents",
      icon: "Bot",
      permissions: ["agent.studio.read"],
      component: AgentListPage
    }
  ],
  navigation: [
    {
      labelKey: "agents",
      route: "/ai/agents",
      icon: "Bot",
      permissions: ["agent.studio.read"]
    }
  ]
};
