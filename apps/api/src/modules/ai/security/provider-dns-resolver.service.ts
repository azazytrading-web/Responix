import { Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";

export interface ProviderDnsRecord {
  address: string;
  family: 4 | 6;
}

@Injectable()
export class ProviderDnsResolver {
  async resolve(hostname: string): Promise<ProviderDnsRecord[]> {
    const records = await lookup(hostname, {
      all: true,
      verbatim: true
    });
    return records.map((record) => ({
      address: record.address,
      family: record.family as 4 | 6
    }));
  }
}
