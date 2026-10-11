import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OicRawUsageEvidence, OicRuntimeContext } from "@oic/contracts";
import { OicDatabaseService } from "@oic/database";

const USAGE_FIELDS = ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "internalComputeUnits", "retrievalUnits", "toolUnits"] as const;
const RAW_USAGE_FIELDS = ["prompt_tokens", "completion_tokens", "prompt_tokens_details.cached_tokens", "completion_tokens_details.reasoning_tokens", "input_tokens", "output_tokens", "input_tokens_details.cached_tokens", "output_tokens_details.reasoning_tokens"] as const;
type UsageField = typeof USAGE_FIELDS[number];
type SafeUsage = Partial<Record<UsageField, number>>;

function safeDimensions(value: Record<string, unknown>): SafeUsage {
  const dimensions: SafeUsage = {};
  for (const field of USAGE_FIELDS) {
    const amount = value[field];
    if (typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0) dimensions[field] = amount;
  }
  return dimensions;
}

function safeRawDimensions(value: Record<string, unknown>): Record<string, number> {
  const dimensions: Record<string, number> = {};
  for (const field of RAW_USAGE_FIELDS) {
    const amount = value[field];
    if (typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0) dimensions[field] = amount;
  }
  return dimensions;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

@Injectable()
export class UsageEvidenceService {
  constructor(private readonly db: OicDatabaseService) {}

  async beginAttempt(context: OicRuntimeContext, source: {
    connectionId: string; bindingId: string; providerKey: string;
    upstreamModelId: string; transportProfile: string;
  }): Promise<string> {
    const row = await this.db.oicProviderAttempt.create({ data: {
      applicationId: context.applicationId,
      tenantId: context.tenantId,
      principalId: context.principalId,
      connectionId: source.connectionId,
      bindingId: source.bindingId,
      traceId: context.traceId,
      requestId: context.requestId,
      attemptKey: randomUUID(),
      providerKey: source.providerKey,
      upstreamModelId: source.upstreamModelId,
      transportProfile: source.transportProfile,
      status: "DISPATCHED",
      usageStatus: "UNKNOWN"
    }, select: { id: true } });
    return row.id;
  }

  async recordReceipt(attemptId: string, receiptSequence: number, source: {
    applicationId: string; tenantId: string | null; providerKey: string;
    transportProfile: string; rawDimensions: Record<string, unknown>;
    normalizedDimensions: OicRawUsageEvidence;
  }): Promise<void> {
    const raw = safeRawDimensions(source.rawDimensions);
    const normalized = safeDimensions(source.normalizedDimensions);
    if (!Object.keys(normalized).length) return;
    if (!Number.isSafeInteger(receiptSequence) || receiptSequence < 0) throw new Error("Invalid provider usage receipt sequence");
    const sourceDigest = digest({ providerKey: source.providerKey, transportProfile: source.transportProfile, raw, normalized });
    await this.db.$transaction(async (tx) => {
      const attempt = await tx.oicProviderAttempt.findFirst({
        where: { id: attemptId, applicationId: source.applicationId, tenantId: source.tenantId },
        select: { id: true }
      });
      if (!attempt) throw new Error("Usage receipt scope does not match its provider attempt");
      const existing = await tx.oicUsageEvent.findUnique({
        where: { providerAttemptId_receiptSequence: { providerAttemptId: attemptId, receiptSequence } },
        select: { sourceDigest: true }
      });
      if (existing) {
        if (existing.sourceDigest !== sourceDigest) throw new Error("Provider usage receipt digest conflict");
        return;
      }
      const required = ["inputTokens", "outputTokens"] as const;
      const usageStatus = required.every((field) => normalized[field] !== undefined) ? "REPORTED" : "PARTIAL";
      await tx.oicUsageEvent.create({ data: {
        applicationId: source.applicationId,
        tenantId: source.tenantId,
        providerAttemptId: attemptId,
        receiptSequence,
        sourceDigest,
        providerKey: source.providerKey,
        transportProfile: source.transportProfile,
        rawDimensions: raw,
        normalizedDimensions: normalized,
        occurredAt: null
      } });
      await tx.oicProviderAttempt.update({ where: { id: attemptId }, data: { usageStatus, sourceDigest } });
    });
  }

  async finishAttempt(attemptId: string, status: "SUCCEEDED" | "FAILED" | "UNCERTAIN", safeErrorCode?: string): Promise<void> {
    await this.db.oicProviderAttempt.update({ where: { id: attemptId }, data: {
      status,
      completedAt: new Date(),
      ...(safeErrorCode && /^[A-Z0-9_]{1,64}$/.test(safeErrorCode) ? { safeErrorCode } : {})
    } });
  }
}
