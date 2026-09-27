import { describe, expect, it } from "vitest";
import { whatsappOnboardingPlugin } from "./whatsapp-onboarding";

describe("WhatsApp onboarding plugin", () => {
  it("registers the physical route with backend permission metadata", () => {
    expect(whatsappOnboardingPlugin.permissions).toEqual([
      "channel.runtime.read", "whatsapp.connection.read"
    ]);
    expect(whatsappOnboardingPlugin.routes[0]).toMatchObject({
      path: "/channels/whatsapp",
      permissions: ["channel.runtime.read", "whatsapp.connection.read"]
    });
    expect(whatsappOnboardingPlugin.navigation?.[0]?.route).toBe("/channels/whatsapp");
  });
});
