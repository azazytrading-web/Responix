import type { AiCostContract, AiUsageContract } from "../contracts";

export interface RuntimeLimits {
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  dailyCostLimit: string;
  monthlyCostLimit: string;
  maxConcurrentInvocations: number;
  maxQueueDepth: number;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface RuntimeEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
}

export interface RuntimeReservation {
  id: string;
  workspaceId: string;
  requestId: string;
  ownerToken: string;
  status: "ACTIVE";
  estimate: RuntimeEstimate;
  queuedAt: Date;
  activatedAt: Date;
  leaseExpiresAt: Date;
  queueWaitMs: number;
  reservedAt: number;
}

export interface RuntimeSuccessAccounting {
  reservation: RuntimeReservation;
  invocationId: string;
  providerId: string;
  modelId: string;
  usage: AiUsageContract;
  cost: AiCostContract;
  retryCount: number;
  executionDurationMs: number;
  providerDurationMs: number;
}

export interface RuntimeFailureAccounting {
  reservation: RuntimeReservation;
  invocationId?: string;
  providerId?: string;
  modelId?: string;
  retryCount: number;
  executionDurationMs: number;
  providerDurationMs: number;
  failureReason: string;
  timeoutReason?: string;
  cancelled: boolean;
}
