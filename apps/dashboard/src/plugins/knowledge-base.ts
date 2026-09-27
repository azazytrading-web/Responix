import type { DashboardPlugin } from "./types";
import { KnowledgeBaseListPage } from "./knowledge-base/list-page";

export const knowledgeBasePlugin: DashboardPlugin = {
  id: "knowledge-base",
  name: "Knowledge Base",
  version: "1.0.0",
  icon: "Database",
  permissions: ["knowledge.base.read"],
  routes: [
    {
      path: "/knowledge",
      labelKey: "knowledge",
      icon: "Database",
      permissions: ["knowledge.base.read"],
      component: KnowledgeBaseListPage
    }
  ],
  navigation: [
    {
      labelKey: "knowledge",
      route: "/knowledge",
      icon: "Database",
      permissions: ["knowledge.base.read"]
    }
  ]
};
