import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RuntimeProtectionRepository } from "./runtime-protection.repository";
import type { RuntimeLimits } from "./runtime.types";

@Injectable()
export class QuotaService {
  constructor(
    private readonly repository: RuntimeProtectionRepository,
    private readonly config: ConfigService
  ) {}

  async limitsFor(workspaceId: string): Promise<RuntimeLimits> {
    const override = await this.repository.findWorkspaceLimits(workspaceId);
    return {
      dailyRequestLimit:
        override?.dailyRequestLimit ??
        this.config.getOrThrow<number>("ai.runtime.dailyRequestLimit"),
      monthlyRequestLimit:
        override?.monthlyRequestLimit ??
        this.config.getOrThrow<number>("ai.runtime.monthlyRequestLimit"),
      dailyTokenLimit:
        override?.dailyTokenLimit ??
        this.config.getOrThrow<number>("ai.runtime.dailyTokenLimit"),
      monthlyTokenLimit:
        override?.monthlyTokenLimit ??
        this.config.getOrThrow<number>("ai.runtime.monthlyTokenLimit"),
      dailyCostLimit:
        override?.dailyCostLimit ??
        this.config.getOrThrow<string>("ai.runtime.dailyCostLimit"),
      monthlyCostLimit:
        override?.monthlyCostLimit ??
        this.config.getOrThrow<string>("ai.runtime.monthlyCostLimit"),
      maxConcurrentInvocations:
        override?.maxConcurrentInvocations ??
        this.config.getOrThrow<number>("ai.runtime.maxConcurrentInvocations"),
      maxQueueDepth:
        override?.maxQueueDepth ??
        this.config.getOrThrow<number>("ai.runtime.maxQueueDepth"),
      maxContextTokens:
        override?.maxContextTokens ??
        this.config.getOrThrow<number>("ai.runtime.maxContextTokens"),
      maxOutputTokens:
        override?.maxOutputTokens ??
        this.config.getOrThrow<number>("ai.runtime.maxOutputTokens")
    };
  }
}
