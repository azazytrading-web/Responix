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
  return {
    policy: new ProviderDestinationPolicy(config as never, { resolve }),
    resolve
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
});
