import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolvedProviderEndpoint = { url: URL; hostname: string; addresses: Array<{ address: string; family: 4 | 6 }> };
type LookupAll = (hostname: string, options: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;

function inV4Range(address: string, network: number[], prefix: number): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const value = parts.reduce((result, part) => (result << 8n) | BigInt(part), 0n);
  const base = network.reduce((result, part) => (result << 8n) | BigInt(part), 0n);
  const mask = (0xffff_ffffn << BigInt(32 - prefix)) & 0xffff_ffffn;
  return (value & mask) === (base & mask);
}

function ipv6Value(address: string): bigint | null {
  if (address.includes("%")) return null;
  let value = address.toLowerCase();
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4 = value.slice(lastColon + 1).split(".").map(Number);
    if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    value = `${value.slice(0, lastColon)}:${((ipv4[0]! << 8) | ipv4[1]!).toString(16)}:${((ipv4[2]! << 8) | ipv4[3]!).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const zeroes: string[] = [];
  for (let index = 0; index < missing; index += 1) zeroes.push("0");
  const groups: string[] = [...left, ...zeroes, ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[a-f0-9]{1,4}$/.test(part))) return null;
  return groups.reduce((result, part) => (result << 16n) | BigInt(`0x${part}`), 0n);
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const blocked: Array<[number[], number]> = [
      [[0, 0, 0, 0], 8], [[10, 0, 0, 0], 8], [[100, 64, 0, 0], 10], [[127, 0, 0, 0], 8],
      [[169, 254, 0, 0], 16], [[172, 16, 0, 0], 12], [[192, 0, 0, 0], 24], [[192, 0, 2, 0], 24],
      [[192, 88, 99, 0], 24], [[192, 168, 0, 0], 16], [[198, 18, 0, 0], 15], [[198, 51, 100, 0], 24],
      [[203, 0, 113, 0], 24], [[224, 0, 0, 0], 4], [[240, 0, 0, 0], 4]
    ];
    return !blocked.some(([network, prefix]) => inV4Range(address, network, prefix));
  }
  if (family !== 6) return false;
  const value = ipv6Value(address);
  if (value === null) return false;
  const inRange = (network: bigint, prefix: number) => (value >> BigInt(128 - prefix)) === (network >> BigInt(128 - prefix));
  return inRange(0x2000_0000_0000_0000_0000_0000_0000_0000n, 3) &&
    !inRange(0x2001_0000_0000_0000_0000_0000_0000_0000n, 23) &&
    !inRange(0x2001_0db8_0000_0000_0000_0000_0000_0000n, 32) &&
    !inRange(0x2002_0000_0000_0000_0000_0000_0000_0000n, 16);
}

export async function resolvePublicHttpsEndpoint(input: string, lookup: LookupAll = dnsLookup): Promise<ResolvedProviderEndpoint> {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Provider endpoint is invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.hostname || url.port === "0") {
    throw new Error("Provider endpoint must be a bounded HTTPS URL without credentials, query, or fragment");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Provider endpoint host is not allowed");
  }
  let answers: Array<{ address: string; family: number }>;
  if (isIP(hostname)) answers = [{ address: hostname, family: isIP(hostname) }];
  else {
    try { answers = await lookup(hostname, { all: true, verbatim: true }); }
    catch { throw new Error("Provider endpoint could not be resolved"); }
  }
  if (answers.length === 0 || answers.some((answer) => !isPublicAddress(answer.address))) throw new Error("Provider endpoint must resolve only to public addresses");
  const addresses = answers.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
  return { url, hostname, addresses };
}
