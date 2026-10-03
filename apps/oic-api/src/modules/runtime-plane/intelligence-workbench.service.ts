import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import type { OicModelResolver, OicResolvedModel, OicRuntimeContext, OicRuntimeExecutor, OicRuntimePolicy, OicRuntimeRequest } from "@oic/contracts";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { RuntimeContextResolver } from "./runtime-context";
import { OIC_MODEL_RESOLVER } from "./model-resolver";
import { OIC_RUNTIME_EXECUTOR } from "./runtime-executor";
import { OIC_RUNTIME_POLICY } from "./runtime-policy";
import { OicRuntimeException } from "./runtime-errors";
import { FAST_POLICY, policyFromRevision } from "../intelligence/engines/profile-policy";

@Injectable()
export class IntelligenceWorkbenchService {
  constructor(private readonly db: OicDatabaseService, private readonly contexts: RuntimeContextResolver, @Inject(OIC_MODEL_RESOLVER) private readonly resolver: OicModelResolver, @Inject(OIC_RUNTIME_EXECUTOR) private readonly executor: OicRuntimeExecutor, @Inject(OIC_RUNTIME_POLICY) private readonly runtimePolicy: OicRuntimePolicy) {}

  async run(actor: AuthenticatedPrincipal, input: { model: string; profileRevisionId: string; prompt: string; tenant?: OicRuntimeRequest["tenant"]; sessionId?: string; maxOutputUnits?: number }) {
    if (!actor.scopes.includes("oic:runtime:invoke")) throw new OicRuntimeException("AUTHORIZATION_DENIED");
    const request: OicRuntimeRequest = { model: input.model as OicRuntimeRequest["model"], input: [{ speaker: "user", content: [{ type: "text", text: input.prompt }] }], ...(input.tenant ? { tenant: input.tenant } : {}), ...(input.sessionId ? { sessionId: input.sessionId } : {}), ...(input.maxOutputUnits ? { maxOutputUnits: input.maxOutputUnits } : {}) };
    const context = await this.contexts.resolve(actor, request, {});
    const decision = await this.runtimePolicy.evaluate(request, context);
    if (!decision.allowed) throw new OicRuntimeException("AUTHORIZATION_DENIED");
    const base = await this.resolver.resolve(request.model, context);
    if (!base || !base.capabilities.includes("text.generate")) throw new OicRuntimeException("MODEL_NOT_AVAILABLE");
    const configuredRevision = await this.db.oicIntelligenceProfileRevision.findUnique({ where: { id: input.profileRevisionId }, include: { profile: true } });
    if (!configuredRevision || configuredRevision.profile.lifecycle !== "ACTIVE") throw new NotFoundException();
    const profile = policyFromRevision(configuredRevision);
    const baselinePolicy = { ...FAST_POLICY, id: "builtin-fast-unassigned", profileId: "workbench-baseline", profileKey: "BASELINE", displayName: "Engineering baseline", revision: 1, contextIntensity: 10, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 0, toolsIntensity: 0, verificationIntensity: 0, synthesisIntensity: 0, efficiencyIntensity: 100, maxStages: 8, maxProviderCalls: 1, maxToolCalls: 0, maxRetrievalQueries: 0, maxMemoryItems: 0, maxCandidates: 1, maxVerificationRounds: 0, allowMemoryWrites: false, allowRevision: false, requireEvidence: false };
    const makeContext = () => ({ ...context, requestId: randomUUID(), traceId: randomUUID() });
    const execute = async (executionModel: OicResolvedModel, runContext: OicRuntimeContext) => {
      const timer = AbortSignal.timeout(Math.min(executionModel.intelligenceProfile?.maxExecutionMs ?? 30_000, decision.maxExecutionMs));
      const started = Date.now();
      const result = await this.executor.execute(executionModel, request, runContext, timer);
      const execution = await this.db.oicIntelligenceExecution.findUnique({ where: { traceId: runContext.traceId }, select: { strategy: true, taskType: true, modelRevisionId: true, profileRevisionId: true, uncertainty: true, stageCount: true, providerCallCount: true, inputTokens: true, outputTokens: true, retrievalQueryCount: true, memoryLookupCount: true, contextTokens: true, verificationStatus: true, summary: true, stages: { orderBy: { stageIndex: "asc" }, select: { stageIndex: true, stageType: true, status: true, strategy: true, durationMs: true, resourceUse: true, metadata: true } } } });
      return { outputText: result.outputText, usage: result.usage ?? null, finishReason: result.finishReason, durationMs: Date.now() - started, requestId: runContext.requestId, traceId: runContext.traceId, execution };
    };
    const baselineModel = { ...base, intelligenceProfile: baselinePolicy };
    const profileModel = { ...base, intelligenceProfile: profile };
    try {
      const baseline = await execute(baselineModel, makeContext());
      const augmented = await execute(profileModel, makeContext());
      return { model: { id: base.id, revisionId: base.revisionId ?? null, capabilities: base.capabilities }, requestedProfile: { id: profile.id, profileId: profile.profileId, profileKey: profile.profileKey, revision: profile.revision }, baseline, augmented };
    } catch (error) {
      if (error instanceof OicRuntimeException) throw error;
      throw new ConflictException("Workbench execution failed");
    }
  }
}
