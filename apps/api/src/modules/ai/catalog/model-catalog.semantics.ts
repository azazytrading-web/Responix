import { BadRequestException } from "@nestjs/common";
import type { ModelCapabilityKey, ModelCapabilityState, ModelEvidenceSource } from "@prisma/client";
import type { ModelPriceInputDto } from "./model-catalog.dto";

export type CapabilityEvidence = { key: ModelCapabilityKey; state: ModelCapabilityState; source: ModelEvidenceSource; observedAt: Date };
export function effectiveCapability(key: ModelCapabilityKey, evidence: readonly CapabilityEvidence[]): ModelCapabilityState {
  // Historical MCP metadata never creates an execution capability in MOD-2.
  if (key === "MCP") return "UNKNOWN";
  const values = evidence.filter(value => value.key === key);
  const workspace = values.find(value => value.source === "WORKSPACE_DECLARED");
  if (workspace?.state === "UNSUPPORTED") return "UNSUPPORTED";
  const trusted = values.filter(value => value.source !== "WORKSPACE_DECLARED");
  if (trusted.some(value => value.state === "UNSUPPORTED")) return "UNSUPPORTED";
  if (workspace?.state === "UNKNOWN") return "UNKNOWN";
  return trusted.some(value => value.state === "SUPPORTED") ? "SUPPORTED" : "UNKNOWN";
}
export function validatePrice(price: ModelPriceInputDto | undefined): void {
  if (!price) return;
  if (price.state === "KNOWN" && (price.inputRate === undefined || price.outputRate === undefined)) {
    throw new BadRequestException("Known pricing requires explicit input and output rates");
  }
  if (price.state === "UNKNOWN" && [price.inputRate, price.outputRate, price.cachedInputRate].some(value => value !== undefined)) {
    throw new BadRequestException("Unknown pricing cannot contain rates");
  }
  if (price.effectiveTo && new Date(price.effectiveTo) <= new Date(price.effectiveFrom)) {
    throw new BadRequestException("Pricing effectiveTo must follow effectiveFrom");
  }
}
