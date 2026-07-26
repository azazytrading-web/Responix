import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isIP } from "node:net";
import { ProviderDnsResolver, type ProviderDnsRecord } from "./provider-dns-resolver.service";

export class ProviderDestinationRejectedError extends Error {
  constructor(public readonly reason: string) {
    super("Provider destination rejected.");
    this.name = "ProviderDestinationRejectedError";
    Object.defineProperty(this, "reason", { enumerable: false });
  }
}

export interface ApprovedProviderDestination {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
  port: number;
}

@Injectable()
export class ProviderDestinationPolicy {
  constructor(
    private readonly config: ConfigService,
    private readonly dns: ProviderDnsResolver
  ) {}

  async authorize(rawUrl: string): Promise<ApprovedProviderDestination> {
    const url = this.parse(rawUrl);
    const hostname = this.normalizeHostname(url.hostname);
    this.validateUrl(url, hostname);

    const literalFamily = isIP(hostname);
    const records = literalFamily
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await this.resolveWithTimeout(hostname);
    if (!records.length) this.reject("DNS resolution returned no addresses");
    for (const record of records) this.validateAddress(record.address);

    const selected = records[0];
    if (!selected) this.reject("DNS resolution returned no addresses");
    return {
      url,
      hostname,
      address: selected.address,
      family: selected.family,
      port: url.port ? Number.parseInt(url.port, 10) : 443
    };
  }

  private parse(rawUrl: string): URL {
    try {
      return new URL(rawUrl);
    } catch {
      return this.reject("Malformed provider URL");
    }
  }

  private validateUrl(url: URL, hostname: string): void {
    if (url.protocol !== "https:") this.reject("Provider scheme is not HTTPS");
    if (url.username || url.password) this.reject("Provider URL contains user information");
    if (url.hash) this.reject("Provider URL contains a fragment");
    if (
      [...url.searchParams.keys()].some((key) =>
        /^(authorization|credential|username|password|token|api[-_]?key|secret)$/i.test(key)
      )
    ) {
      this.reject("Provider URL contains credential parameters");
    }
    if (!hostname || hostname.includes("%")) this.reject("Provider hostname is invalid");
    if (this.isLocalHostname(hostname)) this.reject("Provider hostname is local or reserved");

    const allowedHosts = this.config.getOrThrow<string[]>("ai.network.allowedHosts");
    if (!allowedHosts.includes(hostname)) this.reject("Provider hostname is not allowlisted");

    const port = url.port ? Number.parseInt(url.port, 10) : 443;
    const allowedPorts = this.config.getOrThrow<number[]>("ai.network.allowedPorts");
    if (!Number.isInteger(port) || port < 1 || port > 65_535 || !allowedPorts.includes(port)) {
      this.reject("Provider port is not allowlisted");
    }
  }

  private async resolveWithTimeout(hostname: string): Promise<ProviderDnsRecord[]> {
    const timeoutMs = this.config.getOrThrow<number>("ai.network.dnsTimeoutMs");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.dns.resolve(hostname),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new ProviderDestinationRejectedError("Provider DNS resolution timed out")),
            timeoutMs
          );
        })
      ]);
    } catch (error: unknown) {
      if (error instanceof ProviderDestinationRejectedError) throw error;
      return this.reject("Provider DNS resolution failed");
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private validateAddress(address: string): void {
    const family = isIP(address);
    if (family === 4) {
      if (!this.isPublicIpv4(address)) this.reject("Provider resolved to a prohibited IPv4 range");
      return;
    }
    if (family === 6) {
      if (!this.isPublicIpv6(address)) this.reject("Provider resolved to a prohibited IPv6 range");
      return;
    }
    this.reject("Provider DNS returned an invalid address");
  }

  private isPublicIpv4(address: string): boolean {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return false;
    }
    const value =
      (((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
    return ![
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4]
    ].some(([network, prefix]) => this.ipv4InCidr(value, network as string, prefix as number));
  }

  private ipv4InCidr(value: number, network: string, prefix: number): boolean {
    const networkValue = network
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .reduce((result, part) => ((result << 8) | part) >>> 0, 0);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) === (networkValue & mask);
  }

  private isPublicIpv6(address: string): boolean {
    const normalized = address.toLowerCase().split("%")[0] ?? "";
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped?.[1]) return this.isPublicIpv4(mapped[1]);
    const groups = this.expandIpv6(normalized);
    if (!groups) return false;
    const first = groups[0]!;
    const second = groups[1]!;
    if ((first & 0xe000) !== 0x2000) return false;
    if (first === 0x2001) {
      if (second === 0x0000 || second === 0x0002 || second === 0x000d || second === 0x0010) {
        return false;
      }
      if (second === 0x0db8) return false;
    }
    if (first === 0x2002) return false;
    return true;
  }

  private expandIpv6(address: string): number[] | null {
    if (!address || address.split("::").length > 2) return null;
    const [left = "", right = ""] = address.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    if (!address.includes("::") && leftGroups.length !== 8) return null;
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 0 || (address.includes("::") && missing < 1)) return null;
    const groups = [...leftGroups, ...Array.from({ length: missing }, () => "0"), ...rightGroups];
    if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) {
      return null;
    }
    return groups.map((group) => Number.parseInt(group, 16));
  }

  private isLocalHostname(hostname: string): boolean {
    return (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".svc") ||
      hostname.endsWith(".svc.cluster.local") ||
      !hostname.includes(".")
    );
  }

  private normalizeHostname(hostname: string): string {
    const normalized = hostname.toLowerCase().replace(/\.$/, "");
    return normalized.startsWith("[") && normalized.endsWith("]")
      ? normalized.slice(1, -1)
      : normalized;
  }

  private reject(reason: string): never {
    throw new ProviderDestinationRejectedError(reason);
  }
}
