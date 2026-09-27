import type { DashboardPlugin } from "./types";
import { DashboardHomePage } from "./dashboard-home/page";

export const dashboardHomePlugin: DashboardPlugin = {
  id: "dashboard-home",
  name: "Dashboard Home",
  version: "1.0.0",
  icon: "LayoutDashboard",
  permissions: ["platform.read"],
  routes: [
    {
      path: "/",
      labelKey: "dashboard",
      icon: "LayoutDashboard",
      permissions: ["platform.read"],
      component: DashboardHomePage
    }
  ],
  navigation: [
    {
      labelKey: "dashboard",
      route: "/",
      icon: "LayoutDashboard",
      permissions: ["platform.read"]
    }
  ]
};
