/**
 * Dashboard Mock Manifest
 *
 * A local mock PlatformManifestDto that matches the backend contracts.
 * Replaceable later by GET /dashboard-runtime/bootstrap without
 * changing UI components.
 */

import type { PlatformManifestDto } from "@responix/types";

export const mockManifest: PlatformManifestDto = {
  schemaVersion: "1.0",
  id: "responix-dashboard",
  navigation: {
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        route: "/",
        icon: { name: "LayoutDashboard" },
        order: 1,
        placement: "sidebar",
      },
      {
        id: "inbox",
        label: "Inbox",
        route: "/inbox",
        icon: { name: "MessageSquare" },
        order: 2,
        placement: "sidebar",
      },
      {
        id: "customers",
        label: "Customers",
        route: "/customers",
        icon: { name: "Users" },
        order: 3,
        placement: "sidebar",
      },
      {
        id: "ai-studio",
        label: "AI Studio",
        route: "/ai-studio",
        icon: { name: "Brain" },
        order: 10,
        placement: "sidebar",
        visibility: {
          permissions: ["ai.read"],
        },
      },
      {
        id: "workflows",
        label: "Workflows",
        route: "/workflows",
        icon: { name: "Workflow" },
        order: 11,
        placement: "sidebar",
        visibility: {
          permissions: ["workflow.read"],
        },
      },
      {
        id: "knowledge",
        label: "Knowledge Base",
        route: "/knowledge",
        icon: { name: "BookOpen" },
        order: 12,
        placement: "sidebar",
        visibility: {
          permissions: ["knowledge.read"],
        },
      },
      {
        id: "settings",
        label: "Settings",
        route: "/settings",
        icon: { name: "Settings" },
        order: 20,
        placement: "sidebar",
      },
    ],
  },
  dashboard: {
    pages: [
      {
        id: "home",
        title: "Dashboard",
        route: "/",
        layout: "default",
        order: 1,
        sections: [],
      },
    ],
  },
  themes: [
    {
      id: "default",
      brand: { name: "Responix", shortName: "R" },
      colors: {
        primary: "hsl(221.2 83.2% 53.3%)",
        secondary: "hsl(210 40% 96.1%)",
      },
    },
  ],
  features: [
    {
      id: "ai-studio",
      permissions: ["ai.read", "ai.write", "ai.configure"],
    },
    {
      id: "workflows",
      permissions: ["workflow.read", "workflow.write", "workflow.execute"],
    },
    {
      id: "knowledge-base",
      permissions: ["knowledge.read", "knowledge.write"],
    },
  ],
  plugins: [],
  openApi: {},
};
