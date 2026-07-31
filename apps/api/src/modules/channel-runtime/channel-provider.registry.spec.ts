import { ConflictException, NotFoundException } from "@nestjs/common";
import { ChannelProviderRegistry } from "./channel-provider.registry";
import type { ChannelProviderAdapter } from "./contracts/channel-provider.contract";
import { ChannelCapability } from "./channel-runtime.types";

const adapter = (key: string, capabilities: readonly ChannelCapability[] = [ChannelCapability.TEXT]) => ({
  key,
  capabilities: () => ({ supported: new Set(capabilities), limits: {}, metadata: {} })
} as unknown as ChannelProviderAdapter);

describe("ChannelProviderRegistry", () => {
  it("normalizes provider keys and exposes immutable capability discovery", () => {
    const registry = new ChannelProviderRegistry([adapter("Meta.WhatsApp.Cloud", [ChannelCapability.TEXT, ChannelCapability.IMAGE])]);
    expect(registry.resolve(" META.WHATSAPP.CLOUD ").key).toBe("Meta.WhatsApp.Cloud");
    expect(registry.supports("meta.whatsapp.cloud", ChannelCapability.IMAGE)).toBe(true);
    expect(registry.installed()).toEqual([expect.objectContaining({ key: "meta.whatsapp.cloud", capabilities: ["text", "image"] })]);
  });

  it("rejects duplicate adapters and unknown providers", () => {
    expect(() => new ChannelProviderRegistry([adapter("custom"), adapter(" CUSTOM ")])).toThrow(ConflictException);
    expect(() => new ChannelProviderRegistry([]).resolve("missing")).toThrow(NotFoundException);
  });
});
