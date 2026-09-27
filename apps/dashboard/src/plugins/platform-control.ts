import type { DashboardPlugin } from "./types";
import { PlatformControlPage } from "./platform-control/page";

export const platformControlPlugin: DashboardPlugin = {
  id: "platform-control",
  name: "Platform Control",
  version: "1.0.0",
  icon: "Settings",
  permissions: ["platform.configure"],
  routes: [
    {
      path: "/platform",
      labelKey: "platformControl",
      icon: "Settings",
      permissions: ["platform.configure"],
      component: PlatformControlPage
    }
  ],
  navigation: [
    {
      labelKey: "platformControl",
      route: "/platform",
      icon: "Settings",
      permissions: ["platform.configure"]
    }
  ]
};
