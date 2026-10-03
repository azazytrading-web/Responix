import type { OicIntelligenceProfilePolicy } from "@oic/contracts";
import type { Prisma } from "@oic/database";
import { z } from "zod";

export const policyInputSchema = z.object({
  contextIntensity: z.number().int().min(0).max(100), memoryIntensity: z.number().int().min(0).max(100), retrievalIntensity: z.number().int().min(0).max(100), reasoningIntensity: z.number().int().min(0).max(100),
  toolsIntensity: z.number().int().min(0).max(100), verificationIntensity: z.number().int().min(0).max(100), synthesisIntensity: z.number().int().min(0).max(100), efficiencyIntensity: z.number().int().min(0).max(100),
  maxStages: z.number().int().min(1).max(32), maxProviderCalls: z.number().int().min(1).max(16), maxToolCalls: z.number().int().min(0).max(16), maxRetrievalQueries: z.number().int().min(0).max(16), maxMemoryItems: z.number().int().min(0).max(64), maxCandidates: z.number().int().min(1).max(4), maxVerificationRounds: z.number().int().min(0).max(3), maxContextTokens: z.number().int().min(256).max(200000), maxExecutionMs: z.number().int().min(1000).max(120000),
  allowMemoryWrites: z.boolean(), allowRevision: z.boolean(), requireEvidence: z.boolean()
}).strict();
export type ProfilePolicyInput = z.infer<typeof policyInputSchema>;

export const FAST_POLICY: ProfilePolicyInput = {
  contextIntensity: 20, memoryIntensity: 10, retrievalIntensity: 10, reasoningIntensity: 15, toolsIntensity: 0, verificationIntensity: 10, synthesisIntensity: 20, efficiencyIntensity: 90,
  maxStages: 4, maxProviderCalls: 1, maxToolCalls: 0, maxRetrievalQueries: 1, maxMemoryItems: 2, maxCandidates: 1, maxVerificationRounds: 0, maxContextTokens: 4096, maxExecutionMs: 30_000, allowMemoryWrites: false, allowRevision: false, requireEvidence: false
};

type ProfileRevision = Prisma.OicIntelligenceProfileRevisionGetPayload<{ include: { profile: true } }>;
export function policyFromRevision(revision: ProfileRevision): OicIntelligenceProfilePolicy {
  return {
    id: revision.id, profileId: revision.profileId, profileKey: revision.profile?.profileKey ?? "unknown", displayName: revision.profile?.displayName ?? "Intelligence Profile", revision: revision.revision,
    contextIntensity: revision.contextIntensity, memoryIntensity: revision.memoryIntensity, retrievalIntensity: revision.retrievalIntensity, reasoningIntensity: revision.reasoningIntensity, toolsIntensity: revision.toolsIntensity, verificationIntensity: revision.verificationIntensity, synthesisIntensity: revision.synthesisIntensity, efficiencyIntensity: revision.efficiencyIntensity,
    maxStages: revision.maxStages, maxProviderCalls: revision.maxProviderCalls, maxToolCalls: revision.maxToolCalls, maxRetrievalQueries: revision.maxRetrievalQueries, maxMemoryItems: revision.maxMemoryItems, maxCandidates: revision.maxCandidates, maxVerificationRounds: revision.maxVerificationRounds, maxContextTokens: revision.maxContextTokens, maxExecutionMs: revision.maxExecutionMs,
    allowMemoryWrites: revision.allowMemoryWrites, allowRevision: revision.allowRevision, requireEvidence: revision.requireEvidence
  };
}
