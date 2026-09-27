import type { DashboardPlugin } from "./types";
import { WhatsAppOnboardingPage } from "./whatsapp-onboarding/page";

export const whatsappOnboardingPlugin: DashboardPlugin = {
  id: "whatsapp-onboarding",
  name: "WhatsApp Business",
  version: "1.0.0",
  icon: "MessageCircle",
  permissions: ["channel.runtime.read", "whatsapp.connection.read"],
  routes: [{ path: "/channels/whatsapp", labelKey: "whatsapp", icon: "MessageCircle", permissions: ["channel.runtime.read", "whatsapp.connection.read"], component: WhatsAppOnboardingPage }],
  navigation: [{ labelKey: "whatsapp", route: "/channels/whatsapp", icon: "MessageCircle", permissions: ["channel.runtime.read", "whatsapp.connection.read"] }]
};
