import {
  ProviderDestinationPolicy,
  ProviderDestinationRejectedError
} from "./provider-destination-policy.service";

const PUBLIC_IPV4 = "104.18.26.120";
const PUBLIC_IPV6 = "2606:4700:4700::1111";

function createPolicy(input?: {
  allowedHosts?: string[];
  allowedPorts?: number[];
  dnsTimeoutMs?: number;
  resolve?: jest.Mock;
  customProvider?: jest.Mock;
}) {
  const resolve =
    input?.resolve ?? jest.fn().mockResolvedValue([{ address: PUBLIC_IPV4, family: 4 }]);
  const values: Record<string, unknown> = {
    "ai.network.allowedHosts": input?.allowedHosts ?? ["api.openai.com"],
    "ai.network.allowedPorts": input?.allowedPorts ?? [443],
    "ai.network.dnsTimeoutMs": input?.dnsTimeoutMs ?? 100
  };
  const config = {
    getOrThrow: (key: string) => values[key]
  };
  const customProvider = input?.customProvider ?? jest.fn().mockResolvedValue({
    baseUrl: "https://custom.example/v1"
  });
  return {
    policy: new ProviderDestinationPolicy(config as never, { resolve }, {
      customAiProvider: { findFirst: customProvider }
    } as never),
    resolve, customProvider
  };
}

describe("ProviderDestinationPolicy", () => {
  it("approves an allowlisted public HTTPS destination", async () => {
    const { policy } = createPolicy();
    await expect(policy.authorize("https://api.openai.com/v1")).resolves.toMatchObject({
      hostname: "api.openai.com",
      address: PUBLIC_IPV4,
      family: 4,
      port: 443
    });
  });

  it.each([
    ["HTTP", "http://api.openai.com/v1"],
    ["FTP", "ftp://api.openai.com/file"],
    ["WebSocket", "wss://api.openai.com/socket"],
    ["file", "file:///etc/passwd"],
    ["data", "data:text/plain,secret"],
    ["JavaScript", "javascript:alert(1)"],
    ["malformed", "not a URL"]
  ])("rejects %s destinations", async (_name, url) => {
    const { policy } = createPolicy();
    await expect(policy.authorize(url)).rejects.toMatchObject({
      message: "Provider destination rejected."
    });
  });

  it("rejects URL credentials and userinfo", async () => {
    const { policy } = createPolicy();
    await expect(
      policy.authorize("https://username:password@api.openai.com/v1")
    ).rejects.toBeInstanceOf(ProviderDestinationRejectedError);
    await expect(
      policy.authorize("https://api.openai.com/v1?apiKey=provider-secret")
    ).rejects.toBeInstanceOf(ProviderDestinationRejectedError);
    await expect(
      policy.authorize("https://api.openai.com/v1#provider-secret")
    ).rejects.toBeInstanceOf(ProviderDestinationRejectedError);
  });

  it.each([
    ["127.0.0.1", "https://127.0.0.1/v1"],
    ["0.0.0.0", "https://0.0.0.0/v1"],
    ["::1", "https://[::1]/v1"]
  ])("rejects literal prohibited destination %s", async (hostname, url) => {
    const { policy } = createPolicy({ allowedHosts: [hostname] });
    await expect(policy.authorize(url)).rejects.toBeInstanceOf(ProviderDestinationRejectedError);
  });

  it("rejects non-allowlisted and local hostnames before DNS", async () => {
    const { policy, resolve } = createPolicy();
    await expect(policy.authorize("https://localhost/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
    await expect(policy.authorize("https://metadata.google.internal/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
    await expect(policy.authorize("https://attacker.example/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.100.100.200",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255"
  ])("rejects prohibited IPv4 address %s after DNS resolution", async (address) => {
    const { policy } = createPolicy({
      resolve: jest.fn().mockResolvedValue([{ address, family: 4 }])
    });
    await expect(policy.authorize("https://api.openai.com/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
  });

  it.each([
    "::1",
    "::",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2001:1::1",
    "2001:100::1",
    "3fff::1",
    "2001:2::1",
    "2002::1"
  ])("rejects prohibited IPv6 address %s after DNS resolution", async (address) => {
    const { policy } = createPolicy({
      resolve: jest.fn().mockResolvedValue([{ address, family: 6 }])
    });
    await expect(policy.authorize("https://api.openai.com/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
  });

  it("accepts a globally routable IPv6 address", async () => {
    const { policy } = createPolicy({
      resolve: jest.fn().mockResolvedValue([{ address: PUBLIC_IPV6, family: 6 }])
    });
    await expect(policy.authorize("https://api.openai.com/v1")).resolves.toMatchObject({
      address: PUBLIC_IPV6,
      family: 6
    });
  });

  it("accepts wildcard-allowlisted subdomains", async () => {
    const { policy, resolve } = createPolicy({
      allowedHosts: ["*.fbcdn.net", "graph.facebook.com"],
      resolve: jest.fn().mockResolvedValue([{ address: PUBLIC_IPV4, family: 4 }])
    });
    await expect(policy.authorize("https://scontent.xx.fbcdn.net/media")).resolves.toMatchObject({
      hostname: "scontent.xx.fbcdn.net"
    });
    expect(resolve).toHaveBeenCalledWith("scontent.xx.fbcdn.net");
  });

  it("rejects DNS rebinding when any resolved address is prohibited", async () => {
    const { policy } = createPolicy({
      resolve: jest.fn().mockResolvedValue([
        { address: PUBLIC_IPV4, family: 4 },
        { address: "127.0.0.1", family: 4 }
      ])
    });
    await expect(policy.authorize("https://api.openai.com/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
  });

  it("rejects dangerous ports unless explicitly allowlisted", async () => {
    const { policy } = createPolicy();
    await expect(policy.authorize("https://api.openai.com:22/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );

    const configured = createPolicy({ allowedPorts: [443, 8443] }).policy;
    await expect(configured.authorize("https://api.openai.com:8443/v1")).resolves.toMatchObject({
      port: 8443
    });
  });

  it("enforces the DNS timeout", async () => {
    const { policy } = createPolicy({
      dnsTimeoutMs: 5,
      resolve: jest.fn().mockReturnValue(new Promise(() => undefined))
    });
    await expect(policy.authorize("https://api.openai.com/v1")).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
  });

  it("validates and normalizes public custom endpoints without the platform host allowlist", async () => {
    const { policy } = createPolicy();
    await expect(policy.validateCustomProviderBaseUrl("HTTPS://Custom.Example:443/v1/"))
      .resolves.toBe("https://custom.example/v1");
    await expect(policy.validateCustomProviderBaseUrl("https://[2606:4700:4700::1111]/v1"))
      .resolves.toBe("https://[2606:4700:4700::1111]/v1");
    await expect(policy.validateCustomProviderBaseUrl("https://custom.example/v1?api_key=x"))
      .rejects.toBeInstanceOf(ProviderDestinationRejectedError);
  });

  it("authorizes custom destinations only for an active workspace-owned matching definition", async () => {
    const { policy, customProvider, resolve } = createPolicy();
    await expect(policy.authorize("https://custom.example/v1", {
      workspaceId: "workspace-a", providerId: "provider-a"
    })).resolves.toMatchObject({ hostname: "custom.example", address: PUBLIC_IPV4 });
    expect(customProvider).toHaveBeenCalledWith({
      where: { id: "provider-a", workspaceId: "workspace-a", status: "ACTIVE" },
      select: { baseUrl: true, supportsStreaming: true, supportsTools: true }
    });
    expect(resolve).toHaveBeenCalledWith("custom.example");
  });

  it("permits the explicit validation flow to authorize a DISABLED provider without widening invocation policy", async () => {
    const customProvider = jest.fn().mockResolvedValue({
      baseUrl: "https://custom.example/v1", supportsStreaming: false, supportsTools: false
    });
    const { policy } = createPolicy({ customProvider });
    await expect(policy.authorize("https://custom.example/v1/chat/completions", {
      workspaceId: "workspace-a", providerId: "provider-a", allowDisabledForValidation: true
    })).resolves.toMatchObject({ hostname: "custom.example" });
    expect(customProvider).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "provider-a", workspaceId: "workspace-a", status: { in: ["ACTIVE", "DISABLED"] } }
    }));
  });

  const rejectedCustomScopes: Array<{ name: string; lookup: jest.Mock; url: string }> = [
    { name: "wrong workspace", lookup: jest.fn().mockResolvedValue(null), url: "https://custom.example/v1" },
    { name: "disabled or archived", lookup: jest.fn().mockResolvedValue(null), url: "https://custom.example/v1" },
    { name: "replaced endpoint", lookup: jest.fn().mockResolvedValue({ baseUrl: "https://new.example/v1" }), url: "https://custom.example/v1" }
  ];

  it.each(rejectedCustomScopes)("rejects custom authorization for $name", async ({ lookup, url }) => {
    const { policy, resolve } = createPolicy({ customProvider: lookup });
    await expect(policy.authorize(url, {
      workspaceId: "workspace-a", providerId: "provider-a"
    })).rejects.toBeInstanceOf(ProviderDestinationRejectedError);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects internal capability claims not enabled on the persisted Custom Provider", async () => {
    const { policy, resolve } = createPolicy({
      customProvider: jest.fn().mockResolvedValue({
        baseUrl: "https://custom.example/v1", supportsStreaming: false, supportsTools: false
      })
    });
    await expect(policy.authorize("https://custom.example/v1/chat/completions", {
      workspaceId: "workspace-a", providerId: "provider-a", requiresStreaming: true
    })).rejects.toBeInstanceOf(ProviderDestinationRejectedError);
    expect(resolve).not.toHaveBeenCalled();
  });
});
