import type { DashboardPlugin } from "./types";
import { InboxPage } from "./conversation-inbox/page";

export const conversationInboxPlugin: DashboardPlugin = {
  id: "conversation-inbox",
  name: "Conversation Inbox",
  version: "1.0.0",
  icon: "MessageSquare",
  permissions: ["channel.runtime.read"],
  routes: [
    {
      path: "/inbox",
      labelKey: "inbox",
      icon: "MessageSquare",
      permissions: ["channel.runtime.read"],
      component: InboxPage
    }
  ],
  navigation: [
    {
      labelKey: "inbox",
      route: "/inbox",
      icon: "MessageSquare",
      permissions: ["channel.runtime.read"]
    }
  ]
};
