import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { OicRuntimeRequest } from "@oic/contracts";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { hasOicConsoleManage, hasOicConsoleRead } from "../identity/foundation-policy";
import { OicRuntimeService } from "../runtime-plane/runtime.service";
import { EvaluationArtifactVault } from "./artifact-vault";
import { OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST, OBJECTIVE_ORACLE_METHOD } from "./objective-oracle";
import { derivePacket76DnaEvidence, deriveRegradeDnaEvidence, historicalHardBudgetSupportsReplay, isNextOperationalBudgetBridgeRevision, packet76AdmissionBudgetIsAuthorized, packet76ComparisonEligibility, packet76PreDispatchHistorySafe, packet76RunEligibility, resolvePacket76ProviderDispatchLink, validateExactBytesRawOutputBridge, validateOperationalBudgetRebaseline, validatePacket76Cohort, validatePredispatchCohort, validatePredispatchDecisionGate } from "./basis-bridge";
import { EvaluationSandboxAdapter, SandboxUnavailableError } from "./sandbox-adapter";
import { EvaluationSealedOracle } from "./sealed-oracle";
import { EvaluationWorkQueue } from "./evaluation-work-queue";
import { accountingEvidence, buildRunAnalysis, type AnalysisMeasurement, type ExpectedMetric } from "./run-analysis";
import { compareProtocols } from "./statistics";
import { estimatePairedMetric } from "./run-analysis";
import { computeBudgetLedgerAggregate } from "./evaluation-budget-reconciliation";
import { PACKET76_SUCCESSOR_SCOPE, packet76SafeSuccessorPreDispatchFailure, packet76SuccessorAccountingRunEligible } from "./packet76-successor";

const targetClasses = new Set(["BASE_MODEL", "MODEL_BINDING", "MODEL_WITH_PROFILE", "MODEL_WITH_OIC_RUNTIME", "STATIC_LOCAL_FIXTURE", "AGENT_SYSTEM", "TOOL_ENABLED_SYSTEM", "RETRIEVAL_AUGMENTED_SYSTEM"]);
const domains = new Set(["reasoning", "mathematics", "coding", "agentic_coding", "software_engineering", "terminal_computer", "data_analysis", "tool_function", "retrieval_RAG", "memory", "knowledge", "language_multilingual", "Arabic", "customer_service", "sales", "negotiation", "safety_reliability", "efficiency", "instruction_adherence"]);
const digestPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PACKET76_APPROVED_SCOPE = Object.freeze({
  applicationId: "7f25c69e-bdbb-4949-ad7b-ef6412119850",
  campaignId: "dd3e39bd-0551-4735-916e-9eec82893ffc",
  runId: "72959ad6-8a2a-42da-abd1-0b671c5d05a9",
  baseBudgetRevisionId: "2512e350-73d9-4ecd-aa5b-945aa87e613e",
  cohortKey: "packet76-cohort-20261016-v1",
  authorizationId: "OIC7_PACKET76_SUPPLEMENTAL_CAPACITY_V1",
  recoveryAuthorizationId: "OIC7_PACKET76_RECOVERY_GENERATION_V1",
  executionRecoveryAuthorizationId: "OIC7_PACKET76_EXECUTION_RECOVERY_GENERATION_V2",
  thirdExecutionRecoveryAuthorizationId: "OIC7_PACKET76_EXECUTION_RECOVERY_GENERATION_V3"
});
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function asInputJson(value: unknown): Prisma.InputJsonValue {
  const encoded: unknown = JSON.parse(JSON.stringify(value));
  return encoded as Prisma.InputJsonValue;
}

function safeSourceReference(value: unknown, maxLength = 512): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) return null;
  const sourceRef = value.trim();
  if (/^https?:\/\//i.test(sourceRef)) {
    try {
      const source = new URL(sourceRef);
      if (source.username || source.password) return null;
      return `${source.protocol}//${source.host}${source.pathname}`.slice(0, 512);
    } catch { return null; }
  }
  return sourceRef.split(/[?#]/, 1)[0]?.slice(0, 512) || null;
}

function positiveOiu(value: unknown): Prisma.Decimal {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,18})?$/.test(value)) throw new BadRequestException("A bounded decimal OIU budget is required");
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || !amount.gt(0)) throw new BadRequestException("A positive OIU budget is required");
  return amount;
}

export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  const encode = (item: unknown): string => {
    if (item === null || typeof item === "boolean" || typeof item === "string") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== "object" || item === null || seen.has(item)) throw new BadRequestException("Protocol contains a non-JSON value or cycle");
    seen.add(item);
    try {
      if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new BadRequestException("Protocol must use plain JSON objects");
      const entries = Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
      return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${encode(nested)}`).join(",")}}`;
    } finally { seen.delete(item); }
  };
  return encode(value);
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
}

function deterministicUuid(value: string): string {
  const bytes = Buffer.from(createHash("sha1").update("oic-evaluation-registry-v1:").update(value).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const NORMALIZED_IMPORT_FORMAT = "OIC_NORMALIZED_BENCHMARK_JSON_V1";
const NORMALIZED_IMPORT_ADAPTER = "oic.normalized-benchmark-json";
const NORMALIZED_IMPORT_ADAPTER_REVISION = 1;
const NORMALIZED_IMPORT_TRANSFORM_DIGEST = sha256({
  adapter: NORMALIZED_IMPORT_ADAPTER,
  revision: NORMALIZED_IMPORT_ADAPTER_REVISION,
  mapping: "validate-canonical-pack-object-and-preserve-ordered-case-manifest-v1"
});

function scopedWhere(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
  const consoleReader = hasOicConsoleRead(actor.scopes);
  if (!consoleReader && applicationId && applicationId !== actor.applicationId) return null;
  if (!consoleReader && tenantId && !actor.tenantIds.includes(tenantId)) return null;
  return {
    applicationId: consoleReader ? applicationId : actor.applicationId,
    ...(tenantId ? { tenantId } : !consoleReader ? { OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] } : {})
  };
}

function canManage(actor: AuthenticatedPrincipal): boolean {
  return actor.scopes.includes("oic:foundation:admin") || actor.scopes.includes("oic:evaluation:manage");
}

function assertManage(actor: AuthenticatedPrincipal): void {
  if (!canManage(actor)) throw new NotFoundException();
}

export function canProvisionPacket76CapacityExtension(scopes: readonly string[]): boolean {
  const consoleManager = hasOicConsoleManage(scopes);
  return (scopes.includes("oic:evaluation:manage") || scopes.includes("oic:foundation:admin") || consoleManager)
    && (scopes.includes("oic:admission:manage") || consoleManager);
}

export function assertSafeArtifact(value: unknown, protectedTier: boolean): void {
  const artifact = object(value);
  const referenceKey = protectedTier ? "encryptedArtifactId" : "artifactId";
  if (typeof artifact[referenceKey] !== "string" || !uuidPattern.test(artifact[referenceKey]) || typeof artifact.digest !== "string" || !digestPattern.test(artifact.digest)) throw new BadRequestException("Artifact reference and digest are required");
  if (Object.keys(artifact).some((key) => key !== referenceKey && key !== "digest")) throw new BadRequestException("Artifact content and metadata cannot be stored in registry records");
}

export function assertNoProtocolIdentityOverride(payload: Record<string, unknown>): void {
  const reserved = new Set(["protocolVersion", "targetClass", "applicationId", "tenantId", "releaseId", "releaseDigest", "caseSchedule", "targetIdentity", "targetFingerprint", "sandboxEnvironment"]);
  if (Object.keys(payload).some((key) => reserved.has(key))) throw new BadRequestException("Protocol identity fields are assigned by OIC");
}

@Injectable()
export class EvaluationService {
  constructor(
    private readonly db: OicDatabaseService,
    private readonly artifacts: EvaluationArtifactVault,
    @Optional() private readonly runtime?: OicRuntimeService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly sandbox?: EvaluationSandboxAdapter,
    @Optional() private readonly sealedOracle?: EvaluationSealedOracle,
    @Optional() private readonly workQueue?: EvaluationWorkQueue
  ) {}

  private async resolvePinnedRuntimeTarget(applicationId: string, tenantId: string | null, modelId: string, runtimePrincipalId: string, maxOutputUnits: number, requestId: string) {
    if (!this.runtime || !/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(modelId) || !uuidPattern.test(runtimePrincipalId)) throw new ConflictException("TARGET_RESOLVER_UNAVAILABLE");
    const principal = await this.db.oicServicePrincipal.findFirst({
      where: { id: runtimePrincipalId, applicationId, status: "ACTIVE" },
      include: { scopes: { where: { revokedAt: null }, select: { scope: true } }, tenantGrants: { where: { revokedAt: null }, include: { tenant: { select: { status: true } } } } }
    });
    if (!principal || principal.scopes.length !== 1 || principal.scopes[0]?.scope !== "oic:runtime:invoke") throw new ConflictException("RUNTIME_PRINCIPAL_UNAVAILABLE");
    const tenantIds = principal.tenantGrants.filter((grant) => grant.tenant.status === "ACTIVE").map((grant) => grant.tenantId);
    if (tenantId && !tenantIds.includes(tenantId)) throw new ConflictException("RUNTIME_TENANT_GRANT_REQUIRED");
    const runtimeActor: AuthenticatedPrincipal = { id: principal.id, applicationId: principal.applicationId, scopes: ["oic:runtime:invoke"], tenantIds };
    const runtimeRequest: OicRuntimeRequest = {
      model: modelId as OicRuntimeRequest["model"],
      input: [{ speaker: "user", content: [{ type: "text", text: "evaluation target preflight" }] }],
      ...(tenantId ? { tenant: { kind: "id", tenantId } as const } : {}),
      maxOutputUnits
    };
    const resolvedTarget = await this.runtime.describeEvaluationTarget(runtimeActor, runtimeRequest, { requestId });
    if (!resolvedTarget.revisionId || !resolvedTarget.variantId || !resolvedTarget.bindingId || !resolvedTarget.providerConnectionId || !resolvedTarget.providerDefinitionId || !resolvedTarget.providerKey || !resolvedTarget.upstreamModelRef || !resolvedTarget.transportProfile || !resolvedTarget.profileId || resolvedTarget.profileRevision === null) throw new ConflictException("TARGET_RESOLUTION_INCOMPLETE");
    const targetIdentity = { modelId, runtimePrincipalId, resolvedTarget };
    return { targetIdentity, targetFingerprint: sha256(targetIdentity) };
  }

  /** Resolves an evaluation target through the production runtime resolver without admission or provider execution. */
  async preflightTarget(actor: AuthenticatedPrincipal, input: Record<string, unknown>, requestId: string, traceId?: string) {
    assertManage(actor);
    const applicationId = input.applicationId;
    const modelId = input.modelId;
    const runtimePrincipalId = input.runtimePrincipalId;
    const maxOutputUnits = input.maxOutputUnits;
    const expected = object(input.expectedTarget);
    if (typeof applicationId !== "string" || !uuidPattern.test(applicationId) || typeof modelId !== "string" || !/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(modelId) || typeof runtimePrincipalId !== "string" || !uuidPattern.test(runtimePrincipalId) || typeof maxOutputUnits !== "number" || !Number.isInteger(maxOutputUnits) || maxOutputUnits < 1 || maxOutputUnits > 65_536 || Object.keys(input).some((key) => !["applicationId", "modelId", "runtimePrincipalId", "maxOutputUnits", "expectedTarget"].includes(key))) throw new BadRequestException("Invalid evaluation target preflight request");
    if (!this.requireScope(actor, applicationId)) throw new NotFoundException();
    const expectedFields = ["providerKey", "upstreamModelRef", "providerConnectionId", "bindingId", "revisionId", "transportProfile"];
    if (expectedFields.some((key) => typeof expected[key] !== "string" || !expected[key])) throw new BadRequestException("Expected target identity is incomplete");

    const { targetIdentity, targetFingerprint } = await this.resolvePinnedRuntimeTarget(applicationId, null, modelId, runtimePrincipalId, maxOutputUnits, `evaluation-preflight-${requestId}`);
    const resolved = targetIdentity.resolvedTarget;
    const connectionId = resolved.providerConnectionId;
    const upstreamModelRef = resolved.upstreamModelRef;
    if (typeof connectionId !== "string" || typeof upstreamModelRef !== "string") throw new ConflictException("TARGET_RESOLUTION_INCOMPLETE");
    const [connection, upstreamModel] = await Promise.all([
      this.db.oicProviderConnection.findFirst({
        where: { id: connectionId, applicationId, status: "ACTIVE", healthStatus: "HEALTHY", credentials: { some: { status: "ACTIVE" } } },
        select: { id: true, endpointUrl: true, transportProfile: true, status: true, healthStatus: true, lastValidatedAt: true, providerDefinition: { select: { key: true } }, credentials: { where: { status: "ACTIVE" }, take: 1, select: { id: true, version: true, status: true } } }
      }),
      this.db.oicUpstreamModel.findFirst({
        where: { connectionId, upstreamModelId: upstreamModelRef, lifecycle: "ACTIVE" },
        select: { id: true, upstreamModelId: true, providerDefinitionId: true, connectionId: true, lifecycle: true, capabilityEvidence: { where: { capability: "text.generate" }, orderBy: { observedAt: "desc" }, take: 1, select: { capability: true, status: true, source: true, observedAt: true } } }
      })
    ]);
    if (!connection || !upstreamModel || !connection.lastValidatedAt || !connection.credentials.length) throw new ConflictException("TARGET_EXECUTION_INELIGIBLE");
    const activeCredential = connection.credentials[0];
    if (!activeCredential) throw new ConflictException("TARGET_EXECUTION_INELIGIBLE");
    let endpoint: URL;
    try { endpoint = new URL(connection.endpointUrl); } catch { throw new ConflictException("TARGET_ENDPOINT_INVALID"); }
    if (endpoint.protocol !== "https:" || endpoint.hostname !== "api.deepseek.com" || !["", "443"].includes(endpoint.port) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new ConflictException("TARGET_PROVIDER_MISMATCH");
    const capability = upstreamModel.capabilityEvidence[0];
    if (capability?.status !== "SUPPORTED" || upstreamModel.connectionId !== connection.id || upstreamModel.providerDefinitionId !== resolved.providerDefinitionId) throw new ConflictException("TARGET_CAPABILITY_UNVERIFIED");

    const actual = {
      providerKey: resolved.providerKey,
      upstreamModelRef,
      providerConnectionId: connection.id,
      bindingId: resolved.bindingId,
      revisionId: resolved.revisionId,
      transportProfile: connection.transportProfile
    };
    if (Object.entries(expected).some(([key, value]) => !expectedFields.includes(key) || actual[key as keyof typeof actual] !== value) || Object.keys(expected).length !== expectedFields.length) throw new ConflictException("TARGET_EXPECTATION_MISMATCH");
    if (connection.transportProfile !== resolved.transportProfile) throw new ConflictException("TARGET_TRANSPORT_MISMATCH");

    const evidence = {
      status: "PASS" as const,
      dispatchOccurred: false,
      paidRequestCreated: false,
      checkedAt: new Date().toISOString(),
      applicationId,
      runtimePrincipalId,
      runtimeScope: "oic:runtime:invoke",
      modelId,
      targetFingerprint,
      provider: "DeepSeek",
      providerDefinitionKey: connection.providerDefinition.key,
      providerConnectionId: connection.id,
      connectionStatus: connection.status,
      healthStatus: connection.healthStatus,
      lastValidatedAt: connection.lastValidatedAt.toISOString(),
      credentialStatus: activeCredential.status,
      credentialVersion: activeCredential.version,
      upstreamModelRef,
      upstreamLifecycle: upstreamModel.lifecycle,
      bindingId: resolved.bindingId,
      revisionId: resolved.revisionId,
      variantId: resolved.variantId,
      transportProfile: connection.transportProfile,
      capability: { name: "text.generate", status: capability.status, source: capability.source, observedAt: capability.observedAt.toISOString() },
      applicationVisibility: "RESOLVED",
      executionEligibility: "ELIGIBLE"
    };
    await this.db.oicAuditEvent.create({ data: {
      actorPrincipalId: actor.id, applicationId, action: "evaluation.target.preflight", targetType: "runtime-binding", targetId: resolved.bindingId!, requestId, traceId,
      metadata: {
        status: evidence.status, dispatchOccurred: false, paidRequestCreated: false, modelId, runtimePrincipalId,
        runtimeScope: "oic:runtime:invoke", targetFingerprint, provider: "DeepSeek", providerDefinitionKey: connection.providerDefinition.key,
        providerConnectionId: connection.id, connectionStatus: connection.status, healthStatus: connection.healthStatus,
        lastValidatedAt: connection.lastValidatedAt.toISOString(), credentialStatus: activeCredential.status, credentialVersion: activeCredential.version,
        upstreamModelRef, upstreamLifecycle: upstreamModel.lifecycle, bindingId: resolved.bindingId, revisionId: resolved.revisionId,
        variantId: resolved.variantId, transportProfile: connection.transportProfile,
        capability: { name: "text.generate", status: capability.status, source: capability.source },
        applicationVisibility: "RESOLVED", executionEligibility: "ELIGIBLE"
      }
    } });
    return evidence;
  }

  private requireScope(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    if (!actor.scopes.includes("oic:evaluation:read") && !canManage(actor)) throw new NotFoundException();
    const where = scopedWhere(actor, applicationId, tenantId);
    if (!where) throw new NotFoundException();
    if (tenantId && !hasOicConsoleRead(actor.scopes) && !actor.tenantIds.includes(tenantId)) throw new NotFoundException();
    return where;
  }

  async overview(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    const observedAt = new Date();
    const [packs, releases, campaigns, runs, reports, candidates, queuedWorkItems, leasedWorkItems, activeRuns] = await Promise.all([
      this.db.oicEvaluationPackRevision.count({ where: scope }),
      this.db.oicEvaluationRelease.count({ where: scope }),
      this.db.oicEvaluationCampaign.count({ where: scope }),
      this.db.oicEvaluationRun.count({ where: scope }),
      this.db.oicEvaluationReport.count({ where: { run: scope } }),
      this.db.oicEvaluationCandidate.count({ where: scope }),
      this.db.oicEvaluationWorkItem.count({ where: { ...scope, status: "PENDING" } }),
      this.db.oicEvaluationWorkItem.count({ where: { ...scope, status: "LEASED" } }),
      this.db.oicEvaluationRun.count({ where: { ...scope, status: "RUNNING" } })
    ]);
    return {
      packs, releases, campaigns, runs, reports, candidates,
      queue: { queuedWorkItems, leasedWorkItems, activeRuns, observedAt: observedAt.toISOString(), scope: tenantId ? "selected tenant" : "selected application and authorized tenants" },
      qualityScore: null, note: "Counts are registry records; no quality score is inferred from missing evidence."
    };
  }

  async createBasisDraft(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const kind = input.kind;
    const draftKey = input.draftKey;
    const payload = object(input.payload);
    const allowed = kind === "METRIC"
      ? new Set(["metricKey", "revision", "definition", "applicationId", "tenantId"])
      : kind === "PROTOCOL"
        ? new Set(["releaseId", "targetClass", "modelId", "runtimePrincipalId", "protocol", "candidateId", "applicationId", "tenantId"])
        : kind === "BRIDGE"
        ? new Set(["bridgeType", "bridgeKey", "revision", "sourceManifestId", "targetGradingManifestId", "sourceMetricRevisionId", "targetMetricRevisionId", "sourceMethodRevision", "targetMethodRevision"])
          : new Set<string>();
    if (typeof kind !== "string" || !["METRIC", "PROTOCOL", "BRIDGE"].includes(kind) || typeof draftKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(draftKey) || !Object.keys(payload).length || Object.keys(payload).some((key) => !allowed.has(key)) || Object.keys(input).some((key) => !["kind", "draftKey", "payload"].includes(key))) throw new BadRequestException("Evaluation basis draft is invalid");
    const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : actor.applicationId;
    const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;
    if (!uuidPattern.test(applicationId) || (tenantId !== null && !uuidPattern.test(tenantId)) || !this.requireScope(actor, applicationId, tenantId ?? undefined)) throw new NotFoundException();
    const payloadDigest = sha256(payload);
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.oicEvaluationBasisDraft.create({ data: { applicationId, tenantId, kind, draftKey, payload: payload as Prisma.InputJsonValue, payloadDigest, createdByPrincipalId: actor.id } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId, tenantId, action: "evaluation.basis.draft.created", targetType: "evaluation-basis-draft", targetId: row.id, metadata: { kind, draftKey, payloadDigest } } });
        return { id: row.id, kind, draftKey, payloadDigest, status: row.status, createdAt: row.createdAt };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("EVALUATION_BASIS_DRAFT_EXISTS");
      throw error;
    }
  }

  async publishBasisDraft(actor: AuthenticatedPrincipal, draftId: string) {
    assertManage(actor);
    if (!uuidPattern.test(draftId)) throw new BadRequestException("Invalid evaluation basis draft ID");
    const draft = await this.db.oicEvaluationBasisDraft.findFirst({ where: { id: draftId, ...this.requireScope(actor) } });
    if (!draft) throw new NotFoundException();
    if (draft.status !== "DRAFT" || draft.createdByPrincipalId === actor.id || draft.payloadDigest !== sha256(draft.payload)) throw new ConflictException("DISTINCT_PUBLISHER_REQUIRED");
    const payload = object(draft.payload);
    let publishedEntityId: string;
    if (draft.kind === "METRIC") {
      const result = await this.createMetric(actor, { ...payload, basisDraftId: draft.id });
      publishedEntityId = result.id;
    } else if (draft.kind === "PROTOCOL") {
      const result = await this.createManifest(actor, { ...payload, basisDraftId: draft.id });
      publishedEntityId = result.id;
    } else if (draft.kind === "BRIDGE") {
      publishedEntityId = payload.bridgeType === "OPERATIONAL_BUDGET_REBASELINE"
        ? await this.publishOperationalBudgetBridge(actor, draft, payload)
        : await this.publishRawOutputBridge(actor, draft, payload);
    } else {
      throw new ConflictException("EVALUATION_BASIS_DRAFT_KIND_INVALID");
    }
    const current = await this.db.oicEvaluationBasisDraft.findUnique({ where: { id: draft.id }, select: { status: true, publishedByPrincipalId: true, publishedEntityId: true } });
    if (current?.status === "DRAFT") {
      const changed = await this.db.oicEvaluationBasisDraft.updateMany({ where: { id: draft.id, status: "DRAFT", createdByPrincipalId: { not: actor.id } }, data: { status: "PUBLISHED", publishedByPrincipalId: actor.id, publishedEntityId, publishedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException("EVALUATION_BASIS_DRAFT_STATE_CHANGED");
      await this.db.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: draft.applicationId, tenantId: draft.tenantId, action: "evaluation.basis.draft.published", targetType: "evaluation-basis-draft", targetId: draft.id, metadata: { kind: draft.kind, payloadDigest: draft.payloadDigest, publishedEntityId, authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id } } });
    } else if (current?.status !== "PUBLISHED" || current.publishedByPrincipalId !== actor.id || current.publishedEntityId !== publishedEntityId) {
      throw new ConflictException("EVALUATION_BASIS_DRAFT_STATE_CHANGED");
    }
    return { id: draft.id, kind: draft.kind, status: "PUBLISHED", publishedEntityId, authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id };
  }

  private async publishOperationalBudgetBridge(actor: AuthenticatedPrincipal, draft: { id: string; applicationId: string; tenantId: string | null; createdByPrincipalId: string }, payload: Record<string, unknown>) {
    const { bridgeKey, revision, sourceManifestId, targetGradingManifestId, sourceMetricRevisionId, targetMetricRevisionId } = payload;
    if (payload.bridgeType !== "OPERATIONAL_BUDGET_REBASELINE" || typeof bridgeKey !== "string" || !/^packet76-operational-budget-rebaseline-(?:parent|candidate)$/.test(bridgeKey)
      || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || typeof sourceManifestId !== "string" || !uuidPattern.test(sourceManifestId)
      || typeof targetGradingManifestId !== "string" || !uuidPattern.test(targetGradingManifestId)
      || typeof sourceMetricRevisionId !== "string" || !uuidPattern.test(sourceMetricRevisionId)
      || typeof targetMetricRevisionId !== "string" || targetMetricRevisionId !== sourceMetricRevisionId
      || Object.keys(payload).some((key) => !["bridgeType", "bridgeKey", "revision", "sourceManifestId", "targetGradingManifestId", "sourceMetricRevisionId", "targetMetricRevisionId"].includes(key))) throw new BadRequestException("Operational budget bridge proposal is invalid");
    const latestBridge = await this.db.oicEvaluationBasisBridgeRevision.aggregate({ where: { applicationId: draft.applicationId, tenantId: draft.tenantId, bridgeKey }, _max: { revision: true } });
    if (!isNextOperationalBudgetBridgeRevision(revision, latestBridge._max.revision)) throw new ConflictException("OPERATIONAL_BUDGET_BRIDGE_REVISION_NOT_NEXT");
    const [manifests, metric] = await Promise.all([
      this.db.oicEvaluationProtocolManifest.findMany({ where: { id: { in: [sourceManifestId, targetGradingManifestId] }, applicationId: draft.applicationId, tenantId: draft.tenantId }, include: { release: { select: { id: true, status: true, compromisedAt: true, manifestDigest: true, caseManifest: true } } } }),
      this.db.oicEvaluationMetricRevision.findFirst({ where: { id: sourceMetricRevisionId, applicationId: draft.applicationId, tenantId: draft.tenantId, status: "PUBLISHED" }, select: { id: true, metricKey: true, revision: true, definitionDigest: true } })
    ]);
    const source = manifests.find((item) => item.id === sourceManifestId);
    const target = manifests.find((item) => item.id === targetGradingManifestId);
    if (!source || !target || !metric || source.id === target.id || source.releaseId !== target.releaseId || source.release.status !== "PUBLISHED" || source.release.compromisedAt || target.release.status !== "PUBLISHED" || target.release.compromisedAt
      || source.canonicalDigest !== sha256(source.payload) || target.canonicalDigest !== sha256(target.payload)) throw new ConflictException("OPERATIONAL_BUDGET_BRIDGE_BASIS_UNAVAILABLE");
    const sourceProtocol = object(source.payload);
    const targetProtocol = object(target.payload);
    const metricRefs = (protocol: Record<string, unknown>) => Array.isArray(protocol.metricRevisions) ? protocol.metricRevisions.map((item) => typeof item === "string" ? item : object(item).id) : [];
    if (sourceProtocol.evaluationPurpose !== "TARGET_EXECUTION" || targetProtocol.evaluationPurpose !== "TARGET_EXECUTION"
      || !metricRefs(sourceProtocol).includes(metric.id) || !metricRefs(targetProtocol).includes(metric.id)
      || canonicalJson(sourceProtocol.metricRevisions) !== canonicalJson(targetProtocol.metricRevisions)) throw new ConflictException("OPERATIONAL_BUDGET_BRIDGE_METRIC_OR_PURPOSE_INVALID");
    const budgetIds = [object(sourceProtocol.budgetPolicy).budgetRevisionId, object(targetProtocol.budgetPolicy).budgetRevisionId];
    if (budgetIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))) throw new ConflictException("OPERATIONAL_BUDGET_BRIDGE_POLICY_REFERENCE_INVALID");
    const budgetRows = await this.db.oicBudgetRevision.findMany({ where: { id: { in: budgetIds as string[] }, applicationId: draft.applicationId, tenantId: draft.tenantId }, select: { id: true, applicationId: true, tenantId: true, planRevisionId: true, sourceDigest: true, status: true, unit: true, enforcement: true, amount: true, reservationUpperBound: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true } });
    const toBudget = (id: unknown) => {
      const row = budgetRows.find((item) => item.id === id);
      return row ? { ...row, amount: row.amount.toString(), reservationUpperBound: row.reservationUpperBound?.toString() ?? null } : null;
    };
    const sourceBudget = toBudget(budgetIds[0]);
    const targetBudget = toBudget(budgetIds[1]);
    if (!sourceBudget || !targetBudget) throw new ConflictException("OPERATIONAL_BUDGET_BRIDGE_POLICY_UNAVAILABLE");
    const planIds = [sourceBudget.planRevisionId, targetBudget.planRevisionId].filter((id): id is string => typeof id === "string");
    const planRevisions = await this.db.oicPlanRevision.findMany({ where: { id: { in: planIds } }, include: { plan: { select: { planKey: true, applicationId: true } } } });
    const planContinuity = (id: string | null | undefined) => {
      const plan = planRevisions.find((item) => item.id === id);
      if (!plan) return null;
      const entitlements = object(plan.entitlements);
      return { id: plan.id, planKey: plan.plan.planKey, applicationId: plan.plan.applicationId, status: plan.status, effectiveFrom: plan.effectiveFrom, effectiveTo: plan.effectiveTo, models: Array.isArray(entitlements.models) ? entitlements.models.filter((value): value is string => typeof value === "string").sort() : [], maxOutputUnits: plan.maxOutputUnits, maxConcurrency: plan.maxConcurrency };
    };
    const sourcePlan = planContinuity(sourceBudget.planRevisionId);
    const targetPlan = planContinuity(targetBudget.planRevisionId);
    const modelId = object(object(targetProtocol.targetIdentity).resolvedTarget).modelId;
    const validation = validateOperationalBudgetRebaseline({ sourceManifestId: source.id, sourceDigest: source.canonicalDigest, sourceProtocol, targetManifestId: target.id, targetDigest: target.canonicalDigest, targetProtocol, sourceBudget, targetBudget, admissionPlanContinuity: sourcePlan && targetPlan && typeof modelId === "string" ? { source: sourcePlan, target: targetPlan, modelId } : undefined, now: new Date() });
    const evidence = { ...validation.evidence, applicationId: draft.applicationId, tenantId: draft.tenantId, metric: { id: metric.id, key: metric.metricKey, revision: metric.revision, digest: metric.definitionDigest }, release: { id: source.release.id, digest: source.release.manifestDigest, caseCount: Array.isArray(source.release.caseManifest) ? source.release.caseManifest.length : 0 }, validationReasonCodes: validation.reasonCodes };
    const validationEvidenceDigest = sha256(evidence);
    const recordData = { applicationId: draft.applicationId, tenantId: draft.tenantId, bridgeKey, revision, bridgeType: "OPERATIONAL_BUDGET_REBASELINE", sourceManifestId: source.id, targetGradingManifestId: target.id, sourceMetricRevisionId: metric.id, targetMetricRevisionId: metric.id, sourceMethodRevision: "OPERATIONAL_BUDGET_ONLY_V1", targetMethodRevision: "OPERATIONAL_BUDGET_ONLY_V1", validationEvidence: evidence as Prisma.InputJsonValue, validationEvidenceDigest, bridgeDigest: sha256({ draftId: draft.id, validationEvidenceDigest, status: validation.valid ? "PUBLISHED" : "REJECTED" }), status: validation.valid ? "PUBLISHED" : "REJECTED", authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id };
    const bridge = await this.db.oicEvaluationBasisBridgeRevision.create({ data: recordData });
    await this.db.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: draft.applicationId, tenantId: draft.tenantId, action: validation.valid ? "evaluation.basis.bridge.published" : "evaluation.basis.bridge.rejected", targetType: "evaluation-basis-bridge", targetId: bridge.id, metadata: { bridgeDigest: bridge.bridgeDigest, validationEvidenceDigest, validationReasonCodes: validation.reasonCodes, authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id } } });
    if (!validation.valid) throw new ConflictException("OPERATIONAL_BUDGET_BRIDGE_INVALID");
    return bridge.id;
  }

  async basisDraft(actor: AuthenticatedPrincipal, draftId: string) {
    if (!uuidPattern.test(draftId)) throw new BadRequestException("Invalid evaluation basis draft ID");
    const draft = await this.db.oicEvaluationBasisDraft.findFirst({ where: { id: draftId, ...this.requireScope(actor) }, select: { id: true, applicationId: true, tenantId: true, kind: true, draftKey: true, payloadDigest: true, status: true, createdByPrincipalId: true, publishedByPrincipalId: true, publishedEntityId: true, createdAt: true, publishedAt: true } });
    if (!draft) throw new NotFoundException();
    return { ...draft, authorPublisherDistinct: draft.publishedByPrincipalId === null || draft.publishedByPrincipalId !== draft.createdByPrincipalId };
  }

  private async publishRawOutputBridge(actor: AuthenticatedPrincipal, draft: { id: string; applicationId: string; tenantId: string | null; createdByPrincipalId: string }, payload: Record<string, unknown>) {
    const { bridgeKey, revision, sourceManifestId, targetGradingManifestId, sourceMetricRevisionId, targetMetricRevisionId, sourceMethodRevision, targetMethodRevision } = payload;
    if (typeof bridgeKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(bridgeKey) || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || ![sourceManifestId, targetGradingManifestId, sourceMetricRevisionId, targetMetricRevisionId].every((value) => typeof value === "string" && uuidPattern.test(value)) || (sourceMethodRevision !== undefined && typeof sourceMethodRevision !== "string") || targetMethodRevision !== OBJECTIVE_ORACLE_METHOD) throw new BadRequestException("Raw output bridge proposal is invalid");
    const [manifests, metrics] = await Promise.all([
      this.db.oicEvaluationProtocolManifest.findMany({ where: { id: { in: [sourceManifestId as string, targetGradingManifestId as string] }, applicationId: draft.applicationId, tenantId: draft.tenantId }, include: { release: { select: { id: true, status: true, compromisedAt: true, manifestDigest: true, caseManifest: true } } } }),
      this.db.oicEvaluationMetricRevision.findMany({ where: { id: { in: [sourceMetricRevisionId as string, targetMetricRevisionId as string] }, applicationId: draft.applicationId, tenantId: draft.tenantId, status: "PUBLISHED" }, select: { id: true, metricKey: true, revision: true, definition: true, definitionDigest: true } })
    ]);
    const sourceManifest = manifests.find((item) => item.id === sourceManifestId);
    const targetManifest = manifests.find((item) => item.id === targetGradingManifestId);
    const sourceMetric = metrics.find((item) => item.id === sourceMetricRevisionId);
    const targetMetric = metrics.find((item) => item.id === targetMetricRevisionId);
    if (!sourceManifest || !targetManifest || !sourceMetric || !targetMetric || sourceManifestId === targetGradingManifestId || sourceMetricRevisionId === targetMetricRevisionId) throw new ConflictException("BRIDGE_BASIS_UNAVAILABLE");
    const sourceProtocol = object(sourceManifest.payload);
    const targetProtocol = object(targetManifest.payload);
    const sourceRelease = sourceManifest.release;
    const targetRelease = targetManifest.release;
    if (sourceManifest.releaseId !== targetManifest.releaseId || sourceManifest.applicationId !== targetManifest.applicationId || sourceManifest.tenantId !== targetManifest.tenantId || sourceRelease.status !== "PUBLISHED" || sourceRelease.compromisedAt || targetRelease.status !== "PUBLISHED" || targetRelease.compromisedAt || canonicalJson(sourceProtocol.caseSchedule) !== canonicalJson(targetProtocol.caseSchedule) || canonicalJson(sourceProtocol.environment) !== canonicalJson(targetProtocol.environment) || sourceProtocol.harnessDigest !== targetProtocol.harnessDigest || sourceProtocol.oracleRevision !== targetProtocol.oracleRevision || canonicalJson(sourceProtocol.judgeRevisions) !== canonicalJson(targetProtocol.judgeRevisions) || canonicalJson(sourceProtocol.samplingPolicy) !== canonicalJson(targetProtocol.samplingPolicy) || canonicalJson(sourceProtocol.repetitionPolicy) !== canonicalJson(targetProtocol.repetitionPolicy) || canonicalJson(sourceProtocol.retryPolicy) !== canonicalJson(targetProtocol.retryPolicy) || targetProtocol.evaluationPurpose !== "GRADING_REPLAY") throw new ConflictException("BRIDGE_COHORT_OR_PURPOSE_MISMATCH");
    const idList = (items: unknown) => Array.isArray(items) ? items.map((item) => typeof item === "string" ? item : object(item).id).filter((item): item is string => typeof item === "string") : [];
    if (!idList(sourceProtocol.metricRevisions).includes(sourceMetric.id) || !idList(targetProtocol.metricRevisions).includes(targetMetric.id)) throw new ConflictException("BRIDGE_METRIC_NOT_PINNED");
    const sourceJudgeId = idList(sourceProtocol.judgeRevisions)[0];
    if (!sourceJudgeId || sourceProtocol.oracleRevision !== OBJECTIVE_ORACLE_METHOD || targetProtocol.oracleRevision !== OBJECTIVE_ORACLE_METHOD) throw new ConflictException("BRIDGE_REFERENCE_METHOD_UNPINNED");
    const judge = await this.db.oicEvaluationJudgeRevision.findFirst({ where: { id: sourceJudgeId, applicationId: draft.applicationId, tenantId: draft.tenantId, status: "PUBLISHED", judgeType: "REFERENCE" }, select: { id: true, judgeType: true, definition: true, definitionDigest: true } });
    if (!judge) throw new ConflictException("BRIDGE_REFERENCE_JUDGE_INVALID");
    const judgeDefinition = object(judge.definition);
    const validation = validateExactBytesRawOutputBridge(
      { id: sourceMetric.id, metricKey: sourceMetric.metricKey, revision: sourceMetric.revision, definitionDigest: sourceMetric.definitionDigest, definition: object(sourceMetric.definition) },
      { id: targetMetric.id, metricKey: targetMetric.metricKey, revision: targetMetric.revision, definitionDigest: targetMetric.definitionDigest, definition: object(targetMetric.definition) },
      { judgeId: judge.id, judgeDigest: judge.definitionDigest, judgeType: judge.judgeType, methodRevision: typeof judgeDefinition.methodRevision === "string" ? judgeDefinition.methodRevision : "", abstentionPolicy: typeof judgeDefinition.abstentionPolicy === "string" ? judgeDefinition.abstentionPolicy : "", sourceOracleRevision: typeof sourceProtocol.oracleRevision === "string" ? sourceProtocol.oracleRevision : "", sourceOracleCodeDigest: OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST }
    );
    const evidence = { ...validation.evidence, sourceManifest: { id: sourceManifest.id, digest: sourceManifest.canonicalDigest }, targetGradingManifest: { id: targetManifest.id, digest: targetManifest.canonicalDigest }, cohort: { releaseId: sourceManifest.releaseId, releaseDigest: sourceRelease.manifestDigest, caseScheduleDigest: sha256(sourceProtocol.caseSchedule) }, validationReasonCodes: validation.reasonCodes };
    const validationEvidenceDigest = sha256(evidence);
    if (!validation.valid) {
      await this.db.oicEvaluationBasisBridgeRevision.create({ data: { applicationId: draft.applicationId, tenantId: draft.tenantId, bridgeKey, revision, bridgeType: "RAW_OUTPUT_REGRADE", sourceManifestId: sourceManifest.id, targetGradingManifestId: targetManifest.id, sourceMetricRevisionId: sourceMetric.id, targetMetricRevisionId: targetMetric.id, sourceMethodRevision: typeof sourceMethodRevision === "string" ? sourceMethodRevision : null, targetMethodRevision: targetMethodRevision, validationEvidence: evidence, validationEvidenceDigest, bridgeDigest: sha256({ draftId: draft.id, validationEvidenceDigest }), status: "REJECTED", authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id } });
      await this.db.oicEvaluationBasisDraft.updateMany({ where: { id: draft.id, status: "DRAFT" }, data: { status: "REJECTED", publishedByPrincipalId: actor.id } });
      await this.db.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: draft.applicationId, tenantId: draft.tenantId, action: "evaluation.basis.bridge.rejected", targetType: "evaluation-basis-bridge", targetId: draft.id, metadata: { reasonCodes: validation.reasonCodes, validationEvidenceDigest } } });
      throw new ConflictException("BRIDGE_INVALID");
    }
    const bridgeData = { applicationId: draft.applicationId, tenantId: draft.tenantId, bridgeKey, revision, bridgeType: "RAW_OUTPUT_REGRADE", sourceManifestId: sourceManifest.id, targetGradingManifestId: targetManifest.id, sourceMetricRevisionId: sourceMetric.id, targetMetricRevisionId: targetMetric.id, sourceMethodRevision: typeof sourceMethodRevision === "string" ? sourceMethodRevision : null, targetMethodRevision: targetMethodRevision as string, validationEvidence: evidence as Prisma.InputJsonValue, validationEvidenceDigest, bridgeDigest: sha256({ draftId: draft.id, validationEvidenceDigest, status: "PUBLISHED" }), status: "PUBLISHED", authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id };
    const bridge = await this.db.oicEvaluationBasisBridgeRevision.create({ data: bridgeData });
    await this.db.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: draft.applicationId, tenantId: draft.tenantId, action: "evaluation.basis.bridge.published", targetType: "evaluation-basis-bridge", targetId: bridge.id, metadata: { bridgeDigest: bridge.bridgeDigest, validationEvidenceDigest, authorPrincipalId: draft.createdByPrincipalId, publisherPrincipalId: actor.id } } });
    return bridge.id;
  }

  async reconcilePacket76RunBudgetAggregate(actor: AuthenticatedPrincipal) {
    const runId = PACKET76_APPROVED_SCOPE.runId;
    if (!canManage(actor)) throw new ForbiddenException("EVALUATION_MANAGE_REQUIRED");
    if (actor.applicationId !== PACKET76_APPROVED_SCOPE.applicationId) throw new ForbiddenException("PACKET76_ACCOUNTING_APPLICATION_SCOPE_REQUIRED");
    let operationOrdinal = 0;
    let operation = "TRANSACTION_BEGIN";
    let model = "$transaction";
    const step = (name: string, target: string) => { operation = name; model = target; operationOrdinal += 1; };
    try { return await this.db.$transaction(async (tx) => {
      step("RUN_LOCK", "OicEvaluationRun");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OicEvaluationRun" WHERE "id" = ${runId}::uuid FOR UPDATE`);
      step("RUN_LOOKUP", "OicEvaluationRun");
      const run = await tx.oicEvaluationRun.findFirst({
        where: { id: runId, applicationId: PACKET76_APPROVED_SCOPE.applicationId, campaignId: PACKET76_APPROVED_SCOPE.campaignId, diagnosticOnly: false },
        include: { manifest: { select: { payload: true, release: { select: { status: true, compromisedAt: true } } } } }
      });
      const cohort = object(object(run?.manifest.payload).cohort);
      if (!run) throw new ConflictException("PACKET76_ACCOUNTING_RUN_SCOPE_INVALID");
      if (run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt || cohort.cohortKey !== PACKET76_APPROVED_SCOPE.cohortKey) throw new ConflictException("PACKET76_ACCOUNTING_SCOPE_INVALID");
      step("CAMPAIGN_BASE_REVISION_LOOKUP", "OicEvaluationCampaign");
      const campaign = run.campaignId ? await tx.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { budgetRevisionId: true } }) : null;
      if (!campaign?.budgetRevisionId) throw new ConflictException("PACKET76_ACCOUNTING_CAMPAIGN_SCOPE_INVALID");
      step("ACTIVE_WORK_CHECK", "OicEvaluationWorkItem");
      const activeWork = await tx.oicEvaluationWorkItem.count({ where: { runId, status: { in: ["PENDING", "LEASED"] }, executionMode: { not: "DIAGNOSTIC" } } });
      step("CASE_ATTEMPT_READ", "OicEvaluationCaseExecution/OicEvaluationAttempt");
      const cases = await tx.oicEvaluationCaseExecution.findMany({ where: { runId }, select: { id: true, status: true, attempts: { select: { id: true, status: true, admissionId: true, budgetReconciledAt: true } } } });
      const attempts = cases.flatMap((item) => item.attempts);
      if (!cases.length || !attempts.length || activeWork || cases.some((item) => ["QUEUED", "LEASED", "RUNNING"].includes(item.status))
        || attempts.some((attempt) => !["SUCCEEDED", "INFRA_FAILURE", "BUDGET_BLOCKED"].includes(attempt.status) || !attempt.budgetReconciledAt)) throw new ConflictException("PACKET76_ACCOUNTING_PENDING_WORK");
      const keys = attempts.map((attempt) => `evaluation-attempt:${attempt.id}`);
      const ids = attempts.flatMap((attempt) => attempt.admissionId ? [attempt.admissionId] : []);
      step("TERMINAL_ADMISSION_LEDGER_READ", "OicAdmission/OicAdmissionPosting");
      const admissions = await tx.oicAdmission.findMany({
        where: { applicationId: run.applicationId, tenantId: run.tenantId, OR: [{ id: { in: ids } }, { idempotencyKey: { in: keys } }] },
        include: { legs: { include: { bucket: { select: { unit: true } } } }, postings: { select: { bucketId: true, kind: true, amount: true } } }
      });
      const byId = new Map(admissions.map((admission) => [admission.id, admission]));
      for (const attempt of attempts) if (attempt.admissionId && !byId.has(attempt.admissionId)) throw new ConflictException("PACKET76_ACCOUNTING_ADMISSION_MISSING");
      step("SUPPLEMENT_EXTENSION_LOOKUP", "OicEvaluationCapacityExtension");
      const extensions = await tx.oicEvaluationCapacityExtension.findMany({ where: { applicationId: run.applicationId, tenantId: run.tenantId, runId }, select: { id: true, budgetRevisionId: true } });
      const extensionById = new Map(extensions.map((extension) => [extension.id, extension]));
      for (const admission of admissions) {
        const budgetLeg = admission.legs.find((leg) => leg.bucket.unit === "OIU" && leg.budgetRevisionId !== null);
        if (!budgetLeg) throw new ConflictException("PACKET76_ACCOUNTING_BUDGET_REVISION_INVALID");
        if (admission.capacityExtensionId) {
          const extension = extensionById.get(admission.capacityExtensionId);
          if (!extension || extension.budgetRevisionId !== budgetLeg.budgetRevisionId) throw new ConflictException("PACKET76_ACCOUNTING_SUPPLEMENT_SCOPE_INVALID");
        } else if (budgetLeg.budgetRevisionId !== campaign.budgetRevisionId) {
          throw new ConflictException("PACKET76_ACCOUNTING_BASE_SCOPE_INVALID");
        }
      }
      step("LEDGER_AGGREGATION_AND_VALIDATION", "OicAdmission/OicAdmissionPosting");
      const aggregate = computeBudgetLedgerAggregate(admissions);
      const previous = { reservedOiu: run.budgetReservationOiu?.toString() ?? null, releasedOiu: run.budgetReleasedOiu.toString() };
      step("RECONCILIATION_REVISION_READ", "OicAuditEvent");
      const previousAudits = await tx.oicAuditEvent.findMany({ where: { applicationId: run.applicationId, action: "evaluation.budget.run_aggregate_reconciled", targetType: "evaluation-run", targetId: run.id }, orderBy: { occurredAt: "asc" }, select: { metadata: true } });
      const previousRevision = previousAudits.reduce((revision, event) => Math.max(revision, Number(object(event.metadata).reconciliationRevision) || 0), 0);
      const revision = previousRevision + 1;
      step("RECONCILIATION_AUDIT_INSERT", "OicAuditEvent");
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId,
        action: "evaluation.budget.run_aggregate_reconciled", targetType: "evaluation-run", targetId: run.id,
        metadata: {
          reconciliationRevision: revision,
          reason: "PACKET76_IMMUTABLE_OIC6_ADMISSION_LEDGER_RECOMPUTE",
          previousAggregate: previous,
          recomputedAggregate: { reservedOiu: aggregate.reservedOiu, releasedOiu: aggregate.releasedOiu, consumedOiu: aggregate.consumedOiu },
          ledgerBasisDigest: aggregate.ledgerBasisDigest,
          admissionCount: aggregate.admissionCount,
          funding: aggregate.funding,
          ledger: "OIC6_IMMUTABLE_ADMISSION_POSTINGS"
        }
      } });
      step("RUN_AGGREGATE_PROJECTION_UPDATE", "OicEvaluationRun");
      const update = await tx.oicEvaluationRun.updateMany({ where: { id: run.id, applicationId: run.applicationId, budgetReservationOiu: run.budgetReservationOiu, budgetReleasedOiu: run.budgetReleasedOiu }, data: { budgetReservationOiu: aggregate.reservedOiu, budgetReleasedOiu: aggregate.releasedOiu } });
      if (update.count !== 1) throw new ConflictException("PACKET76_ACCOUNTING_AGGREGATE_CHANGED");
      return { status: "RECONCILED", runId: run.id, reconciliationRevision: revision, previousAggregate: previous, recomputedAggregate: { reservedOiu: aggregate.reservedOiu, releasedOiu: aggregate.releasedOiu, consumedOiu: aggregate.consumedOiu }, ledgerBasisDigest: aggregate.ledgerBasisDigest, admissionCount: aggregate.admissionCount, funding: aggregate.funding };
    }); } catch (error) {
      const errorClass = error instanceof Error ? error.constructor.name : "UnknownError";
      const candidateCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{2,32}$/.test(error.code) ? error.code : null;
      const errorRecord = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
      const meta = typeof errorRecord.meta === "object" && errorRecord.meta !== null ? errorRecord.meta as Record<string, unknown> : {};
      const cause = typeof meta.cause === "object" && meta.cause !== null ? meta.cause as Record<string, unknown> : {};
      const message = [error instanceof Error ? error.message : "", typeof meta.message === "string" ? meta.message : "", typeof meta.cause === "string" ? meta.cause : "", typeof cause.message === "string" ? cause.message : ""].join(" ");
      const sqlState = /Code:\s*([A-Z0-9]{5})/.exec(message)?.[1] ?? (typeof meta.code === "string" && /^[A-Z0-9]{5}$/.test(meta.code) ? meta.code : null);
      const safeConstraint = /constraint[\s"']+([A-Za-z][A-Za-z0-9_]{0,95})["']?/i.exec(message)?.[1] ?? null;
      const safeMessage = sqlState === "23514" ? "database check constraint violation" : sqlState === "23505" ? "database unique constraint violation" : sqlState === "23503" ? "database foreign key violation" : sqlState === "42703" ? "database column missing" : sqlState === "42P01" ? "database relation missing" : /deadlock detected/i.test(message) ? "database deadlock detected" : /serialization failure|could not serialize access/i.test(message) ? "database serialization failure" : /numeric field overflow|value out of range/i.test(message) ? "numeric value out of range" : /invalid input syntax/i.test(message) ? "invalid database input syntax" : /error occurred during query execution/i.test(message) ? "query execution failure" : "unclassified Prisma transaction error";
      const fingerprint = createHash("sha256").update(`${errorClass}|${candidateCode ?? ""}|${operation}|${sqlState ?? ""}|${safeConstraint ?? ""}|${safeMessage}`).digest("hex").slice(0, 24);
      process.stderr.write(`${JSON.stringify({ event: "evaluation.packet76.accounting_transaction_failed", operationOrdinal, operation, model, errorClass, prismaCode: candidateCode, prismaMetaKeys: Object.keys(meta).sort(), prismaMetaModel: typeof meta.modelName === "string" && /^[A-Za-z][A-Za-z0-9]{0,80}$/.test(meta.modelName) ? meta.modelName : null, nestedCauseClass: cause.constructor !== Object && cause.constructor?.name ? cause.constructor.name : null, nestedCauseKeys: Object.keys(cause).sort(), sqlState, safeConstraint, safeMessage, fingerprint })}\n`);
      throw error;
    }
  }

  /** Reconcile the exact successor Candidate from immutable OIC-6 evidence. */
  async reconcilePacket76SuccessorCandidateAccounting(actor: AuthenticatedPrincipal) {
    const scope = PACKET76_SUCCESSOR_SCOPE;
    if (!canManage(actor)) throw new ForbiddenException("EVALUATION_MANAGE_REQUIRED");
    if (actor.applicationId !== scope.applicationId) throw new ForbiddenException("PACKET76_ACCOUNTING_APPLICATION_SCOPE_REQUIRED");
    try {
    return await this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OicEvaluationRun" WHERE "id" = ${scope.runId}::uuid FOR UPDATE`);
      const run = await tx.oicEvaluationRun.findFirst({
        where: { id: scope.runId, applicationId: scope.applicationId, campaignId: scope.campaignId, manifestId: scope.manifestId, diagnosticOnly: false },
        include: { manifest: { select: { canonicalDigest: true, payload: true, release: { select: { status: true, compromisedAt: true } } } }, reports: { select: { id: true } }, cases: { orderBy: { repetitionOrdinal: "asc" }, include: { attempts: { orderBy: { attemptOrdinal: "asc" } } } } }
      });
      const campaign = await tx.oicEvaluationCampaign.findFirst({ where: { id: scope.campaignId, applicationId: scope.applicationId, tenantId: null, status: "ACTIVE", budgetRevisionId: scope.budgetRevisionId }, select: { id: true, reservedOiu: true, budgetLimitOiu: true, reservationPerAttemptOiu: true } });
      const workItems = await tx.oicEvaluationWorkItem.findMany({ where: { runId: scope.runId }, select: { status: true, executionMode: true } });
      const protocol = object(run?.manifest.payload);
      const cohort = object(protocol.cohort);
      if (!run || !campaign || !packet76SuccessorAccountingRunEligible(run.status, run.cases.map((item) => item.status)) || run.plannedTrials !== 2 || run.plannedDenominator !== 2
        || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt
        || run.manifest.canonicalDigest !== sha256(protocol) || cohort.cohortKey !== scope.cohortKey
        || campaign.budgetLimitOiu?.toString() !== scope.authorizedOiu || campaign.reservationPerAttemptOiu?.toString() !== scope.perAdmissionOiu
        || workItems.some((item) => item.executionMode !== "DIAGNOSTIC" && ["PENDING", "LEASED"].includes(item.status))
        || run.reports?.length) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_SCOPE_INVALID");
      const attempts = run.cases.flatMap((item) => item.attempts);
      if (run.cases.length !== 2 || run.cases.some((item) => !["EXECUTED", "FAILED", "INCONCLUSIVE"].includes(item.status))
        || attempts.length < 2 || attempts.some((attempt) => !["SUCCEEDED", "INFRA_FAILURE", "BUDGET_BLOCKED"].includes(attempt.status))) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_PENDING_WORK");
      const keys = attempts.map((attempt) => `evaluation-attempt:${attempt.id}`);
      const admissionIds = attempts.flatMap((attempt) => attempt.admissionId ? [attempt.admissionId] : []);
      const admissions = await tx.oicAdmission.findMany({
        where: { applicationId: scope.applicationId, tenantId: null, OR: [{ id: { in: admissionIds } }, { idempotencyKey: { in: keys } }] },
        include: { legs: { include: { bucket: { select: { unit: true } } } }, postings: { select: { bucketId: true, kind: true, amount: true } } }
      });
      const admissionByKey = new Map(admissions.map((admission) => [admission.idempotencyKey, admission]));
      const providerAttempts = await tx.oicProviderAttempt.findMany({ where: { applicationId: scope.applicationId, tenantId: null, OR: [{ admissionId: { in: admissions.map((item) => item.id) } }, { requestId: { in: attempts.map((item) => `evaluation-${item.id}`) } }] }, select: { id: true, admissionId: true, status: true, usageStatus: true, providerKey: true, upstreamModelId: true, bindingId: true, connectionId: true, startedAt: true } });
      for (const attempt of attempts) {
        const admission = admissionByKey.get(`evaluation-attempt:${attempt.id}`);
        if (attempt.admissionId && (!admission || admission.id !== attempt.admissionId)) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_ADMISSION_MISMATCH");
        const linkedProviders = providerAttempts.filter((item) => item.admissionId === admission?.id || item.id === attempt.providerAttemptId);
        if (attempt.status === "SUCCEEDED") {
          if (!admission || admission.status !== "SETTLED" || linkedProviders.length !== 1 || linkedProviders[0]?.status !== "SUCCEEDED" || linkedProviders[0]?.usageStatus !== "REPORTED"
            || linkedProviders[0]?.providerKey !== "openai-compatible" || linkedProviders[0]?.upstreamModelId !== "deepseek-flash"
            || linkedProviders[0]?.bindingId !== "ada73ca7-ca5c-4b30-bae6-80c221b3eab4" || linkedProviders[0]?.connectionId !== "bc113c1b-e8fc-4a0b-9bda-8428a94f3005") throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_SUCCESS_EVIDENCE_INVALID");
          const usage = await tx.oicUsageEvent.findMany({ where: { providerAttemptId: linkedProviders[0].id }, include: { oiuAssessments: { select: { status: true } }, costAssessments: { select: { status: true } } } });
          if (usage.length !== 1 || !usage[0]!.oiuAssessments.some((row) => row.status === "ASSESSED") || !usage[0]!.costAssessments.some((row) => row.status === "ASSESSED")) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_USAGE_UNASSESSED");
        } else if (attempt.admissionId || linkedProviders.length || attempt.providerAttemptId || attempt.providerDispatchStartedAt || attempt.evidenceDigest) {
          throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_FAILURE_HAS_PROVIDER_BOUNDARY");
        }
      }
      for (const admission of admissions) {
        if (!(["RELEASED", "SETTLED"].includes(admission.status))) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_ADMISSION_UNRESOLVED");
        const leg = admission.legs.find((item) => item.bucket.unit === "OIU");
        if (admission.legs.length !== 1 || !leg || !leg.amount.equals(scope.perAdmissionOiu) || leg.budgetRevisionId !== scope.budgetRevisionId || !["RELEASED", "SETTLED"].includes(leg.state)) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_BUDGET_LEG_INVALID");
      }
      const aggregate = computeBudgetLedgerAggregate(admissions);
      const aggregateReserved = new Prisma.Decimal(aggregate.reservedOiu);
      const aggregateReleased = new Prisma.Decimal(aggregate.releasedOiu);
      const aggregateConsumed = new Prisma.Decimal(aggregate.consumedOiu);
      if (aggregateReserved.gt(scope.authorizedOiu) || aggregateReleased.gt(aggregateReserved) || aggregateConsumed.plus(aggregateReleased).gt(aggregateReserved)) throw new ConflictException("PACKET76_SUCCESSOR_ACCOUNTING_AUTHORIZATION_EXCEEDED");
      const priorAudit = await tx.oicAuditEvent.findFirst({ where: { applicationId: scope.applicationId, action: "evaluation.budget.run_aggregate_reconciled", targetType: "evaluation-run", targetId: run.id }, orderBy: { occurredAt: "desc" }, select: { metadata: true } });
      const priorMeta = object(priorAudit?.metadata);
      if (priorMeta.ledgerBasisDigest === aggregate.ledgerBasisDigest
        && run.budgetReservationOiu?.equals(aggregateReserved) && run.budgetReleasedOiu.equals(aggregateReleased)
        && campaign.reservedOiu.equals(aggregateConsumed) && attempts.every((item) => item.budgetReconciledAt)) {
        return { status: "RECONCILED", runId: run.id, reconciliationRevision: Number(priorMeta.reconciliationRevision) || 1, replayed: true, ledgerBasisDigest: aggregate.ledgerBasisDigest, admissionCount: aggregate.admissionCount };
      }
      const revision = (Number(priorMeta.reconciliationRevision) || 0) + 1;
      const previous = { reservedOiu: run.budgetReservationOiu?.toString() ?? null, releasedOiu: run.budgetReleasedOiu.toString(), campaignReservedOiu: campaign.reservedOiu.toString() };
      const attemptCorrections: Array<{ attemptId: string; previousReleasedOiu: string; reconciledReleasedOiu: string }> = [];
      const releasedByAttempt = new Map<string, Prisma.Decimal>();
      for (const attempt of attempts) {
        const admission = admissionByKey.get(`evaluation-attempt:${attempt.id}`);
        let released = new Prisma.Decimal(0);
        if (admission?.status === "SETTLED") {
          const leg = admission.legs.find((item) => item.bucket.unit === "OIU")!;
          const consume = admission.postings.filter((posting) => posting.bucketId === leg.bucketId && posting.kind === "CONSUME").reduce((sum, posting) => sum.plus(posting.amount), new Prisma.Decimal(0));
          released = leg.amount.minus(consume);
        }
        if (!attempt.budgetReconciledAt || !attempt.budgetReleasedOiu.equals(released)) {
          attemptCorrections.push({ attemptId: attempt.id, previousReleasedOiu: attempt.budgetReleasedOiu.toString(), reconciledReleasedOiu: released.toString() });
        }
        releasedByAttempt.set(attempt.id, released);
      }
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: scope.applicationId, tenantId: run.tenantId, action: "evaluation.budget.run_aggregate_reconciled", targetType: "evaluation-run", targetId: run.id, metadata: {
        reconciliationRevision: revision, reason: "PACKET76_IMMUTABLE_OIC6_ADMISSION_LEDGER_RECOMPUTE", previousAggregate: previous,
        recomputedAggregate: { reservedOiu: aggregate.reservedOiu.toString(), releasedOiu: aggregate.releasedOiu.toString(), consumedOiu: aggregate.consumedOiu.toString() },
        ledgerBasisDigest: aggregate.ledgerBasisDigest, admissionCount: aggregate.admissionCount, attemptCount: attempts.length,
        funding: aggregate.funding, ledger: "OIC6_IMMUTABLE_ADMISSION_POSTINGS", attemptCorrections, nonSecretEvidenceOnly: true
      } } });
      await tx.oicEvaluationRun.update({ where: { id: run.id }, data: { budgetReservationOiu: aggregateReserved, budgetReleasedOiu: aggregateReleased } });
      await tx.oicEvaluationCampaign.update({ where: { id: campaign.id }, data: { reservedOiu: aggregateConsumed } });
      for (const attempt of attempts) if (!attempt.budgetReconciledAt || !attempt.budgetReleasedOiu.equals(releasedByAttempt.get(attempt.id)!)) {
        await tx.oicEvaluationAttempt.update({ where: { id: attempt.id }, data: { budgetReconciledAt: new Date(), budgetReleasedOiu: releasedByAttempt.get(attempt.id)! } });
      }
      return { status: "RECONCILED", runId: run.id, reconciliationRevision: revision, replayed: false, previousAggregate: previous,
        recomputedAggregate: { reservedOiu: aggregate.reservedOiu.toString(), releasedOiu: aggregate.releasedOiu.toString(), consumedOiu: aggregate.consumedOiu.toString() },
        ledgerBasisDigest: aggregate.ledgerBasisDigest, admissionCount: aggregate.admissionCount, attemptCount: attempts.length };
    });
    } catch (error) {
      const errorCode = error instanceof Error && /^(PACKET76|OIC6)_[A-Z0-9_]{2,96}$/.test(error.message) ? error.message : null;
      const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
      const meta = typeof record.meta === "object" && record.meta !== null ? record.meta as Record<string, unknown> : {};
      const message = [error instanceof Error ? error.message : "", typeof meta.message === "string" ? meta.message : "", typeof meta.cause === "string" ? meta.cause : ""].join(" ");
      const sqlState = /Code:\s*([A-Z0-9]{5})/.exec(message)?.[1] ?? (typeof meta.code === "string" && /^[A-Z0-9]{5}$/.test(meta.code) ? meta.code : null);
      const safeConstraint = /constraint[\s"']+([A-Za-z][A-Za-z0-9_]{0,95})["']?/i.exec(message)?.[1] ?? null;
      process.stderr.write(`${JSON.stringify({ event: "evaluation.packet76.successor.accounting_reconcile_failed", errorClass: error instanceof Error ? error.constructor.name : "UnknownError", errorCode, sqlState, safeConstraint })}\n`);
      throw error;
    }
  }

  async health(actor: AuthenticatedPrincipal) {
    const workerEnabled = this.config?.get<string>("OIC_EVALUATION_WORKER_ENABLED") === "true";
    const sandboxEnabled = this.config?.get<string>("OIC_EVALUATOR_ENABLED") === "true";
    const enforced = this.config?.get<string>("OIC_ADMISSION_MODE") === "ENFORCE";
    const [configuredProviders, readinessResult] = await Promise.all([
      this.db.oicProviderConnection.count({ where: { status: "ACTIVE", OR: [{ scope: "PLATFORM" }, { applicationId: actor.applicationId }], credentials: { some: { status: "ACTIVE" } } } }),
      this.workQueue ? this.workQueue.workerReadiness().then((readiness) => ({ readiness, error: null as string | null })).catch(() => ({ readiness: null, error: "QUEUE_UNAVAILABLE" })) : Promise.resolve({ readiness: null, error: null as string | null })
    ]);
    const readiness = readinessResult.readiness;
    const capability = readiness?.capabilities;
    const dependenciesReady = capability?.database === true && capability.durableQueue === true && capability.claimFencing === true
      && capability.claimLoopAlive === true && capability.compatibilityIdentity === "oic-evaluation-worker-readiness-v1"
      && capability.artifactWriteKeyVersion === 2 && capability.legacyWriteDisabled === true
      && capability.artifactEvidence === true && capability.artifactFinalization === true
      && capability.sealedOracle === true && capability.admission === true && capability.outboxFinalization === true
      && capability.textGeneration === true && Array.isArray(capability.supportedTargetClasses)
      && capability.supportedTargetClasses.includes("MODEL_WITH_OIC_RUNTIME");
    const workerFresh = readiness?.state === "READY" && readiness.fresh && dependenciesReady;
    const workerState = readinessResult.error ? "DEGRADED" : readiness?.state ?? "ABSENT";
    const reasonCode = workerFresh ? null : readinessResult.error ?? readiness?.reasonCode ?? (readiness?.state === "STALE" ? "WORKER_ATTESTATION_STALE"
      : readiness?.state === "DRAINING" ? "WORKER_DRAINING"
      : readiness?.state === "STARTING" ? "WORKER_STARTING"
      : readiness?.state === "READY" ? "WORKER_CAPABILITY_INCOMPLETE" : "NO_WORKER_ATTESTATION");
    const runExecution = !workerEnabled || !enforced || readinessResult.error ? "UNAVAILABLE" : workerFresh ? "AVAILABLE_VERIFIED" : "ENABLED_UNVERIFIED";
    return {
      state: "PARTIAL",
      scheduler: !workerEnabled ? "DISABLED" : workerFresh ? "READY" : "ENABLED",
      worker: workerState,
      workerFresh,
      workerReasonCode: reasonCode,
      workerAttestation: readiness ? {
        instanceId: readiness.instanceId, generation: readiness.generation, startedAt: readiness.startedAt,
        lastHeartbeatAt: readiness.heartbeatAt, heartbeatAgeMs: readiness.heartbeatAgeMs,
        activeExecutionSlots: readiness.activeExecutionSlots,
        configuredConcurrency: readiness.configuredConcurrency,
        availableExecutionSlots: readiness.availableExecutionSlots,
        capabilities: readiness.capabilities
      } : null,
      executionAdapters: sandboxEnabled ? ["DOCKER_LINUX"] : [],
      providerExecution: configuredProviders > 0 ? "CONNECTION_PRESENT_UNVERIFIED" : "NOT_CONFIGURED",
      runExecution,
      promotion: "HUMAN_GATE_REQUIRED"
    };
  }

  async listPacks(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationPackRevision.findMany({ where: scope, orderBy: [{ createdAt: "desc" }], take: 100, select: { id: true, applicationId: true, tenantId: true, packKey: true, revision: true, domain: true, taskTypes: true, targetClasses: true, license: true, securityTier: true, manifestDigest: true, status: true, createdAt: true, publishedAt: true, _count: { select: { cases: true, releases: true } } } });
  }

  async pack(actor: AuthenticatedPrincipal, id: string) {
    const row = await this.db.oicEvaluationPackRevision.findFirst({ where: { id, ...this.requireScope(actor) }, select: {
      id: true, applicationId: true, tenantId: true, packKey: true, revision: true, domain: true, taskTypes: true, targetClasses: true, license: true, securityTier: true, status: true, createdAt: true, publishedAt: true,
      manifestDigest: true, manifest: true,
      cases: { orderBy: [{ caseKey: "asc" }, { revision: "asc" }], take: 5000, select: { id: true, caseKey: true, revision: true, taskType: true, language: true, slices: true, rights: true, oracleMethod: true, exposureTier: true, status: true } },
      datasets: { select: { id: true, revision: true, status: true, createdAt: true, publishedAt: true } },
      environments: { select: { id: true, revision: true, status: true, createdAt: true, publishedAt: true } },
      suites: { select: { id: true, datasetId: true, environmentId: true, revision: true, plan: true, planDigest: true, status: true, createdAt: true, publishedAt: true } },
      validationJobs: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, report: true, createdAt: true, completedAt: true } },
      releases: { select: { id: true, revision: true, releaseTier: true, status: true, createdAt: true, publishedAt: true } }
    } });
    if (!row) throw new NotFoundException();
    const { manifest: storedManifest, validationJobs: storedValidationJobs, ...publicRow } = row;
    const importRecord = object(object(storedManifest).importProvenance);
    const validationRow = storedValidationJobs?.[0];
    const validationReport = object(validationRow?.report);
    const validationJob = validationRow ? {
      id: validationRow.id,
      status: validationRow.status,
      createdAt: validationRow.createdAt,
      completedAt: validationRow.completedAt,
      report: {
        compilerKey: typeof validationReport.compilerKey === "string" ? validationReport.compilerKey : null,
        compilerRevision: typeof validationReport.compilerRevision === "number" && Number.isInteger(validationReport.compilerRevision) ? validationReport.compilerRevision : null,
        manifestDigest: typeof validationReport.manifestDigest === "string" && digestPattern.test(validationReport.manifestDigest) ? validationReport.manifestDigest : null,
        caseCount: typeof validationReport.caseCount === "number" && Number.isInteger(validationReport.caseCount) ? validationReport.caseCount : null,
        artifactReferencesChecked: typeof validationReport.artifactReferencesChecked === "number" && Number.isInteger(validationReport.artifactReferencesChecked) ? validationReport.artifactReferencesChecked : null,
        failureCode: typeof validationReport.failureCode === "string" ? validationReport.failureCode.slice(0, 64) : null,
        reasons: Array.isArray(validationReport.reasons) ? validationReport.reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 50) : []
      }
    } : null;
    const importedFrom = importRecord.origin === "EXTERNAL_BENCHMARK" ? {
      adapterKey: typeof importRecord.adapterKey === "string" ? importRecord.adapterKey.slice(0, 128) : null,
      adapterRevision: typeof importRecord.adapterRevision === "number" && Number.isInteger(importRecord.adapterRevision) ? importRecord.adapterRevision : null,
      sourceChecksum: typeof importRecord.sourceChecksum === "string" && digestPattern.test(importRecord.sourceChecksum) ? importRecord.sourceChecksum : null,
      transformMapDigest: typeof importRecord.transformMapDigest === "string" && digestPattern.test(importRecord.transformMapDigest) ? importRecord.transformMapDigest : null,
      upstreamLicense: typeof importRecord.upstreamLicense === "string" ? importRecord.upstreamLicense.slice(0, 256) : null,
      sourceRef: safeSourceReference(importRecord.sourceRef),
      permittedUses: Array.isArray(importRecord.permittedUses) ? importRecord.permittedUses.filter((use): use is string => typeof use === "string").slice(0, 20) : [],
      revocationRef: typeof importRecord.revocationRef === "string" ? importRecord.revocationRef.slice(0, 512) : null
    } : null;
    const caseRows = row.cases.map((item) => {
      const rights = object(item.rights);
      const permittedUses = Array.isArray(rights.permittedUses) ? rights.permittedUses.filter((use): use is string => typeof use === "string").slice(0, 20) : [];
      const sourceRef = safeSourceReference(rights.sourceRef);
      return {
        id: item.id,
        caseKey: item.caseKey,
        revision: item.revision,
        taskType: item.taskType,
        language: item.language,
        slices: item.slices,
        oracleMethod: item.oracleMethod,
        exposureTier: item.exposureTier,
        status: item.status,
        rights: {
          confirmed: rights.confirmed === true,
          license: typeof rights.license === "string" ? rights.license.slice(0, 256) : null,
          sourceRef,
          permittedUses,
          sourceType: rights.sourceType === "FIRST_PARTY_SYNTHETIC" ? rights.sourceType : null,
          rightsBasis: ["OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", "OIC_AUTHORED_INTERNAL_EVALUATION_FIXTURE"].includes(String(rights.rightsBasis)) ? rights.rightsBasis : null,
          commercialEvaluation: rights.commercialEvaluation === "PERMITTED" ? rights.commercialEvaluation : null,
          derivativeUse: rights.derivativeUse === "PERMITTED_FOR_INTERNAL_OIC_EVALUATION" ? rights.derivativeUse : null,
          thirdPartyRedistribution: rights.thirdPartyRedistribution === "NONE" ? rights.thirdPartyRedistribution : null,
          reviewedBy: typeof rights.reviewedBy === "string" && uuidPattern.test(rights.reviewedBy) ? rights.reviewedBy : null,
          reviewedAt: typeof rights.reviewedAt === "string" && !Number.isNaN(Date.parse(rights.reviewedAt)) ? rights.reviewedAt : null
        }
      };
    });
    const frequencies = (values: unknown[]) => {
      const counts = new Map<string, number>();
      for (const value of values) if (typeof value === "string" && value.trim()) counts.set(value, (counts.get(value) ?? 0) + 1);
      return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
    };
    const sliceLabels = caseRows.flatMap((item) => Array.isArray(item.slices) ? item.slices : []);
    const requiredSlices = Array.isArray(object(row.suites[0]?.plan).requiredSlices)
      ? (object(row.suites[0]?.plan).requiredSlices as unknown[]).filter((slice): slice is string => typeof slice === "string")
      : [];
    const coveredSlices = new Set(sliceLabels.filter((slice): slice is string => typeof slice === "string"));
    return {
      ...publicRow,
      importedFrom,
      validationJob,
      cases: caseRows,
      coverage: {
        caseCount: caseRows.length,
        taskTypes: frequencies(caseRows.map((item) => item.taskType)),
        languages: frequencies(caseRows.map((item) => item.language)),
        exposureTiers: frequencies(caseRows.map((item) => item.exposureTier)),
        slices: frequencies(sliceLabels),
        requiredSlices,
        missingRequiredSlices: requiredSlices.filter((slice) => !coveredSlices.has(slice)),
        rightsReviewed: caseRows.filter((item) => item.rights.confirmed && item.rights.reviewedBy && item.rights.reviewedAt && item.rights.license && item.rights.sourceRef && item.rights.permittedUses.length > 0).length
      }
    };
  }

  async listReleases(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    return this.db.oicEvaluationRelease.findMany({ where: this.requireScope(actor, applicationId, tenantId), orderBy: [{ createdAt: "desc" }], take: 100, select: { id: true, applicationId: true, tenantId: true, packId: true, datasetId: true, environmentId: true, suiteId: true, revision: true, releaseTier: true, status: true, createdAt: true, publishedAt: true, compromisedAt: true, pack: { select: { packKey: true } } } });
  }

  async retireRelease(actor: AuthenticatedPrincipal, id: string, input: Record<string, unknown>) {
    assertManage(actor);
    const reason = input.reason;
    if (typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000) throw new BadRequestException("Release retirement requires a bounded reason");
    const release = await this.db.oicEvaluationRelease.findFirst({ where: { id, ...this.requireScope(actor) }, select: { id: true, applicationId: true, tenantId: true, status: true } });
    if (!release) throw new NotFoundException();
    if (release.status === "RETIRED") return { id, status: "RETIRED" };
    if (!["PUBLISHED", "DEPRECATED"].includes(release.status)) throw new ConflictException("RELEASE_STATE_INVALID");
    return this.db.$transaction(async (tx) => {
      const changed = await tx.oicEvaluationRelease.updateMany({ where: { id, status: release.status }, data: { status: "RETIRED" } });
      if (changed.count !== 1) throw new ConflictException("RELEASE_STATE_CHANGED");
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: release.applicationId, tenantId: release.tenantId, action: "evaluation.release.retired", targetType: "evaluation-release", targetId: id, metadata: { reason: reason.trim() } } });
      return { id, status: "RETIRED" };
    });
  }

  async compromiseRelease(actor: AuthenticatedPrincipal, id: string, input: Record<string, unknown>) {
    assertManage(actor);
    const reason = input.reason;
    const idempotencyKey = input.idempotencyKey;
    if (typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Release compromise requires a bounded reason and idempotency key");
    const release = await this.db.oicEvaluationRelease.findFirst({ where: { id, ...this.requireScope(actor) }, select: { id: true, applicationId: true, tenantId: true, packId: true, status: true, compromisedAt: true } });
    if (!release) throw new NotFoundException();
    if (release.status === "COMPROMISED" || release.compromisedAt) return { id, status: "COMPROMISED", compromisedAt: release.compromisedAt };
    if (!["PUBLISHED", "DEPRECATED", "RETIRED"].includes(release.status)) throw new ConflictException("RELEASE_STATE_INVALID");
    const compromisedAt = new Date();
    return this.db.$transaction(async (tx) => {
      const changed = await tx.oicEvaluationRelease.updateMany({ where: { id, status: release.status, compromisedAt: null }, data: { status: "COMPROMISED", compromisedAt } });
      if (changed.count !== 1) throw new ConflictException("RELEASE_STATE_CHANGED");
      await tx.oicEvaluationPackRevision.updateMany({ where: { id: release.packId, status: "PUBLISHED" }, data: { status: "COMPROMISED" } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: release.applicationId, tenantId: release.tenantId, action: "evaluation.release.compromised", targetType: "evaluation-release", targetId: id, requestId: idempotencyKey, metadata: { reason: reason.trim() } } });
      return { id, status: "COMPROMISED", compromisedAt };
    });
  }

  async listMetrics(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    return this.db.oicEvaluationMetricRevision.findMany({ where: this.requireScope(actor, applicationId, tenantId), orderBy: [{ metricKey: "asc" }, { revision: "desc" }], take: 200, select: { id: true, applicationId: true, tenantId: true, metricKey: true, revision: true, definition: true, definitionDigest: true, status: true, publishedAt: true } });
  }

  async createMetric(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const metricKey = input.metricKey;
    const revision = input.revision;
    if (metricKey === "oic7-objective-exact-match" && typeof revision === "number" && revision > 1 && input.basisDraftId === undefined) throw new ConflictException("CORRECTED_PACKET_7_6_METRIC_REQUIRES_DISTINCT_PUBLICATION");
    const definition = object(input.definition);
    const metricTypes = ["BOOLEAN", "COUNT", "DECIMAL", "CATEGORY", "PAIRWISE"];
    const polarities = ["HIGH_IS_GOOD", "HIGH_IS_BAD", "TARGET_RANGE"];
    const metricFields = new Set(["type", "unit", "polarity", "applicableTargetClasses", "applicableDomains", "rangeOrCategories", "missingSemantics", "oracleOrJudgeRevisionId", "aggregationMethodRevision", "uncertaintyMethodRevision", "minimumEffectiveN", "criticality", "normalizationRevisionOrNone", "sourceArtifactRequirement", "methodRevision", "metricMeaning", "scoringAlgorithmRevision", "thresholdSemanticsRevision", "failureSemanticsRevision", "languageSemanticsRevision", "protectedDataSemanticsRevision", "humanRubricArtifactId", "humanRubricDigest"]);
    const required = ["type", "unit", "polarity", "applicableTargetClasses", "applicableDomains", "rangeOrCategories", "missingSemantics", "oracleOrJudgeRevisionId", "aggregationMethodRevision", "uncertaintyMethodRevision", "minimumEffectiveN", "criticality", "normalizationRevisionOrNone", "sourceArtifactRequirement", "methodRevision"];
    const range = object(definition.rangeOrCategories);
    const validRange = (definition.type === "CATEGORY" || definition.type === "PAIRWISE")
      ? Array.isArray(range.categories) && range.categories.length > 0 && range.categories.length <= 64 && range.categories.every((item) => typeof item === "string" && item.length > 0 && item.length <= 128)
      : typeof range.minimum === "number" && Number.isFinite(range.minimum) && typeof range.maximum === "number" && Number.isFinite(range.maximum) && range.minimum <= range.maximum;
    if (typeof metricKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(metricKey) || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || required.some((key) => !(key in definition)) || Object.keys(definition).some((key) => !metricFields.has(key)) || !metricTypes.includes(String(definition.type)) || !polarities.includes(String(definition.polarity)) || typeof definition.unit !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(definition.unit) || !validRange || !Array.isArray(definition.applicableTargetClasses) || !definition.applicableTargetClasses.length || definition.applicableTargetClasses.length > targetClasses.size || definition.applicableTargetClasses.some((item) => typeof item !== "string" || !targetClasses.has(item)) || !Array.isArray(definition.applicableDomains) || !definition.applicableDomains.length || definition.applicableDomains.length > domains.size || definition.applicableDomains.some((item) => typeof item !== "string" || !domains.has(item)) || !Number.isInteger(definition.minimumEffectiveN) || (definition.minimumEffectiveN as number) < 1 || (definition.minimumEffectiveN as number) > 1_000_000 || !["CRITICAL", "REQUIRED", "SECONDARY", "EXPLORATORY"].includes(String(definition.criticality)) || typeof definition.missingSemantics !== "string" || !/^[A-Z0-9_:-]{1,128}$/.test(definition.missingSemantics) || typeof definition.methodRevision !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(definition.methodRevision) || typeof definition.aggregationMethodRevision !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(definition.aggregationMethodRevision) || typeof definition.uncertaintyMethodRevision !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(definition.uncertaintyMethodRevision) || typeof definition.oracleOrJudgeRevisionId !== "string" || !/^(?:NONE|[A-Za-z0-9._:-]{1,128})$/.test(definition.oracleOrJudgeRevisionId) || typeof definition.normalizationRevisionOrNone !== "string" || !/^(?:NONE|[A-Za-z0-9._:-]{1,128})$/.test(definition.normalizationRevisionOrNone) || !["SEALED_OBJECTIVE_ORACLE", "ATTEMPT_EVIDENCE", "NONE"].includes(String(definition.sourceArtifactRequirement))) throw new BadRequestException("Metric revision is incomplete or conflicts with the typed measurement contract");
    const packet76MethodFields = { metricMeaning: "EXACT_REFERENCE_BYTE_MATCH", scoringAlgorithmRevision: "REFERENCE_EXACT_BYTES_V1", thresholdSemanticsRevision: "BOOLEAN_TRUE_IS_EXACT_MATCH_V1", failureSemanticsRevision: "EXECUTION_FAILURE_FALSE_MISSING_UNMEASURED_V1", languageSemanticsRevision: "BYTEWISE_NO_LOCALE_NORMALIZATION_V1", protectedDataSemanticsRevision: "SEALED_REFERENCE_SERVER_SIDE_ONLY_V1" };
    if (metricKey === "oic7-objective-exact-match" && revision > 1 && Object.entries(packet76MethodFields).some(([key, value]) => definition[key] !== value)) throw new BadRequestException("Packet 7.6 corrected metric method semantics are incomplete");
    const hasHumanRubric = definition.humanRubricArtifactId !== undefined || definition.humanRubricDigest !== undefined;
    if (hasHumanRubric && (typeof definition.humanRubricArtifactId !== "string" || !uuidPattern.test(definition.humanRubricArtifactId) || typeof definition.humanRubricDigest !== "string" || !digestPattern.test(definition.humanRubricDigest))) throw new BadRequestException("Human rubric reference must pin an artifact ID and digest");
    if (hasHumanRubric) {
      try { await this.artifacts.verifyReference(definition.humanRubricArtifactId as string, definition.humanRubricDigest as string, { applicationId: typeof input.applicationId === "string" ? input.applicationId : actor.applicationId, tenantId: typeof input.tenantId === "string" ? input.tenantId : null, purpose: "RUBRIC", exposureTier: "INTERNAL" }); }
      catch { throw new ConflictException("HUMAN_RUBRIC_UNRESOLVABLE"); }
    }
    const applicationId = hasOicConsoleManage(actor.scopes) && typeof input.applicationId === "string" ? input.applicationId : actor.applicationId;
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : null;
    if (tenantId && !hasOicConsoleManage(actor.scopes) && !actor.tenantIds.includes(tenantId)) throw new NotFoundException();
    const basisDraftId = input.basisDraftId;
    let basisDraft: { id: string; createdByPrincipalId: string; payloadDigest: string } | null = null;
    if (basisDraftId !== undefined) {
      if (typeof basisDraftId !== "string" || !uuidPattern.test(basisDraftId)) throw new BadRequestException("Evaluation metric draft identity is invalid");
      const draft = await this.db.oicEvaluationBasisDraft.findFirst({ where: { id: basisDraftId, applicationId, tenantId, kind: "METRIC", status: "DRAFT" } });
      const proposed = { metricKey, revision, definition, ...(typeof input.applicationId === "string" ? { applicationId: input.applicationId } : {}), ...(typeof input.tenantId === "string" ? { tenantId: input.tenantId } : {}) };
      if (!draft || draft.createdByPrincipalId === actor.id || draft.payloadDigest !== sha256(proposed) || sha256(draft.payload) !== draft.payloadDigest) throw new ConflictException("DISTINCT_METRIC_PUBLISHER_REQUIRED");
      basisDraft = draft;
    }
    const definitionDigest = sha256({ metricKey, revision, definition });
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.oicEvaluationMetricRevision.create({ data: { applicationId, tenantId, metricKey, revision, definition: definition as Prisma.InputJsonValue, definitionDigest, createdBy: basisDraft?.createdByPrincipalId ?? actor.id } });
        if (basisDraft) {
          const marked = await tx.oicEvaluationBasisDraft.updateMany({ where: { id: basisDraft.id, status: "DRAFT", createdByPrincipalId: { not: actor.id } }, data: { status: "PUBLISHED", publishedByPrincipalId: actor.id, publishedEntityId: row.id, publishedAt: new Date() } });
          if (marked.count !== 1) throw new ConflictException("EVALUATION_BASIS_DRAFT_STATE_CHANGED");
        }
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId, tenantId, action: "evaluation.metric.published", targetType: "evaluation-metric", targetId: row.id, metadata: { definitionDigest, metricKey, revision, authorPrincipalId: basisDraft?.createdByPrincipalId ?? actor.id, publisherPrincipalId: actor.id } } });
        return { id: row.id, metricKey, revision, definitionDigest, status: row.status };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("METRIC_REVISION_EXISTS");
      throw error;
    }
  }

  async listJudges(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    return this.db.oicEvaluationJudgeRevision.findMany({ where: this.requireScope(actor, applicationId, tenantId), orderBy: [{ judgeKey: "asc" }, { revision: "desc" }], take: 200, select: { id: true, applicationId: true, tenantId: true, judgeKey: true, revision: true, judgeType: true, definitionDigest: true, status: true, publishedAt: true } });
  }

  async createJudge(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const judgeKey = input.judgeKey;
    const revision = input.revision;
    const judgeType = input.judgeType;
    const definition = object(input.definition);
    const judgeTypes = ["RULE", "REFERENCE", "HUMAN", "MODEL", "ENSEMBLE"];
    const safeJudgeFields = new Set(["methodRevision", "rubricDigest", "outputSchemaDigest", "abstentionPolicy", "calibrationDigest"]);
    if (typeof judgeKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(judgeKey) || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || typeof judgeType !== "string" || !judgeTypes.includes(judgeType) || typeof definition.methodRevision !== "string" || definition.methodRevision.length > 128 || typeof definition.rubricDigest !== "string" || !digestPattern.test(definition.rubricDigest) || typeof definition.outputSchemaDigest !== "string" || !digestPattern.test(definition.outputSchemaDigest) || typeof definition.abstentionPolicy !== "string" || definition.abstentionPolicy.length > 256 || typeof definition.calibrationDigest !== "string" || !digestPattern.test(definition.calibrationDigest) || Object.keys(definition).some((key) => !safeJudgeFields.has(key))) throw new BadRequestException("Judge revision must pin safe method metadata without inline prompts or secrets");
    if (judgeType === "MODEL" || judgeType === "ENSEMBLE") throw new ConflictException("JUDGE_EXECUTION_NOT_CONFIGURED");
    const applicationId = hasOicConsoleManage(actor.scopes) && typeof input.applicationId === "string" ? input.applicationId : actor.applicationId;
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : null;
    if (tenantId && !hasOicConsoleManage(actor.scopes) && !actor.tenantIds.includes(tenantId)) throw new NotFoundException();
    const definitionDigest = sha256({ judgeKey, revision, judgeType, definition });
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.oicEvaluationJudgeRevision.create({ data: { applicationId, tenantId, judgeKey, revision, judgeType, definition: definition as Prisma.InputJsonValue, definitionDigest, createdBy: actor.id, ...(judgeType === "HUMAN" ? { status: "DRAFT" } : {}) } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId, tenantId, action: "evaluation.judge.published", targetType: "evaluation-judge", targetId: row.id, metadata: { definitionDigest, judgeKey, revision, judgeType } } });
        return { id: row.id, judgeKey, revision, judgeType, definitionDigest, status: row.status };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("JUDGE_REVISION_EXISTS");
      throw error;
    }
  }

  async createPack(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    return this.createPackRevision(actor, input, null);
  }

  async importPack(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const importSpec = object(input.import);
    const allowedRoot = new Set(["applicationId", "tenantId", "import"]);
    const allowedImport = new Set(["adapterKey", "adapterRevision", "sourceArtifactId", "sourceChecksum", "upstreamLicense", "sourceRef", "permittedUses", "revocationRef", "rightsReviewed"]);
    if (Object.keys(input).some((key) => !allowedRoot.has(key)) || Object.keys(importSpec).some((key) => !allowedImport.has(key))) throw new BadRequestException("External benchmark import contains unsupported fields");
    if (importSpec.adapterKey !== NORMALIZED_IMPORT_ADAPTER || importSpec.adapterRevision !== NORMALIZED_IMPORT_ADAPTER_REVISION || typeof importSpec.sourceArtifactId !== "string" || !uuidPattern.test(importSpec.sourceArtifactId) || typeof importSpec.sourceChecksum !== "string" || !digestPattern.test(importSpec.sourceChecksum) || typeof importSpec.upstreamLicense !== "string" || !importSpec.upstreamLicense.trim() || importSpec.upstreamLicense.length > 256 || typeof importSpec.sourceRef !== "string" || !importSpec.sourceRef.trim() || importSpec.sourceRef.length > 1024 || typeof importSpec.revocationRef !== "string" || !importSpec.revocationRef.trim() || importSpec.revocationRef.length > 512 || importSpec.rightsReviewed !== true || !Array.isArray(importSpec.permittedUses) || importSpec.permittedUses.length < 1 || importSpec.permittedUses.length > 20 || importSpec.permittedUses.some((use: unknown) => typeof use !== "string" || !use.trim() || use.length > 80)) throw new BadRequestException("External benchmark import provenance is incomplete or rights review was not confirmed");
    const applicationId = hasOicConsoleManage(actor.scopes) && typeof input.applicationId === "string" ? input.applicationId : actor.applicationId;
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : null;
    if (!uuidPattern.test(applicationId) || (tenantId && !uuidPattern.test(tenantId))) throw new BadRequestException("External benchmark import scope is invalid");
    if (tenantId && !hasOicConsoleManage(actor.scopes) && !actor.tenantIds.includes(tenantId)) throw new NotFoundException();
    const sourceRef = safeSourceReference(importSpec.sourceRef, 1024);
    const revocationRef = safeSourceReference(importSpec.revocationRef, 512);
    if (!sourceRef || !revocationRef) throw new BadRequestException("External benchmark source or revocation reference is invalid");
    const permittedUses = [...new Set(importSpec.permittedUses as string[])].sort();
    const upstreamLicense = importSpec.upstreamLicense.trim();
    let source: Buffer;
    try {
      source = await this.artifacts.read(importSpec.sourceArtifactId, { applicationId, tenantId, purpose: "EVIDENCE", exposureTier: "INTERNAL" });
    } catch {
      throw new ConflictException("IMPORT_SOURCE_UNAVAILABLE");
    }
    let sourceDocument: Record<string, unknown>;
    try {
      if (createHash("sha256").update(source).digest("hex") !== importSpec.sourceChecksum) throw new Error("checksum mismatch");
      const sourceText = source.toString("utf8");
      if (!Buffer.from(sourceText, "utf8").equals(source)) throw new Error("invalid UTF-8");
      sourceDocument = object(JSON.parse(sourceText));
    } catch {
      source.fill(0);
      throw new BadRequestException("External benchmark source checksum or document is invalid");
    }
    source.fill(0);
    if (Object.keys(sourceDocument).sort().join(",") !== "format,pack" || sourceDocument.format !== NORMALIZED_IMPORT_FORMAT) throw new BadRequestException("External benchmark source format is unsupported");
    const pack = object(sourceDocument.pack);
    const allowedPack = new Set(["packKey", "revision", "domain", "license", "targetClasses", "taskTypes", "environment", "suitePlan", "cases", "securityTier"]);
    if (Object.keys(pack).some((key) => !allowedPack.has(key)) || "applicationId" in pack || "tenantId" in pack) throw new BadRequestException("External benchmark mapping contains unsupported or out-of-scope fields");
    if (typeof pack.license !== "string" || pack.license.trim() !== upstreamLicense) throw new BadRequestException("Imported pack license does not match upstream rights provenance");
    if (!Array.isArray(pack.cases) || pack.cases.some((candidate) => {
      const uses = object(object(candidate).rights).permittedUses;
      return !Array.isArray(uses) || uses.some((use: unknown) => typeof use !== "string" || !permittedUses.includes(use));
    })) throw new BadRequestException("Imported case uses exceed the upstream permitted-use declaration");
    const reviewedAt = new Date().toISOString();
    pack.cases = (pack.cases as unknown[]).map((candidate) => {
      const row = object(candidate);
      const rights = object(row.rights);
      return { ...row, rights: { ...rights, confirmed: true, license: upstreamLicense, sourceRef: safeSourceReference(rights.sourceRef) ?? sourceRef, reviewedBy: actor.id, reviewedAt } };
    });
    const importProvenance = {
      origin: "EXTERNAL_BENCHMARK",
      adapterKey: NORMALIZED_IMPORT_ADAPTER,
      adapterRevision: NORMALIZED_IMPORT_ADAPTER_REVISION,
      sourceArtifactId: importSpec.sourceArtifactId,
      sourceChecksum: importSpec.sourceChecksum,
      transformMapDigest: NORMALIZED_IMPORT_TRANSFORM_DIGEST,
      upstreamLicense,
      sourceRef,
      permittedUses,
      revocationRef
    };
    const result = await this.createPackRevision(actor, { ...pack, applicationId, tenantId }, importProvenance);
    return { ...result, import: { adapterKey: importProvenance.adapterKey, adapterRevision: importProvenance.adapterRevision, sourceChecksum: importProvenance.sourceChecksum, transformMapDigest: importProvenance.transformMapDigest } };
  }

  private async createPackRevision(actor: AuthenticatedPrincipal, input: Record<string, unknown>, importProvenance: Record<string, unknown> | null) {
    assertManage(actor);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : null;
    const applicationId = hasOicConsoleManage(actor.scopes) && typeof input.applicationId === "string" ? input.applicationId : actor.applicationId;
    if (tenantId && !hasOicConsoleManage(actor.scopes) && !actor.tenantIds.includes(tenantId)) throw new NotFoundException();
    const packKey = input.packKey;
    const domain = input.domain;
    const license = input.license;
    const revision = input.revision;
    const cases = input.cases;
    if (typeof packKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(packKey) || typeof domain !== "string" || !domains.has(domain) || typeof license !== "string" || !license.trim() || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || !Array.isArray(cases) || cases.length < 1 || cases.length > 5000) throw new BadRequestException("Invalid benchmark pack revision");
    const environment = object(input.environment);
    if (Object.keys(environment).some((key) => !["kind", "methodDigest", "networkPolicy", "timeoutMs", "imageDigest"].includes(key))) throw new BadRequestException("Environment revision contains unsupported fields");
    if (!["DETERMINISTIC_REFERENCE", "EXECUTABLE_SHELL_V1"].includes(String(environment.kind)) || typeof environment.methodDigest !== "string" || !digestPattern.test(environment.methodDigest) || environment.networkPolicy !== "DENY" || typeof environment.timeoutMs !== "number" || !Number.isInteger(environment.timeoutMs) || environment.timeoutMs < 1 || environment.timeoutMs > 300000) throw new BadRequestException("A pinned, bounded evaluation environment is required");
    if (environment.kind === "EXECUTABLE_SHELL_V1" && (typeof environment.imageDigest !== "string" || !/^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/i.test(environment.imageDigest))) throw new BadRequestException("Executable environments require an immutable image digest");
    if (environment.kind === "DETERMINISTIC_REFERENCE" && environment.imageDigest !== undefined) throw new BadRequestException("Reference environments do not run an image");
    const suitePlan = object(input.suitePlan);
    if (Object.keys(suitePlan).some((key) => !["plannedRepetitions", "stoppingRule", "samplingRevision", "minimumEffectiveN", "requiredSlices"].includes(key))) throw new BadRequestException("Suite plan contains unsupported fields");
    if (typeof suitePlan.plannedRepetitions !== "number" || !Number.isInteger(suitePlan.plannedRepetitions) || suitePlan.plannedRepetitions < 1 || suitePlan.plannedRepetitions > 100 || suitePlan.stoppingRule !== "FIXED" || typeof suitePlan.samplingRevision !== "string" || !suitePlan.samplingRevision || typeof suitePlan.minimumEffectiveN !== "number" || !Number.isInteger(suitePlan.minimumEffectiveN) || suitePlan.minimumEffectiveN < 1 || !Array.isArray(suitePlan.requiredSlices) || suitePlan.requiredSlices.some((slice) => typeof slice !== "string" || !slice)) throw new BadRequestException("A preregistered fixed suite plan is required");
    const exposureRanks = { PUBLIC: 0, INTERNAL: 1, PRIVATE_HOLDOUT: 2, PROTECTED_CERTIFICATION: 3 } as const;
    const parsedCases = cases.map((candidate) => {
      const row = object(candidate);
      if (row.exposureTier !== undefined && (typeof row.exposureTier !== "string" || !["PUBLIC", "INTERNAL", "PRIVATE_HOLDOUT", "PROTECTED_CERTIFICATION"].includes(row.exposureTier))) throw new BadRequestException("Unknown case exposure tier");
      const exposureTier = typeof row.exposureTier === "string" ? row.exposureTier : "INTERNAL";
      assertSafeArtifact(row.inputArtifact, exposureTier === "PRIVATE_HOLDOUT" || exposureTier === "PROTECTED_CERTIFICATION");
      assertSafeArtifact(row.oracle, exposureTier === "PRIVATE_HOLDOUT" || exposureTier === "PROTECTED_CERTIFICATION");
      if (!Array.isArray(row.slices) || !row.slices.length || row.slices.some((slice: unknown) => typeof slice !== "string" || !/^[A-Za-z0-9._:-]{1,64}$/.test(slice))) throw new BadRequestException("Case slices must be explicit controlled labels");
      const rights = object(row.rights);
      const rightsSourceRef = safeSourceReference(rights.sourceRef, 1024);
      const firstPartyRights = rights.sourceType !== undefined || rights.rightsBasis !== undefined || rights.commercialEvaluation !== undefined || rights.derivativeUse !== undefined || rights.thirdPartyRedistribution !== undefined;
      const supportedFirstPartyBases = new Set(["OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", "OIC_AUTHORED_INTERNAL_EVALUATION_FIXTURE"]);
      if (Object.keys(rights).some((key) => !["confirmed", "license", "sourceRef", "permittedUses", "reviewedBy", "reviewedAt", "sourceType", "rightsBasis", "commercialEvaluation", "derivativeUse", "thirdPartyRedistribution"].includes(key)) || typeof rights.license !== "string" || !rights.license.trim() || rights.license.length > 256 || !rightsSourceRef || !Array.isArray(rights.permittedUses) || !rights.permittedUses.length || rights.permittedUses.length > 20 || rights.permittedUses.some((use: unknown) => typeof use !== "string" || !use.trim() || use.length > 80) || typeof rights.reviewedBy !== "string" || !uuidPattern.test(rights.reviewedBy) || typeof rights.reviewedAt !== "string" || rights.reviewedAt.length > 64 || Number.isNaN(Date.parse(rights.reviewedAt)) || (firstPartyRights && (rights.sourceType !== "FIRST_PARTY_SYNTHETIC" || typeof rights.rightsBasis !== "string" || !supportedFirstPartyBases.has(rights.rightsBasis) || rights.commercialEvaluation !== "PERMITTED" || rights.derivativeUse !== "PERMITTED_FOR_INTERNAL_OIC_EVALUATION" || rights.thirdPartyRedistribution !== "NONE"))) throw new BadRequestException("Case rights review is incomplete");
      if (typeof row.caseKey !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(row.caseKey) || typeof row.taskType !== "string" || !/^[a-z][a-z0-9_-]{1,63}$/.test(row.taskType) || row.oracleMethod !== OBJECTIVE_ORACLE_METHOD || typeof row.sourceDigest !== "string" || !digestPattern.test(row.sourceDigest) || typeof row.oracleDigest !== "string" || !digestPattern.test(row.oracleDigest) || object(row.rights).confirmed !== true) throw new BadRequestException("Case requires stable identity, objective oracle method, rights confirmation and source/oracle digests");
      return { caseKey: row.caseKey, revision: typeof row.revision === "number" && Number.isInteger(row.revision) && row.revision > 0 ? row.revision : 1, taskType: row.taskType, language: typeof row.language === "string" ? row.language : "und", oracleMethod: OBJECTIVE_ORACLE_METHOD, slices: row.slices, inputArtifact: row.inputArtifact, oracle: row.oracle, rights: { confirmed: rights.confirmed === true, license: rights.license.trim(), sourceRef: rightsSourceRef, permittedUses: [...new Set(rights.permittedUses as string[])], ...(firstPartyRights ? { sourceType: "FIRST_PARTY_SYNTHETIC", rightsBasis: String(rights.rightsBasis), commercialEvaluation: "PERMITTED", derivativeUse: "PERMITTED_FOR_INTERNAL_OIC_EVALUATION", thirdPartyRedistribution: "NONE" } : {}), reviewedBy: rights.reviewedBy, reviewedAt: rights.reviewedAt }, sourceDigest: row.sourceDigest, oracleDigest: row.oracleDigest, exposureTier };
    });
    if (new Set(parsedCases.map((item) => item.caseKey)).size !== parsedCases.length) throw new BadRequestException("Duplicate case identity");
    if (new Set(parsedCases.map((item) => item.sourceDigest)).size !== parsedCases.length) throw new BadRequestException("Duplicate case content");
    const declaredSlices = new Set(parsedCases.flatMap((item) => item.slices.filter((slice): slice is string => typeof slice === "string")));
    if (suitePlan.minimumEffectiveN > parsedCases.length * suitePlan.plannedRepetitions || suitePlan.requiredSlices.some((slice: unknown) => typeof slice !== "string" || !declaredSlices.has(slice))) throw new BadRequestException("Suite plan requires unavailable cases or slices");
    const securityTier = (Object.keys(exposureRanks) as Array<keyof typeof exposureRanks>).find((tier) => exposureRanks[tier] === Math.max(...parsedCases.map((item) => exposureRanks[item.exposureTier as keyof typeof exposureRanks]))) ?? "INTERNAL";
    if (input.securityTier !== undefined && input.securityTier !== securityTier) throw new BadRequestException("Pack security tier must match its most restricted case");
    const targetClassesValue = Array.isArray(input.targetClasses) ? input.targetClasses : [];
    if (!targetClassesValue.length || targetClassesValue.some((item) => typeof item !== "string" || !targetClasses.has(item))) throw new BadRequestException("Pack target classes must use the OIC-7 target vocabulary");
    const targetClassesInput = targetClassesValue as string[];
    const taskTypes = Array.isArray(input.taskTypes) ? input.taskTypes.filter((item): item is string => typeof item === "string") : [...new Set(parsedCases.map((item) => item.taskType))];
    const idNamespace = `${applicationId}:${tenantId ?? "application"}:${packKey}:${revision}`;
    const packId = deterministicUuid(`pack:${idNamespace}`);
    const caseRows = parsedCases.map((item) => ({ ...item, id: deterministicUuid(`case:${idNamespace}:${item.caseKey}:${item.revision}`) }));
    const caseManifest = caseRows.map((item) => ({ caseRevisionId: item.id, caseKey: item.caseKey, weight: 1, slices: item.slices, contentHash: item.sourceDigest, oracleHash: item.oracleDigest, oracleMethod: item.oracleMethod, exposureTier: item.exposureTier }));
    const environmentDefinition = { ...environment, revision: 1 };
    const environmentDigest = sha256(environmentDefinition);
    const datasetDigest = sha256(caseManifest);
    const plan = { ...suitePlan, revision: 1, caseOrderDigest: datasetDigest, environmentDigest };
    const planDigest = sha256(plan);
    const manifest = { packKey, revision, domain, taskTypes, targetClasses: targetClassesInput, license: license.trim(), securityTier, datasetDigest, environmentDigest, planDigest, ...(importProvenance ? { importProvenance } : {}), cases: parsedCases.map(({ inputArtifact, oracle, ...item }) => ({ ...item, inputDigest: object(inputArtifact).digest, oracleArtifactDigest: object(oracle).digest })) };
    const manifestDigest = sha256(manifest);
    const importAuditMetadata = importProvenance ? {
      adapterKey: importProvenance.adapterKey as string,
      sourceChecksum: importProvenance.sourceChecksum as string,
      transformMapDigest: importProvenance.transformMapDigest as string
    } : {};
    try {
      return await this.db.$transaction(async (tx) => {
        const pack = await tx.oicEvaluationPackRevision.create({ data: { id: packId, applicationId, tenantId, packKey, revision, domain, taskTypes, targetClasses: targetClassesInput, license: license.trim(), securityTier, manifest: manifest as Prisma.InputJsonValue, manifestDigest, createdBy: actor.id } });
        await tx.oicEvaluationCaseRevision.createMany({ data: caseRows.map((item) => ({ applicationId, tenantId, packId: pack.id, ...item, slices: item.slices as Prisma.InputJsonValue, inputArtifact: item.inputArtifact as Prisma.InputJsonValue, oracle: item.oracle as Prisma.InputJsonValue, rights: item.rights })) });
        const dataset = await tx.oicEvaluationDatasetRevision.create({ data: { id: deterministicUuid(`dataset:${idNamespace}:1`), applicationId, tenantId, packId: pack.id, revision: 1, caseManifest, manifestDigest: datasetDigest, createdBy: actor.id } });
        const storedEnvironment = await tx.oicEvaluationEnvironmentRevision.create({ data: { id: deterministicUuid(`environment:${idNamespace}:1`), applicationId, tenantId, packId: pack.id, revision: 1, definition: environmentDefinition, definitionDigest: environmentDigest, createdBy: actor.id } });
        const suite = await tx.oicEvaluationSuiteRevision.create({ data: { id: deterministicUuid(`suite:${idNamespace}:1`), applicationId, tenantId, packId: pack.id, datasetId: dataset.id, environmentId: storedEnvironment.id, revision: 1, plan, planDigest, createdBy: actor.id } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId, tenantId, action: importProvenance ? "evaluation.pack.imported" : "evaluation.pack.created", targetType: "evaluation-pack", targetId: pack.id, metadata: { manifestDigest, caseCount: parsedCases.length, ...importAuditMetadata } } });
        return { id: pack.id, revision: pack.revision, status: pack.status, manifestDigest, caseCount: parsedCases.length, datasetId: dataset.id, environmentId: storedEnvironment.id, suiteId: suite.id };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("Pack revision or manifest already exists");
      throw error;
    }
  }

  async validatePack(actor: AuthenticatedPrincipal, id: string) {
    assertManage(actor);
    const scope = this.requireScope(actor);
    const pack = await this.db.oicEvaluationPackRevision.findFirst({ where: { id, ...scope }, include: { cases: true, datasets: true, environments: true, suites: true } });
    if (!pack) throw new NotFoundException();
    const jobWhere = { packId_manifestDigest: { packId: pack.id, manifestDigest: pack.manifestDigest } };
    const viewJob = (job: { id: string; status: string; report: Prisma.JsonValue; createdAt: Date; completedAt: Date | null }) => {
      const report = object(job.report);
      return {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        report: {
          compilerKey: report.compilerKey,
          compilerRevision: report.compilerRevision,
          manifestDigest: report.manifestDigest,
          caseCount: report.caseCount,
          artifactReferencesChecked: report.artifactReferencesChecked,
          failureCode: report.failureCode ?? null,
          reasons: Array.isArray(report.reasons) ? report.reasons : []
        }
      };
    };
    const existingJob = await this.db.oicEvaluationValidationJob.findUnique({ where: jobWhere });
    if (existingJob) return { id, status: pack.status, manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, validationJob: viewJob(existingJob) };
    if (pack.status !== "DRAFT") return { id, status: pack.status, manifestDigest: pack.manifestDigest, validation: "ALREADY_TRANSITIONED" };
    const startedAt = Date.now();
    let artifactReferencesChecked = 0;
    const contaminationScan = { method: "EXACT_SOURCE_DIGEST_V1", checkedCaseCount: pack.cases.length, intraPackDuplicateCount: 0, crossPackOverlapCount: 0 };
    try {
      const reasons: string[] = [];
      if (!pack.cases.length) reasons.push("NO_CASES");
      if (pack.cases.some((item) => !digestPattern.test(item.sourceDigest) || !digestPattern.test(item.oracleDigest))) reasons.push("INVALID_DIGEST");
      if (pack.cases.some((item) => item.oracleMethod !== OBJECTIVE_ORACLE_METHOD)) reasons.push("ORACLE_METHOD_INVALID");
      const sourceDigests = pack.cases.map((item) => item.sourceDigest);
      const uniqueSourceDigests = new Set(sourceDigests);
      contaminationScan.intraPackDuplicateCount = sourceDigests.length - uniqueSourceDigests.size;
      if (contaminationScan.intraPackDuplicateCount > 0) reasons.push("INTRA_PACK_SOURCE_DUPLICATE");
      if (uniqueSourceDigests.size > 0) {
        const overlaps = await this.db.oicEvaluationCaseRevision.findMany({ where: { applicationId: pack.applicationId, sourceDigest: { in: [...uniqueSourceDigests] }, id: { notIn: pack.cases.map((item) => item.id) } }, select: { id: true } });
        contaminationScan.crossPackOverlapCount = overlaps.length;
        if (overlaps.length > 0) reasons.push("CROSS_PACK_SOURCE_DIGEST_OVERLAP");
      }
      if (pack.datasets.length !== 1 || pack.environments.length !== 1 || pack.suites.length !== 1) reasons.push("REGISTRY_REVISION_MISSING");
      const dataset = pack.datasets[0];
      const environment = pack.environments[0];
      const suite = pack.suites[0];
      if (dataset && environment && suite) {
        if (dataset.manifestDigest !== sha256(dataset.caseManifest) || environment.definitionDigest !== sha256(environment.definition) || suite.planDigest !== sha256(suite.plan) || suite.datasetId !== dataset.id || suite.environmentId !== environment.id) reasons.push("REGISTRY_DIGEST_OR_LINK_INVALID");
        const members = Array.isArray(dataset.caseManifest) ? dataset.caseManifest.map((entry) => object(entry).caseRevisionId) : [];
        if (members.length !== pack.cases.length || new Set(members).size !== members.length || pack.cases.some((item) => !members.includes(item.id))) reasons.push("CASE_MEMBERSHIP_INVALID");
      }
      if (reasons.length) throw new BadRequestException({ message: "Pack validation failed", reasons });
      for (const item of pack.cases) {
        if (object(item.rights).confirmed !== true) throw new BadRequestException("Case rights are unconfirmed");
        const protectedTier = item.exposureTier === "PRIVATE_HOLDOUT" || item.exposureTier === "PROTECTED_CERTIFICATION";
        const referenceKey = protectedTier ? "encryptedArtifactId" : "artifactId";
        const input = object(item.inputArtifact);
        const oracle = object(item.oracle);
        if (input[referenceKey] === oracle[referenceKey]) throw new BadRequestException("Input and oracle must use separate artifacts");
        for (const [reference, purpose, digest] of [[input, "INPUT", item.sourceDigest], [oracle, "ORACLE", item.oracleDigest]] as const) {
          const artifactId = reference[referenceKey];
          if (typeof artifactId !== "string" || reference.digest !== digest) throw new BadRequestException("Case artifact digest does not match the registry manifest");
          try {
            await this.artifacts.verifyReference(artifactId, digest, { applicationId: pack.applicationId, tenantId: pack.tenantId, exposureTier: item.exposureTier, purpose }, protectedTier ? 2 : undefined);
            artifactReferencesChecked++;
          } catch {
            throw new ConflictException("ARTIFACT_UNAVAILABLE_OR_INVALID");
          }
        }
      }
      const environmentDefinition = object(environment?.definition);
      if (environmentDefinition.kind === "EXECUTABLE_SHELL_V1") {
        if (!this.sandbox || typeof environmentDefinition.imageDigest !== "string" || (environmentDefinition.timeoutMs as number) > (this.config?.get<number>("OIC_EVALUATOR_TIMEOUT_MS") ?? 30_000)) throw new ConflictException("SANDBOX_POLICY_UNAVAILABLE");
        try { await this.sandbox.preflight(environmentDefinition.imageDigest); }
        catch (error) { throw new ConflictException(error instanceof SandboxUnavailableError ? error.reasonCode : "SANDBOX_UNAVAILABLE"); }
      }
      if (pack.cases.some((item) => item.exposureTier === "PRIVATE_HOLDOUT" || item.exposureTier === "PROTECTED_CERTIFICATION") && !this.sealedOracle) throw new ConflictException("PROTECTED_VALIDATION_WORKER_UNAVAILABLE");
      const completedAt = new Date();
      const report = { compilerKey: "oic.benchmark-compiler", compilerRevision: 1, manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, artifactReferencesChecked, contaminationScan, elapsedMs: Date.now() - startedAt, failureCode: null, reasons: [] };
      const job = await this.db.$transaction(async (tx) => {
        const changed = await tx.oicEvaluationPackRevision.updateMany({ where: { id, status: "DRAFT" }, data: { status: "VALIDATED" } });
        if (changed.count !== 1) throw new ConflictException("PACK_STATE_CHANGED");
        await tx.oicEvaluationCaseRevision.updateMany({ where: { packId: id, status: "DRAFT" }, data: { status: "VALIDATED" } });
        await tx.oicEvaluationDatasetRevision.updateMany({ where: { packId: id, status: "DRAFT" }, data: { status: "VALIDATED" } });
        await tx.oicEvaluationEnvironmentRevision.updateMany({ where: { packId: id, status: "DRAFT" }, data: { status: "VALIDATED" } });
        await tx.oicEvaluationSuiteRevision.updateMany({ where: { packId: id, status: "DRAFT" }, data: { status: "VALIDATED" } });
        const validationJob = await tx.oicEvaluationValidationJob.create({ data: { applicationId: pack.applicationId, tenantId: pack.tenantId, packId: pack.id, manifestDigest: pack.manifestDigest, status: "SUCCEEDED", report, createdBy: actor.id, completedAt } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: pack.applicationId, tenantId: pack.tenantId, action: "evaluation.pack.validated", targetType: "evaluation-pack", targetId: id, metadata: { manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, validationJobId: validationJob.id } } });
        return validationJob;
      });
      return { id, status: "VALIDATED", manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, validationJob: viewJob(job) };
    } catch (error) {
      const prior = await this.db.oicEvaluationValidationJob.findUnique({ where: jobWhere }).catch(() => null);
      if (prior) return { id, status: pack.status === "DRAFT" && prior.status === "SUCCEEDED" ? "VALIDATED" : pack.status, manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, validationJob: viewJob(prior) };
      const response = error instanceof BadRequestException ? object(error.getResponse()) : {};
      const reasons = Array.isArray(response.reasons) ? response.reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 50) : [];
      const failureCode = error instanceof BadRequestException ? "PACK_VALIDATION_REJECTED" : error instanceof ConflictException ? "VALIDATION_DEPENDENCY_UNAVAILABLE" : "VALIDATION_FAILED";
      const completedAt = new Date();
      const report = { compilerKey: "oic.benchmark-compiler", compilerRevision: 1, manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, artifactReferencesChecked, contaminationScan, elapsedMs: Date.now() - startedAt, failureCode, reasons };
      try {
        await this.db.$transaction(async (tx) => {
          const validationJob = await tx.oicEvaluationValidationJob.create({ data: { applicationId: pack.applicationId, tenantId: pack.tenantId, packId: pack.id, manifestDigest: pack.manifestDigest, status: "FAILED", report, createdBy: actor.id, completedAt } });
          await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: pack.applicationId, tenantId: pack.tenantId, action: "evaluation.pack.validation_failed", targetType: "evaluation-pack", targetId: id, metadata: { manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, failureCode, validationJobId: validationJob.id, reasons } } });
          return validationJob;
        });
        throw error;
      } catch (persistError) {
        if (persistError === error) throw error;
        const raced = await this.db.oicEvaluationValidationJob.findUnique({ where: jobWhere }).catch(() => null);
        if (raced) return { id, status: pack.status === "DRAFT" && raced.status === "SUCCEEDED" ? "VALIDATED" : pack.status, manifestDigest: pack.manifestDigest, caseCount: pack.cases.length, validationJob: viewJob(raced) };
        throw error;
      }
    }
  }

  async publishRelease(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const packId = input.packId;
    const idempotencyKey = input.idempotencyKey;
    if (typeof packId !== "string" || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey) || typeof input.changelog !== "string" || !input.changelog.trim()) throw new BadRequestException("Release publication requires pack, changelog and idempotency key");
    const changelog = input.changelog.trim();
    const pack = await this.db.oicEvaluationPackRevision.findFirst({ where: { id: packId, ...this.requireScope(actor) }, include: { cases: { orderBy: [{ caseKey: "asc" }, { revision: "asc" }] }, datasets: true, environments: true, suites: true } });
    if (!pack || pack.status !== "VALIDATED") throw new ConflictException("PACK_NOT_VALIDATED");
    if (pack.cases.some((item) => item.exposureTier === "PRIVATE_HOLDOUT" || item.exposureTier === "PROTECTED_CERTIFICATION") && !this.sealedOracle) throw new ConflictException("PROTECTED_VALIDATION_WORKER_UNAVAILABLE");
    const dataset = pack.datasets[0];
    const environment = pack.environments[0];
    const suite = pack.suites[0];
    if (!dataset || !environment || !suite || pack.datasets.length !== 1 || pack.environments.length !== 1 || pack.suites.length !== 1 || dataset.status !== "VALIDATED" || environment.status !== "VALIDATED" || suite.status !== "VALIDATED" || suite.datasetId !== dataset.id || suite.environmentId !== environment.id) throw new ConflictException("REGISTRY_REVISION_INVALID");
    const caseManifest = dataset.caseManifest;
    if (!Array.isArray(caseManifest)) throw new ConflictException("DATASET_MANIFEST_INVALID");
    if (input.releaseTier !== undefined && (typeof input.releaseTier !== "string" || !["PUBLIC", "INTERNAL", "PRIVATE_HOLDOUT", "PROTECTED_CERTIFICATION"].includes(input.releaseTier))) throw new BadRequestException("Unknown release tier");
    const releaseTier = typeof input.releaseTier === "string" ? input.releaseTier : pack.securityTier;
    const exposureRanks = { PUBLIC: 0, INTERNAL: 1, PRIVATE_HOLDOUT: 2, PROTECTED_CERTIFICATION: 3 } as const;
    if (!(releaseTier in exposureRanks) || pack.cases.some((item) => exposureRanks[item.exposureTier as keyof typeof exposureRanks] > exposureRanks[releaseTier as keyof typeof exposureRanks])) throw new BadRequestException("Release tier cannot be less restricted than a case");
    if (releaseTier !== pack.securityTier) throw new BadRequestException("Release tier must match the reviewed pack tier");
    if ((releaseTier === "PRIVATE_HOLDOUT" || releaseTier === "PROTECTED_CERTIFICATION") && actor.id === pack.createdBy) throw new ConflictException("HOLDOUT_REQUIRES_INDEPENDENT_PUBLISHER");
    if (releaseTier === "PRIVATE_HOLDOUT" || releaseTier === "PROTECTED_CERTIFICATION") {
      for (const item of pack.cases) {
        const rights = object(item.rights);
        if (rights.sourceType !== "FIRST_PARTY_SYNTHETIC") continue;
        if (!new Set(["OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", "OIC_AUTHORED_INTERNAL_EVALUATION_FIXTURE"]).has(String(rights.rightsBasis)) || rights.commercialEvaluation !== "PERMITTED" || rights.derivativeUse !== "PERMITTED_FOR_INTERNAL_OIC_EVALUATION" || rights.thirdPartyRedistribution !== "NONE" || rights.confirmed !== true) throw new ConflictException("FIRST_PARTY_HOLDOUT_RIGHTS_INCOMPLETE");
        if (rights.reviewedBy !== actor.id || actor.id === pack.createdBy) throw new ConflictException("FIRST_PARTY_HOLDOUT_REQUIRES_INDEPENDENT_REVIEW");
        const input = object(item.inputArtifact);
        const oracle = object(item.oracle);
        if (typeof input.encryptedArtifactId !== "string" || !uuidPattern.test(input.encryptedArtifactId) || typeof oracle.encryptedArtifactId !== "string" || !uuidPattern.test(oracle.encryptedArtifactId)) throw new ConflictException("PROTECTED_ARTIFACT_REFERENCE_INVALID");
        try {
          await this.artifacts.verifyReference(input.encryptedArtifactId, item.sourceDigest, { applicationId: pack.applicationId, tenantId: pack.tenantId, purpose: "INPUT", exposureTier: item.exposureTier }, 2);
          await this.artifacts.verifyReference(oracle.encryptedArtifactId, item.oracleDigest, { applicationId: pack.applicationId, tenantId: pack.tenantId, purpose: "ORACLE", exposureTier: item.exposureTier }, 2);
        } catch { throw new ConflictException("PROTECTED_ARTIFACT_KEY_VERSION_INVALID"); }
      }
    }
    const protocol = { protocolVersion: "oic-evaluation-v1", requiredTargetClasses: pack.targetClasses, datasetRevisionId: dataset.id, datasetDigest: dataset.manifestDigest, environmentRevisionId: environment.id, environmentDigest: environment.definitionDigest, suiteRevisionId: suite.id, suiteDigest: suite.planDigest, caseOrderDigest: sha256(caseManifest), sampling: suite.plan, verificationTier: "OIC_EXECUTED_VERIFIED" };
    const manifestDigest = sha256({ pack: pack.manifestDigest, caseManifest, protocol, releaseTier });
    try {
      const result = await this.db.$transaction(async (tx) => {
        const release = await tx.oicEvaluationRelease.create({ data: { applicationId: pack.applicationId, tenantId: pack.tenantId, packId: pack.id, datasetId: dataset.id, environmentId: environment.id, suiteId: suite.id, revision: 1, releaseTier, caseManifest, protocol, manifestDigest, status: "PUBLISHED", changelog, createdBy: actor.id, publishedAt: new Date() } });
        await tx.oicEvaluationPackRevision.update({ where: { id: pack.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await tx.oicEvaluationCaseRevision.updateMany({ where: { packId: pack.id, status: "VALIDATED" }, data: { status: "PUBLISHED" } });
        await tx.oicEvaluationDatasetRevision.update({ where: { id: dataset.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await tx.oicEvaluationEnvironmentRevision.update({ where: { id: environment.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await tx.oicEvaluationSuiteRevision.update({ where: { id: suite.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: pack.applicationId, tenantId: pack.tenantId, action: "evaluation.release.published", targetType: "evaluation-release", targetId: release.id, requestId: idempotencyKey, metadata: { manifestDigest, packManifestDigest: pack.manifestDigest, caseCount: caseManifest.length, releaseTier } } });
        return release;
      });
      return { id: result.id, status: result.status, manifestDigest, caseCount: caseManifest.length, releaseTier };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("Release revision or manifest already exists");
      throw error;
    }
  }

  async reviewReleaseContamination(actor: AuthenticatedPrincipal, releaseId: string) {
    assertManage(actor);
    const release = await this.db.oicEvaluationRelease.findFirst({
      where: { id: releaseId, ...this.requireScope(actor) },
      include: { pack: { include: { cases: true } } }
    });
    if (!release || release.status !== "PUBLISHED" || release.compromisedAt || release.releaseTier !== "PRIVATE_HOLDOUT" || release.createdBy !== actor.id || release.pack.createdBy === actor.id) throw new ConflictException("HOLDOUT_CONTAMINATION_REVIEW_INELIGIBLE");
    const validation = await this.db.oicEvaluationValidationJob.findFirst({ where: { packId: release.packId, manifestDigest: release.pack.manifestDigest, status: "SUCCEEDED" }, select: { id: true } });
    if (!validation || release.pack.cases.length !== 1) throw new ConflictException("HOLDOUT_VALIDATION_INCOMPLETE");
    const existing = await this.db.oicAuditEvent.findFirst({ where: { applicationId: release.applicationId, action: "evaluation.release.contamination_reviewed", targetType: "evaluation-release", targetId: release.id, actorPrincipalId: actor.id }, select: { id: true } });
    if (existing) return { releaseId, status: "REVIEWED_NO_KNOWN_LOCAL_OVERLAP", reviewId: existing.id };
    for (const item of release.pack.cases) {
      const rights = object(item.rights);
      const oracle = object(item.oracle);
      const input = object(item.inputArtifact);
      if (item.status !== "PUBLISHED" || item.exposureTier !== "PRIVATE_HOLDOUT" || rights.sourceType !== "FIRST_PARTY_SYNTHETIC" || !["OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", "OIC_AUTHORED_INTERNAL_EVALUATION_FIXTURE"].includes(String(rights.rightsBasis)) || rights.reviewedBy !== actor.id || item.sourceDigest === item.oracleDigest || typeof oracle.encryptedArtifactId !== "string" || oracle.artifactId !== undefined || oracle.digest !== item.oracleDigest || typeof input.encryptedArtifactId !== "string" || input.artifactId !== undefined || input.digest !== item.sourceDigest) throw new ConflictException("HOLDOUT_CONTAMINATION_REVIEW_INELIGIBLE");
      await this.artifacts.verifyReference(oracle.encryptedArtifactId, item.oracleDigest, { applicationId: release.applicationId, tenantId: release.tenantId, purpose: "ORACLE", exposureTier: item.exposureTier }, 2);
      await this.artifacts.verifyReference(input.encryptedArtifactId, item.sourceDigest, { applicationId: release.applicationId, tenantId: release.tenantId, purpose: "INPUT", exposureTier: item.exposureTier }, 2);
    }
    const sourceDigests = release.pack.cases.map((item) => item.sourceDigest);
    const overlaps = await this.db.oicEvaluationCaseRevision.count({ where: { applicationId: release.applicationId, sourceDigest: { in: sourceDigests }, id: { notIn: release.pack.cases.map((item) => item.id) } } });
    if (overlaps !== 0) throw new ConflictException("HOLDOUT_LOCAL_SOURCE_OVERLAP");
    const review = await this.db.oicAuditEvent.create({ data: {
      actorPrincipalId: actor.id, applicationId: release.applicationId, tenantId: release.tenantId,
      action: "evaluation.release.contamination_reviewed", targetType: "evaluation-release", targetId: release.id,
      metadata: { releaseDigest: release.manifestDigest, packDigest: release.pack.manifestDigest, caseCount: release.pack.cases.length, localExactSourceOverlaps: 0, scanScope: "LOCAL_REGISTRY_EXACT_DIGEST_V1", protectedOracleReferenceVerified: true, firstPartySynthetic: true }
    } });
    return { releaseId, status: "REVIEWED_NO_KNOWN_LOCAL_OVERLAP", reviewId: review.id };
  }

  async createManifest(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    if (typeof input.releaseId !== "string" || typeof input.targetClass !== "string" || !targetClasses.has(input.targetClass)) throw new BadRequestException("Release and supported target class are required");
    const targetClass = input.targetClass;
    if (targetClass !== "MODEL_WITH_OIC_RUNTIME") throw new ConflictException("TARGET_ADAPTER_UNAVAILABLE");
    if (typeof input.modelId !== "string" || !/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(input.modelId) || typeof input.runtimePrincipalId !== "string" || !uuidPattern.test(input.runtimePrincipalId)) throw new BadRequestException("Protocol requires a pinned runtime target and principal");
    const release = await this.db.oicEvaluationRelease.findFirst({ where: { id: input.releaseId, ...this.requireScope(actor) }, include: { suite: true, environment: true, pack: { select: { createdBy: true } } } });
    if (!release || release.status !== "PUBLISHED" || release.compromisedAt || !release.suite || !release.environment) throw new ConflictException("RELEASE_INVALID");
    if (release.releaseTier === "PRIVATE_HOLDOUT") {
      if (release.pack.createdBy === release.createdBy || !await this.db.oicAuditEvent.findFirst({ where: { applicationId: release.applicationId, action: "evaluation.release.contamination_reviewed", targetType: "evaluation-release", targetId: release.id, actorPrincipalId: release.createdBy }, select: { id: true } })) throw new ConflictException("HOLDOUT_INDEPENDENT_REVIEW_REQUIRED");
    }
    const releaseProtocol = object(release.protocol);
    if (!Array.isArray(releaseProtocol.requiredTargetClasses) || !releaseProtocol.requiredTargetClasses.includes(targetClass)) throw new BadRequestException("TARGET_UNSUPPORTED");
    const payload = object(input.protocol);
    const evaluationPurpose = payload.evaluationPurpose ?? "TARGET_EXECUTION";
    if (evaluationPurpose !== "TARGET_EXECUTION" && evaluationPurpose !== "GRADING_REPLAY") throw new BadRequestException("Protocol evaluation purpose is invalid");
    if (evaluationPurpose === "GRADING_REPLAY" && input.basisDraftId === undefined) throw new ConflictException("GRADING_PROTOCOL_REQUIRES_DISTINCT_PUBLICATION");
    if (evaluationPurpose === "GRADING_REPLAY" && (typeof payload.sourceExecutionManifestId !== "string" || !uuidPattern.test(payload.sourceExecutionManifestId))) throw new BadRequestException("Grading replay protocol must pin its source execution manifest");
    if (input.candidateId !== undefined) {
      const gate = object(payload.preDispatchDecisionGate);
      const gateCheck = validatePredispatchDecisionGate(gate);
      if (!gateCheck.valid) throw new ConflictException("CANDIDATE_PREDISPATCH_GATE_INVALID");
      const candidateSuitePlan = object(release.suite.plan);
      const plannedEvidenceN = (release.caseManifest as unknown[]).length * Number(candidateSuitePlan.plannedRepetitions ?? 0);
      if (!validatePredispatchCohort(gate, plannedEvidenceN).valid) throw new ConflictException("CANDIDATE_PREDISPATCH_GATE_EXCEEDS_COHORT");
    }
    const required = ["harnessRevision", "harnessDigest", "environment", "requiredCapabilities", "oracleRevision", "metricRevisions", "judgeRevisions", "repetitionPolicy", "retryPolicy", "samplingPolicy", "statisticsRevision", "budgetPolicy", "artifactPolicy", "verificationTier"];
    if (required.some((key) => !(key in payload))) throw new BadRequestException("Protocol manifest is missing locked fields");
    const environment = object(payload.environment);
    if (Object.keys(environment).sort().join(",") !== "digest,revisionId" || environment.revisionId !== release.environment.id || environment.digest !== release.environment.definitionDigest) throw new BadRequestException("Protocol environment does not match the published release");
    if (typeof payload.harnessRevision !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(payload.harnessRevision) || typeof payload.harnessDigest !== "string" || !digestPattern.test(payload.harnessDigest) || payload.oracleRevision !== OBJECTIVE_ORACLE_METHOD || typeof payload.statisticsRevision !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(payload.statisticsRevision) || payload.verificationTier !== "OIC_EXECUTED_VERIFIED") throw new BadRequestException("Protocol harness, oracle, statistics or verification identity is invalid");
    if (!Array.isArray(payload.requiredCapabilities) || new Set(payload.requiredCapabilities).size !== payload.requiredCapabilities.length || payload.requiredCapabilities.some((capability) => typeof capability !== "string" || !/^[A-Z][A-Z0-9_]{1,63}$/.test(capability))) throw new BadRequestException("Protocol required capabilities must be a unique typed set");
    const supportedCapabilities = new Set(["MODEL_WITH_OIC_RUNTIME", "TEXT_GENERATION", "OIC6_ADMISSION", "PINNED_PROVIDER_TARGET", "EXECUTABLE_SANDBOX", "SHELL_SCRIPT_V1"]);
    if (payload.requiredCapabilities.some((capability) => !supportedCapabilities.has(capability as string))) throw new ConflictException("REQUIRED_CAPABILITY_UNSUPPORTED");
    const environmentKind = object(release.environment.definition).kind;
    if (environmentKind !== "DETERMINISTIC_REFERENCE" && environmentKind !== "EXECUTABLE_SHELL_V1") throw new ConflictException("ENVIRONMENT_ADAPTER_UNAVAILABLE");
    const executable = environmentKind === "EXECUTABLE_SHELL_V1";
    const capabilitySet = new Set(payload.requiredCapabilities as string[]);
    if (executable !== (capabilitySet.has("EXECUTABLE_SANDBOX") && capabilitySet.has("SHELL_SCRIPT_V1"))) throw new BadRequestException("Executable capability declaration must match the release environment");
    if (!executable && (capabilitySet.has("EXECUTABLE_SANDBOX") || capabilitySet.has("SHELL_SCRIPT_V1"))) throw new BadRequestException("Reference environment cannot claim executable capabilities");
    const retryPolicy = object(payload.retryPolicy);
    const budgetPolicy = object(payload.budgetPolicy);
    if (!Number.isInteger(retryPolicy.maxAttempts) || (retryPolicy.maxAttempts as number) < 1 || (retryPolicy.maxAttempts as number) > 32 || !Number.isInteger(budgetPolicy.maxOutputUnits) || (budgetPolicy.maxOutputUnits as number) < 1 || (budgetPolicy.maxOutputUnits as number) > 65_536 || (budgetPolicy.maxInputUnits !== undefined && (!Number.isInteger(budgetPolicy.maxInputUnits) || (budgetPolicy.maxInputUnits as number) < 1 || (budgetPolicy.maxInputUnits as number) > 1_000_000)) || !Number.isInteger(budgetPolicy.maxExecutionMs) || (budgetPolicy.maxExecutionMs as number) < 1_000 || (budgetPolicy.maxExecutionMs as number) > 300_000 || typeof budgetPolicy.budgetRevisionId !== "string" || !uuidPattern.test(budgetPolicy.budgetRevisionId) || Object.keys(budgetPolicy).some((key) => !["maxInputUnits", "maxOutputUnits", "maxExecutionMs", "budgetRevisionId"].includes(key))) throw new BadRequestException("Protocol retry and hard budget bounds are invalid");
    const now = new Date();
    const budgetRevision = await this.db.oicBudgetRevision.findFirst({ where: {
      id: budgetPolicy.budgetRevisionId, applicationId: release.applicationId, tenantId: release.tenantId,
      status: "PUBLISHED", unit: "OIU", enforcement: "HARD",
      ...(evaluationPurpose === "TARGET_EXECUTION" ? { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } : {})
    }, select: { id: true, sourceDigest: true, reservationUpperBound: true, status: true, unit: true, enforcement: true, effectiveFrom: true, effectiveTo: true } });
    if (!budgetRevision?.reservationUpperBound || !budgetRevision.reservationUpperBound.gt(0)) throw new ConflictException("PROTOCOL_HARD_BUDGET_UNAVAILABLE");
    if (evaluationPurpose === "GRADING_REPLAY") {
      const sourceManifest = await this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: payload.sourceExecutionManifestId as string, applicationId: release.applicationId, tenantId: release.tenantId, releaseId: release.id } });
      const sourcePayload = object(sourceManifest?.payload);
      const sourceBudget = object(sourcePayload.budgetPolicy);
      const sourceRun = sourceManifest ? await this.db.oicEvaluationRun.findFirst({ where: { manifestId: sourceManifest.id, applicationId: release.applicationId, tenantId: release.tenantId, status: "EXECUTED" }, orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true } }) : null;
      const sourceBudgetRevisionId = typeof sourceBudget.budgetRevisionId === "string" ? sourceBudget.budgetRevisionId : "";
      const sourceBudgetDigest = typeof sourceBudget.budgetRevisionDigest === "string" ? sourceBudget.budgetRevisionDigest : "";
      if (!sourceManifest || !sourceRun || sourcePayload.evaluationPurpose === "GRADING_REPLAY" || !historicalHardBudgetSupportsReplay({ sourceManifestId: sourceManifest.id, sourceBudgetRevisionId, sourceBudgetDigest, sourceRunCreatedAt: sourceRun.createdAt, policy: budgetRevision })) throw new ConflictException("GRADING_REPLAY_SOURCE_BUDGET_INVALID");
    }
    const repetitionPolicy = object(payload.repetitionPolicy);
    const samplingPolicy = object(payload.samplingPolicy);
    const suitePlan = object(release.suite.plan);
    if (repetitionPolicy.plannedRepetitions !== suitePlan.plannedRepetitions || !Number.isInteger(repetitionPolicy.plannedRepetitions) || typeof repetitionPolicy.seedRoot !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(repetitionPolicy.seedRoot) || samplingPolicy.mode !== "FULL_SUITE") throw new BadRequestException("Protocol repetition and sampling plan must match the published suite");
    if (payload.cohort !== undefined && !validatePacket76Cohort(payload.cohort, (release.caseManifest as unknown[]).map((item) => String(object(item).caseRevisionId)), Number(repetitionPolicy.plannedRepetitions)).valid) throw new ConflictException("PACKET76_COHORT_PLAN_INVALID");
    if (!Array.isArray(payload.metricRevisions) || !payload.metricRevisions.length || payload.metricRevisions.some((item) => typeof item !== "string" || !uuidPattern.test(item)) || new Set(payload.metricRevisions).size !== payload.metricRevisions.length || !Array.isArray(payload.judgeRevisions) || !payload.judgeRevisions.length || payload.judgeRevisions.some((item) => typeof item !== "string" || !uuidPattern.test(item)) || new Set(payload.judgeRevisions).size !== payload.judgeRevisions.length) throw new BadRequestException("Published metric and judge revision IDs are required");
    const metrics = await this.db.oicEvaluationMetricRevision.findMany({ where: { id: { in: payload.metricRevisions as string[] }, applicationId: release.applicationId, tenantId: release.tenantId, status: "PUBLISHED" }, select: { id: true, definitionDigest: true, metricKey: true, revision: true } });
    const judges = await this.db.oicEvaluationJudgeRevision.findMany({ where: { id: { in: payload.judgeRevisions as string[] }, applicationId: release.applicationId, tenantId: release.tenantId, status: "PUBLISHED" }, select: { id: true, definitionDigest: true, judgeKey: true, revision: true, judgeType: true } });
    if (metrics.length !== payload.metricRevisions.length || judges.length !== payload.judgeRevisions.length) throw new BadRequestException("Metric or judge revision is missing, unpublished, or out of scope");
    assertNoProtocolIdentityOverride(payload);
    const { targetIdentity, targetFingerprint } = await this.resolvePinnedRuntimeTarget(release.applicationId, release.tenantId, input.modelId, input.runtimePrincipalId, budgetPolicy.maxOutputUnits as number, `evaluation-protocol-${release.id}`);
    let candidateRevision: Record<string, unknown> | null = null;
    let candidateTreatmentFingerprint: string | null = null;
    if (input.candidateId !== undefined) {
      if (typeof input.candidateId !== "string" || !uuidPattern.test(input.candidateId)) throw new BadRequestException("Candidate revision ID is invalid");
      const candidate = await this.db.oicEvaluationCandidate.findFirst({ where: { id: input.candidateId, applicationId: release.applicationId, tenantId: release.tenantId, status: "DRAFT", targetClass, changeDigest: { not: "" } } });
      if (!candidate) throw new ConflictException("CANDIDATE_REVISION_UNAVAILABLE");
      const parentRef = Array.isArray(candidate.parentIds) && typeof candidate.parentIds[0] === "string" ? candidate.parentIds[0] : null;
      const [parent, parentManifest] = await Promise.all([
        parentRef ? this.db.oicEvaluationReport.findFirst({ where: { id: parentRef, run: { applicationId: release.applicationId, tenantId: release.tenantId, manifest: { releaseId: release.id } } }, select: { id: true, run: { select: { targetFingerprint: true, targetClass: true } } } }) : null,
        parentRef ? this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: parentRef, applicationId: release.applicationId, tenantId: release.tenantId, releaseId: release.id } }) : null
      ]);
      const creationAudit = await this.db.oicAuditEvent.findFirst({ where: { applicationId: release.applicationId, action: "evaluation.candidate.created", targetType: "evaluation-candidate", targetId: candidate.id }, select: { metadata: true } });
      const auditMetadata = object(creationAudit?.metadata);
      const changeSet = object(auditMetadata.changeSet);
      const reportLineageValid = !!parent && parent.run.targetClass === targetClass && parent.run.targetFingerprint === targetFingerprint && auditMetadata.parentReportId === parent.id;
      const parentProtocol = object(parentManifest?.payload);
      const manifestLineageValid = !!parentManifest && parentManifest.releaseId === release.id && parentManifest.targetClass === targetClass
        && parentProtocol.evaluationPurpose !== "GRADING_REPLAY" && parentProtocol.targetFingerprint === targetFingerprint
        && canonicalJson(parentProtocol.targetIdentity) === canonicalJson(targetIdentity)
        && auditMetadata.parentManifestId === parentManifest.id;
      if ((!reportLineageValid && !manifestLineageValid) || auditMetadata.changeDigest !== candidate.changeDigest || sha256({ type: changeSet.type, instruction: changeSet.instruction }) !== candidate.changeDigest || auditMetadata.targetFingerprint !== candidate.targetFingerprint || candidate.targetFingerprint !== sha256({ parentTargetFingerprint: targetFingerprint, changeDigest: candidate.changeDigest })) throw new ConflictException("CANDIDATE_LINEAGE_INVALID");
      const treatmentFingerprint = candidate.targetFingerprint;
      candidateTreatmentFingerprint = treatmentFingerprint;
      candidateRevision = {
        id: candidate.id,
        ...(parent ? { parentReportId: parent.id } : { parentManifestId: parentManifest!.id }),
        changeDigest: candidate.changeDigest, changeSet, parentTargetFingerprint: targetFingerprint, treatmentFingerprint
      };
      if (parentManifest) {
        const gate = object(payload.preDispatchDecisionGate);
        const cohort = object(payload.cohort);
        if (gate.parentManifestId !== parentManifest.id || gate.parentManifestDigest !== parentManifest.canonicalDigest || gate.cohortKey !== cohort.cohortKey || !validatePredispatchCohort(gate, Number(repetitionPolicy.plannedRepetitions)).valid) throw new ConflictException("CANDIDATE_COHORT_BINDING_INVALID");
      }
    }
    const imageDigest = object(release.environment.definition).imageDigest;
    if (executable && (!this.sandbox || typeof imageDigest !== "string" || (object(release.environment.definition).timeoutMs as number) > (this.config?.get<number>("OIC_EVALUATOR_TIMEOUT_MS") ?? 30_000))) throw new ConflictException("SANDBOX_POLICY_UNAVAILABLE");
    let sandboxEnvironment: Awaited<ReturnType<EvaluationSandboxAdapter["preflight"]>> | "NONE" = "NONE";
    if (executable) {
      try { sandboxEnvironment = await this.sandbox!.preflight(imageDigest as string); }
      catch (error) { throw new ConflictException(error instanceof SandboxUnavailableError ? error.reasonCode : "SANDBOX_UNAVAILABLE"); }
    }
    const basisDraftId = input.basisDraftId;
    let basisDraft: { id: string; createdByPrincipalId: string; payloadDigest: string } | null = null;
    if (basisDraftId !== undefined) {
      if (typeof basisDraftId !== "string" || !uuidPattern.test(basisDraftId)) throw new BadRequestException("Evaluation protocol draft identity is invalid");
      const draft = await this.db.oicEvaluationBasisDraft.findFirst({ where: { id: basisDraftId, applicationId: release.applicationId, tenantId: release.tenantId, kind: "PROTOCOL", status: "DRAFT" } });
      const proposed = { releaseId: input.releaseId, targetClass: input.targetClass, modelId: input.modelId, runtimePrincipalId: input.runtimePrincipalId, protocol: input.protocol, ...(typeof input.candidateId === "string" ? { candidateId: input.candidateId } : {}), ...(typeof input.applicationId === "string" ? { applicationId: input.applicationId } : {}), ...(typeof input.tenantId === "string" ? { tenantId: input.tenantId } : {}) };
      if (!draft || draft.createdByPrincipalId === actor.id || draft.payloadDigest !== sha256(proposed) || sha256(draft.payload) !== draft.payloadDigest) throw new ConflictException("DISTINCT_PROTOCOL_PUBLISHER_REQUIRED");
      basisDraft = draft;
    }
    const normalized = { ...payload, evaluationPurpose, ...(candidateRevision ? { candidateRevision, candidateTreatmentFingerprint } : {}), budgetPolicy: { ...budgetPolicy, budgetRevisionDigest: budgetRevision.sourceDigest, reservationUpperBoundOiu: budgetRevision.reservationUpperBound.toString() }, protocolVersion: "oic-evaluation-v1", targetClass, applicationId: release.applicationId, tenantId: release.tenantId ?? "NONE", releaseId: release.id, releaseDigest: release.manifestDigest, caseSchedule: (release.caseManifest as unknown[]).map((item) => object(item).caseRevisionId), targetIdentity, targetFingerprint, sandboxEnvironment, requiredCapabilities: (payload.requiredCapabilities as string[]).slice().sort(), metricRevisions: metrics.sort((left, right) => left.id.localeCompare(right.id)), judgeRevisions: judges.sort((left, right) => left.id.localeCompare(right.id)) };
    const canonicalDigest = sha256(normalized);
    try {
      const manifest = await this.db.$transaction(async (tx) => {
        const row = await tx.oicEvaluationProtocolManifest.create({ data: { applicationId: release.applicationId, tenantId: release.tenantId, releaseId: release.id, protocolVersion: "oic-evaluation-v1", targetClass, payload: normalized as Prisma.InputJsonValue, canonicalDigest, createdBy: basisDraft?.createdByPrincipalId ?? actor.id } });
        if (basisDraft) {
          const marked = await tx.oicEvaluationBasisDraft.updateMany({ where: { id: basisDraft.id, status: "DRAFT", createdByPrincipalId: { not: actor.id } }, data: { status: "PUBLISHED", publishedByPrincipalId: actor.id, publishedEntityId: row.id, publishedAt: new Date() } });
          if (marked.count !== 1) throw new ConflictException("EVALUATION_BASIS_DRAFT_STATE_CHANGED");
        }
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: release.applicationId, tenantId: release.tenantId, action: "evaluation.protocol.published", targetType: "evaluation-protocol", targetId: row.id, metadata: { canonicalDigest, releaseId: release.id, targetClass, evaluationPurpose, ...(input.candidateId !== undefined ? { preDispatchDecisionGateDigest: sha256(payload.preDispatchDecisionGate) } : {}), authorPrincipalId: basisDraft?.createdByPrincipalId ?? actor.id, publisherPrincipalId: actor.id } } });
        return row;
      });
      return { id: manifest.id, canonicalDigest, targetClass: manifest.targetClass, publishedAt: manifest.publishedAt };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("PROTOCOL_ALREADY_PUBLISHED");
      throw error;
    }
  }

  async startRun(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    if (this.config?.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || !this.runtime) throw new ConflictException("EVALUATOR_WORKER_UNAVAILABLE");
    if (this.config.get<string>("OIC_ADMISSION_MODE") !== "ENFORCE") throw new ConflictException("EVALUATION_HARD_BUDGET_ENFORCEMENT_REQUIRED");
    const readiness = await this.workQueue?.workerReadiness();
    const capabilities = readiness?.capabilities;
    const verified = readiness?.state === "READY" && readiness.fresh
      && capabilities?.database === true && capabilities.durableQueue === true && capabilities.claimFencing === true
      && capabilities.claimLoopAlive === true && capabilities.compatibilityIdentity === "oic-evaluation-worker-readiness-v1"
      && capabilities.artifactWriteKeyVersion === 2 && capabilities.legacyWriteDisabled === true
      && capabilities.artifactEvidence === true && capabilities.artifactFinalization === true
      && capabilities.sealedOracle === true && capabilities.admission === true && capabilities.outboxFinalization === true
      && capabilities.textGeneration === true && Array.isArray(capabilities.supportedTargetClasses)
      && capabilities.supportedTargetClasses.includes("MODEL_WITH_OIC_RUNTIME");
    if (!verified) throw new ConflictException("EVALUATION_EXECUTION_NOT_VERIFIED");
    return this.startRunEnabled(actor, input);
  }

  private async startRunEnabled(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    const { manifestId, modelId, runtimePrincipalId, idempotencyKey } = input;
    if (typeof manifestId !== "string" || !uuidPattern.test(manifestId) || typeof modelId !== "string" || !/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(modelId) || typeof runtimePrincipalId !== "string" || !uuidPattern.test(runtimePrincipalId) || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Invalid evaluation run identity");
    if (typeof input.campaignId !== "string" || !uuidPattern.test(input.campaignId)) throw new BadRequestException("A budgeted campaign ID is required");
    if (Object.keys(input).some((key) => !["manifestId", "modelId", "runtimePrincipalId", "idempotencyKey", "campaignId"].includes(key))) throw new BadRequestException("Run identity is assigned by OIC");
    this.artifacts.assertConfigured();
    const manifest = await this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: manifestId, ...this.requireScope(actor) }, include: { release: { include: { suite: true, environment: true, pack: { select: { createdBy: true } } } } } });
    if (!manifest || manifest.targetClass !== "MODEL_WITH_OIC_RUNTIME" || manifest.release.status !== "PUBLISHED" || manifest.release.compromisedAt || !manifest.release.suite || !manifest.release.environment || manifest.canonicalDigest !== sha256(manifest.payload)) throw new ConflictException("RUN_PROTOCOL_INVALID");
    if (manifest.release.releaseTier === "PRIVATE_HOLDOUT") {
      if (manifest.release.pack.createdBy === manifest.release.createdBy || !await this.db.oicAuditEvent.findFirst({ where: { applicationId: manifest.release.applicationId, action: "evaluation.release.contamination_reviewed", targetType: "evaluation-release", targetId: manifest.release.id, actorPrincipalId: manifest.release.createdBy }, select: { id: true } })) throw new ConflictException("HOLDOUT_INDEPENDENT_REVIEW_REQUIRED");
    }
    const payload = object(manifest.payload);
    if (payload.evaluationPurpose === "GRADING_REPLAY") throw new ConflictException("GRADING_ONLY_PROTOCOL_CANNOT_EXECUTE");
    if (payload.cohort !== undefined && !validatePacket76Cohort(payload.cohort, (manifest.release.caseManifest as unknown[]).map((item) => String(object(item).caseRevisionId)), Number(object(payload.repetitionPolicy).plannedRepetitions)).valid) throw new ConflictException("PACKET76_COHORT_PLAN_INVALID");
    if (payload.candidateRevision !== undefined) {
      const gate = object(payload.preDispatchDecisionGate);
      if (!validatePredispatchDecisionGate(gate).valid) throw new ConflictException("CANDIDATE_PREDISPATCH_GATE_INVALID");
      const minN = Number(gate.minimumEffectiveN);
      const candidateRevision = object(payload.candidateRevision);
      const parentManifestId = candidateRevision.parentManifestId;
      if (typeof parentManifestId === "string" && uuidPattern.test(parentManifestId)) {
        const parentManifest = await this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: parentManifestId, applicationId: manifest.applicationId, tenantId: manifest.tenantId, releaseId: manifest.releaseId } });
        const parentPayload = object(parentManifest?.payload);
        const parentCohort = object(parentPayload.cohort);
        const parentGate = object(parentPayload.preDispatchDecisionGate);
        const parentRun = parentManifest ? await this.db.oicEvaluationRun.findFirst({ where: { manifestId: parentManifest.id, applicationId: manifest.applicationId, tenantId: manifest.tenantId, diagnosticOnly: false, status: "EXECUTED" }, orderBy: [{ createdAt: "desc" }], include: { reports: { orderBy: [{ analysisRevision: "desc" }], take: 1, select: { id: true, status: true, verificationTier: true, decisionEligible: true, resultDigest: true } } } }) : null;
        const parentReport = parentRun?.reports[0];
        const parentDnaRows = parentReport ? await this.db.oicEvaluationDnaMeasurement.findMany({ where: { reportId: parentReport.id, targetClass: parentRun.targetClass, targetFingerprint: parentRun.targetFingerprint, traitKey: "objective_exact_match", availability: "MEASURED" }, select: { id: true, provenance: true } }) : [];
        const parentDna = parentDnaRows.find((row) => object(row.provenance).cohortKey === gate.cohortKey);
        if (!parentManifest || parentManifest.canonicalDigest !== sha256(parentManifest.payload) || parentManifest.canonicalDigest !== gate.parentManifestDigest || gate.parentManifestId !== parentManifest.id || gate.cohortKey !== object(payload.cohort).cohortKey || parentCohort.cohortKey !== gate.cohortKey || candidateRevision.parentTargetFingerprint !== parentPayload.targetFingerprint || !validatePredispatchCohort(gate, Number(object(payload.repetitionPolicy).plannedRepetitions)).valid || !validatePredispatchDecisionGate(parentGate).valid || parentGate.gateKey !== gate.gateKey || parentGate.revision !== gate.revision || parentGate.minimumEffectiveN !== gate.minimumEffectiveN || parentGate.confidenceLevel !== gate.confidenceLevel || canonicalJson(parentGate.criticalSlices) !== canonicalJson(gate.criticalSlices)) throw new ConflictException("CANDIDATE_PREDISPATCH_LINEAGE_INVALID");
        if (!parentRun || parentRun.status !== "EXECUTED" || parentRun.plannedDenominator !== 2 || parentRun.plannedTrials !== 2 || !parentReport || parentReport.status !== "COMPLETE" || parentReport.verificationTier !== "OIC_EXECUTED_VERIFIED" || !parentReport.decisionEligible || !parentDna) throw new ConflictException("CANDIDATE_PREDISPATCH_PARENT_COHORT_INCOMPLETE");
      } else {
        const parentReportId = candidateRevision.parentReportId;
        if (typeof parentReportId !== "string" || !uuidPattern.test(parentReportId)) throw new ConflictException("CANDIDATE_PREDISPATCH_LINEAGE_INVALID");
        const parent = await this.db.oicEvaluationReport.findFirst({
          where: { id: parentReportId, run: { ...this.requireScope(actor), manifest: { releaseId: manifest.releaseId } } },
          include: { regradePass: { include: { bridgeRevision: true, sources: { select: { caseExecutionId: true } } } }, effectiveGradingManifest: { select: { id: true, canonicalDigest: true, payload: true } } }
        });
        const bridge = parent?.regradePass?.bridgeRevision;
        const bridgeEvidence = object(bridge?.validationEvidence);
        const parentGradingProtocol = object(parent?.effectiveGradingManifest?.payload);
        const bridgeTargetId = bridge?.bridgeType === "OPERATIONAL_BUDGET_REBASELINE" ? object(bridgeEvidence.targetManifest).id : object(bridgeEvidence.targetGradingManifest).id;
        const basisDigestMatches = !!parent?.effectiveGradingManifest && parent.effectiveGradingManifest.canonicalDigest === sha256(parentGradingProtocol) && !!bridge && bridge.validationEvidenceDigest === sha256(bridge.validationEvidence) && bridgeTargetId === parent.effectiveGradingManifestId;
        if (!parent || parent.status !== "COMPLETE" || parent.verificationTier !== "OIC_EXECUTED_VERIFIED" || !parent.decisionEligible || !parent.regradePass || parent.regradePass.status !== "COMPLETE" || parent.regradePass.bridgeRevision.status !== "PUBLISHED" || parent.regradePass.bridgeRevision.revokedAt || parent.regradePass.sources.length < minN || new Set(parent.regradePass.sources.map((source) => source.caseExecutionId)).size < minN || !parent.effectiveGradingManifest || !basisDigestMatches) throw new ConflictException("CANDIDATE_PREDISPATCH_DECISION_GATE_UNSATISFIED");
        if (canonicalJson(parentGradingProtocol.metricRevisions) !== canonicalJson(payload.metricRevisions) || canonicalJson(parentGradingProtocol.judgeRevisions) !== canonicalJson(payload.judgeRevisions) || parentGradingProtocol.oracleRevision !== payload.oracleRevision) throw new ConflictException("CANDIDATE_PREDISPATCH_GRADING_BASIS_MISMATCH");
        if (parent.regradePass.bridgeRevision.bridgeType === "OPERATIONAL_BUDGET_REBASELINE" && (gate.parentManifestId !== parent.effectiveGradingManifestId || gate.parentManifestDigest !== parent.effectiveGradingManifest.canonicalDigest || object(bridgeEvidence).result !== "VALID")) throw new ConflictException("CANDIDATE_PREDISPATCH_BUDGET_BASIS_MISMATCH");
      }
    }
    const environment = object(payload.environment);
    if (environment.revisionId !== manifest.release.environment.id || environment.digest !== manifest.release.environment.definitionDigest) throw new ConflictException("RUN_ENVIRONMENT_MISMATCH");
    const environmentDefinition = object(manifest.release.environment.definition);
    if (environmentDefinition.kind !== "DETERMINISTIC_REFERENCE" && environmentDefinition.kind !== "EXECUTABLE_SHELL_V1") throw new ConflictException("ENVIRONMENT_ADAPTER_UNAVAILABLE");
    const executable = environmentDefinition.kind === "EXECUTABLE_SHELL_V1";
    if (executable) {
      if (!this.sandbox || typeof environmentDefinition.imageDigest !== "string" || (environmentDefinition.timeoutMs as number) > (this.config?.get<number>("OIC_EVALUATOR_TIMEOUT_MS") ?? 30_000)) throw new ConflictException("SANDBOX_POLICY_UNAVAILABLE");
      let current: Awaited<ReturnType<EvaluationSandboxAdapter["preflight"]>>;
      try { current = await this.sandbox.preflight(environmentDefinition.imageDigest); }
      catch (error) { throw new ConflictException(error instanceof SandboxUnavailableError ? error.reasonCode : "SANDBOX_UNAVAILABLE"); }
      if (canonicalJson(current) !== canonicalJson(payload.sandboxEnvironment)) throw new ConflictException("SANDBOX_ENVIRONMENT_CHANGED");
    } else if (payload.sandboxEnvironment !== "NONE") throw new ConflictException("RUN_ENVIRONMENT_MISMATCH");
    const requiredCapabilities = payload.requiredCapabilities;
    const supported = new Set(["MODEL_WITH_OIC_RUNTIME", "TEXT_GENERATION", "OIC6_ADMISSION", "PINNED_PROVIDER_TARGET", "EXECUTABLE_SANDBOX", "SHELL_SCRIPT_V1"]);
    if (!Array.isArray(requiredCapabilities) || requiredCapabilities.some((item) => typeof item !== "string" || !supported.has(item))) throw new ConflictException("REQUIRED_CAPABILITY_UNSUPPORTED");
    if (executable !== (requiredCapabilities.includes("EXECUTABLE_SANDBOX") && requiredCapabilities.includes("SHELL_SCRIPT_V1"))) throw new ConflictException("REQUIRED_CAPABILITY_UNSUPPORTED");
    const budget = object(payload.budgetPolicy);
    const retry = object(payload.retryPolicy);
    const repetition = object(payload.repetitionPolicy);
    const sampling = object(payload.samplingPolicy);
    const suitePlan = object(manifest.release.suite.plan);
    const plannedTrials = repetition.plannedRepetitions;
    if (!Number.isInteger(plannedTrials) || (plannedTrials as number) < 1 || (plannedTrials as number) > 100 || plannedTrials !== suitePlan.plannedRepetitions || typeof repetition.seedRoot !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(repetition.seedRoot) || sampling.mode !== "FULL_SUITE" || !Number.isInteger(retry.maxAttempts) || (retry.maxAttempts as number) < 1 || (retry.maxAttempts as number) > 32 || !Number.isInteger(budget.maxOutputUnits) || (budget.maxOutputUnits as number) < 1 || (budget.maxOutputUnits as number) > 65_536 || (budget.maxInputUnits !== undefined && (!Number.isInteger(budget.maxInputUnits) || (budget.maxInputUnits as number) < 1 || (budget.maxInputUnits as number) > 1_000_000)) || !Number.isInteger(budget.maxExecutionMs) || (budget.maxExecutionMs as number) < 1_000 || (budget.maxExecutionMs as number) > 300_000 || (budget.maxExecutionMs as number) > (this.config?.get<number>("OIC_RUNTIME_MAX_EXECUTION_MS") ?? 60_000)) throw new ConflictException("RUN_PLAN_UNSUPPORTED");
    const release = manifest.release;
    const members = Array.isArray(release.caseManifest) ? release.caseManifest.map((item) => object(item).caseRevisionId) : [];
    if (!members.length || members.length * (plannedTrials as number) > 256 || members.some((item) => typeof item !== "string" || !uuidPattern.test(item)) || new Set(members).size !== members.length || JSON.stringify(payload.caseSchedule) !== JSON.stringify(members) || payload.releaseDigest !== release.manifestDigest) throw new ConflictException("RUN_CASE_PLAN_INVALID");
    const cases = await this.db.oicEvaluationCaseRevision.findMany({ where: { id: { in: members as string[] }, applicationId: release.applicationId, tenantId: release.tenantId, status: "PUBLISHED", packId: release.packId }, select: { id: true, sourceDigest: true, oracleDigest: true, exposureTier: true } });
    if (cases.length !== members.length || cases.some((item) => !["PUBLIC", "INTERNAL", "PRIVATE_HOLDOUT", "PROTECTED_CERTIFICATION"].includes(item.exposureTier))) throw new ConflictException("RUN_CASE_UNAVAILABLE");
    if (cases.some((item) => item.exposureTier === "PRIVATE_HOLDOUT" || item.exposureTier === "PROTECTED_CERTIFICATION") && !this.sealedOracle) throw new ConflictException("PROTECTED_VALIDATION_WORKER_UNAVAILABLE");
    const byId = new Map(cases.map((item) => [item.id, item]));
    if ((release.caseManifest as unknown[]).some((entry) => {
      const planned = object(entry);
      const stored = byId.get(planned.caseRevisionId as string);
      return !stored || planned.contentHash !== stored.sourceDigest || planned.oracleHash !== stored.oracleDigest || planned.exposureTier !== stored.exposureTier;
    })) throw new ConflictException("RUN_CASE_DIGEST_MISMATCH");
    const { targetIdentity, targetFingerprint } = await this.resolvePinnedRuntimeTarget(release.applicationId, release.tenantId, modelId, runtimePrincipalId, budget.maxOutputUnits as number, `evaluation-preflight-${idempotencyKey}`);
    if (payload.targetFingerprint !== targetFingerprint || canonicalJson(payload.targetIdentity) !== canonicalJson(targetIdentity)) throw new ConflictException("TARGET_PROTOCOL_MISMATCH");
    const campaignId = input.campaignId;
    const requestHash = sha256({ manifestId, modelId, runtimePrincipalId, campaignId, targetFingerprint });
    const prior = await this.db.oicEvaluationRun.findFirst({ where: { applicationId: release.applicationId, tenantId: release.tenantId, idempotencyKey }, select: { id: true, status: true, requestHash: true, targetFingerprint: true, plannedDenominator: true } });
    if (prior) {
      if (prior.requestHash !== requestHash) throw new ConflictException("RUN_IDEMPOTENCY_CONFLICT");
      return { id: prior.id, status: prior.status, targetFingerprint: prior.targetFingerprint, plannedDenominator: prior.plannedDenominator };
    }
    if (payload.cohort !== undefined && await this.db.oicEvaluationRun.findFirst({ where: { manifestId: manifest.id, applicationId: release.applicationId, tenantId: release.tenantId }, select: { id: true } })) throw new ConflictException("PACKET76_COHORT_RUN_ALREADY_CREATED");
    const campaign = await this.db.oicEvaluationCampaign.findFirst({ where: { id: campaignId, applicationId: release.applicationId, tenantId: release.tenantId, releaseId: release.id, status: "ACTIVE" }, select: { id: true, budgetRevisionId: true, budgetLimitOiu: true, reservationPerAttemptOiu: true, budgetPolicyDigest: true, budgetRevision: { select: { status: true, effectiveFrom: true, effectiveTo: true, sourceDigest: true, reservationUpperBound: true } } } });
    const budgetRevision = campaign?.budgetRevision;
    const now = new Date();
    if (!campaign?.budgetLimitOiu || !campaign.reservationPerAttemptOiu || !budgetRevision || budgetRevision.status !== "PUBLISHED" || budgetRevision.effectiveFrom > now || (budgetRevision.effectiveTo && budgetRevision.effectiveTo <= now) || campaign.budgetRevisionId !== budget.budgetRevisionId || budgetRevision.sourceDigest !== budget.budgetRevisionDigest || campaign.budgetPolicyDigest !== budgetRevision.sourceDigest || budget.reservationUpperBoundOiu !== campaign.reservationPerAttemptOiu.toString() || !budgetRevision.reservationUpperBound?.equals(campaign.reservationPerAttemptOiu)) throw new ConflictException("RUN_CAMPAIGN_HARD_BUDGET_INVALID");
    const reservation = campaign.reservationPerAttemptOiu.mul(members.length).mul(plannedTrials as number).mul(retry.maxAttempts as number);
    if (!reservation.isFinite() || !reservation.gt(0) || reservation.gt(campaign.budgetLimitOiu)) throw new ConflictException("CAMPAIGN_BUDGET_EXHAUSTED");
    try {
      return await this.db.$transaction(async (tx) => {
        const workerReady = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "OicEvaluationSchedulerCursor"
          WHERE "id" = 'EVALUATION' AND "workerState" = 'READY'
            AND "workerLeaseUntil" > clock_timestamp()
            AND "workerCapabilities"->>'database' = 'true'
            AND "workerCapabilities"->>'durableQueue' = 'true'
            AND "workerCapabilities"->>'claimFencing' = 'true'
            AND "workerCapabilities"->>'claimLoopAlive' = 'true'
            AND "workerCapabilities"->>'compatibilityIdentity' = 'oic-evaluation-worker-readiness-v1'
            AND "workerCapabilities"->>'artifactWriteKeyVersion' = '2'
            AND "workerCapabilities"->>'legacyWriteDisabled' = 'true'
            AND "workerCapabilities"->>'artifactEvidence' = 'true'
            AND "workerCapabilities"->>'artifactFinalization' = 'true'
            AND "workerCapabilities"->>'sealedOracle' = 'true'
            AND "workerCapabilities"->>'admission' = 'true'
            AND "workerCapabilities"->>'outboxFinalization' = 'true'
            AND "workerCapabilities"->>'textGeneration' = 'true'
            AND "workerCapabilities"->'supportedTargetClasses' ? 'MODEL_WITH_OIC_RUNTIME'
          FOR SHARE
        `);
        if (workerReady.length !== 1) throw new ConflictException("EVALUATION_EXECUTION_NOT_VERIFIED");
        const reserved = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          UPDATE "OicEvaluationCampaign"
          SET "reservedOiu" = "reservedOiu" + ${reservation.toString()}::numeric
          WHERE "id" = ${campaignId}::uuid AND "applicationId" = ${release.applicationId}::uuid
            AND "status" = 'ACTIVE' AND "budgetRevisionId" = ${campaign.budgetRevisionId}::uuid
            AND "budgetPolicyDigest" = ${campaign.budgetPolicyDigest}
            AND "budgetLimitOiu" - "reservedOiu" >= ${reservation.toString()}::numeric
          RETURNING "id"
        `);
        if (reserved.length !== 1) throw new ConflictException("CAMPAIGN_BUDGET_EXHAUSTED");
        const run = await tx.oicEvaluationRun.create({ data: {
          applicationId: release.applicationId, tenantId: release.tenantId, campaignId,
          manifestId, targetClass: manifest.targetClass, targetFingerprint,
          targetIdentity, requestHash, plannedTrials: plannedTrials as number,
          plannedDenominator: members.length * (plannedTrials as number),
          budgetReservationOiu: reservation, verificationTier: "OIC_EXECUTED_PARTIAL", createdBy: actor.id, idempotencyKey
        } });
        const candidateId = object(payload.candidateRevision).id;
        if (typeof candidateId === "string") {
          const changedCandidate = await tx.oicEvaluationCandidate.updateMany({ where: { id: candidateId, applicationId: run.applicationId, status: "DRAFT" }, data: { status: "EVALUATING" } });
          if (changedCandidate.count !== 1) throw new ConflictException("CANDIDATE_STATE_CHANGED");
          await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.candidate.evaluation_started", targetType: "evaluation-candidate", targetId: candidateId, requestId: idempotencyKey, metadata: { runId: run.id, manifestId, candidateTreatmentFingerprint: String(payload.candidateTreatmentFingerprint) } } });
        }
        for (const caseRevisionId of members as string[]) for (let ordinal = 1; ordinal <= (plannedTrials as number); ordinal += 1) {
          const seed = sha256({ protocol: manifest.canonicalDigest, caseRevisionId, ordinal, seedRoot: repetition.seedRoot });
          const execution = await tx.oicEvaluationCaseExecution.create({ data: { runId: run.id, caseRevisionId, repetitionOrdinal: ordinal, seed } });
          const work = await tx.oicEvaluationWorkItem.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId: run.id, caseExecutionId: execution.id, maxAttempts: retry.maxAttempts as number } });
          await tx.oicEvaluationOutbox.create({ data: {
            applicationId: run.applicationId, tenantId: run.tenantId, runId: run.id,
            eventKey: `${execution.id}:enqueued`, eventType: "EVALUATION_CASE_ENQUEUED",
            payload: { runId: run.id, caseExecutionId: execution.id, workItemId: work.id }
          } });
        }
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.run.started", targetType: "evaluation-run", targetId: run.id, requestId: idempotencyKey, metadata: { manifestId, targetFingerprint, plannedDenominator: run.plannedDenominator, budgetRevisionId: campaign.budgetRevisionId, budgetReservationOiu: reservation.toString() } } });
        return { id: run.id, status: run.status, targetFingerprint, plannedDenominator: run.plannedDenominator };
      }, { timeout: 60_000 });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const prior = await this.db.oicEvaluationRun.findFirst({ where: { applicationId: release.applicationId, tenantId: release.tenantId, idempotencyKey }, select: { id: true, status: true, requestHash: true, targetFingerprint: true, plannedDenominator: true } });
        if (prior?.requestHash === requestHash) return { id: prior.id, status: prior.status, targetFingerprint: prior.targetFingerprint, plannedDenominator: prior.plannedDenominator };
        throw new ConflictException("RUN_IDEMPOTENCY_CONFLICT");
      }
      throw error;
    }
  }

  async cancelRun(actor: AuthenticatedPrincipal, id: string, input: Record<string, unknown>) {
    assertManage(actor);
    if (!uuidPattern.test(id) || typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 1000 || typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)) throw new BadRequestException("Run cancellation requires a bounded reason and idempotency key");
    const run = await this.db.oicEvaluationRun.findFirst({ where: { id, ...this.requireScope(actor) }, select: { id: true, status: true, applicationId: true, tenantId: true } });
    if (!run) throw new NotFoundException();
    if (["CANCEL_PENDING", "CANCELLED", "EXECUTED", "PARTIAL", "FAILED", "BUDGET_BLOCKED", "INCONCLUSIVE", "INVALID_ENVIRONMENT"].includes(run.status)) return { id, status: run.status };
    if (!["QUEUED", "RUNNING"].includes(run.status)) throw new ConflictException("RUN_STATE_INVALID");
    return this.db.$transaction(async (tx) => {
      const changed = await tx.oicEvaluationRun.updateMany({ where: { id, status: run.status }, data: { status: "CANCEL_PENDING" } });
      if (changed.count !== 1) throw new ConflictException("RUN_STATE_CHANGED");
      const pending = await tx.oicEvaluationWorkItem.findMany({ where: { runId: id, status: "PENDING" }, select: { id: true, caseExecutionId: true } });
      for (const work of pending) {
        const cancelled = await tx.oicEvaluationWorkItem.updateMany({ where: { id: work.id, status: "PENDING" }, data: { status: "CANCELLED", completedAt: new Date() } });
        if (cancelled.count !== 1) continue;
        const execution = await tx.oicEvaluationCaseExecution.updateMany({ where: { id: work.caseExecutionId, runId: id, status: "QUEUED" }, data: { status: "CANCELLED", completedAt: new Date(), outcome: { cancellation: "OWNER_REQUESTED" } } });
        if (execution.count !== 1) throw new ConflictException("EVALUATION_CASE_FENCE_MISMATCH");
        await tx.oicEvaluationOutbox.create({ data: {
          applicationId: run.applicationId, tenantId: run.tenantId, runId: id,
          eventKey: `${work.caseExecutionId}:cancelled`, eventType: "EVALUATION_CASE_CANCELLED",
          payload: { runId: id, caseExecutionId: work.caseExecutionId }
        } });
      }
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.run.cancel.requested", targetType: "evaluation-run", targetId: id, requestId: input.idempotencyKey as string, metadata: { reason: (input.reason as string).trim(), pendingCancelled: pending.length } } });
      return { id, status: "CANCEL_PENDING", pendingCancelled: pending.length };
    });
  }

  /** Requeue one logical trial only after its prior physical attempt and OIC-6 liability are reconciled. */
  async retryCase(actor: AuthenticatedPrincipal, runId: string, caseExecutionId: string, input: Record<string, unknown>) {
    assertManage(actor);
    if (this.config?.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || this.config?.get<string>("OIC_ADMISSION_MODE") !== "ENFORCE") throw new ConflictException("EVALUATION_RETRY_EXECUTION_DISABLED");
    const reason = input.reason;
    const idempotencyKey = input.idempotencyKey;
    if (!uuidPattern.test(runId) || !uuidPattern.test(caseExecutionId) || typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Retry requires a run, logical case, bounded reason and idempotency key");
    if (this.workQueue) await this.workQueue.reconcileExpired();
    const eventKey = `${caseExecutionId}:retry:${sha256(idempotencyKey).slice(0, 24)}`;
    return this.db.$transaction(async (tx) => {
      const run = await tx.oicEvaluationRun.findFirst({ where: { id: runId, ...this.requireScope(actor) }, select: { id: true, applicationId: true, tenantId: true, campaignId: true, status: true, budgetReservationOiu: true } });
      if (!run) throw new NotFoundException();
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationWorkItem" WHERE "runId" = ${runId}::uuid AND "caseExecutionId" = ${caseExecutionId}::uuid FOR UPDATE`);
      const lockedWork = locked[0];
      if (!lockedWork || locked.length !== 1) throw new NotFoundException();
      const existing = await tx.oicEvaluationOutbox.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, eventKey }, select: { id: true, runId: true, eventType: true } });
      if (existing) {
        if (existing.runId !== runId || existing.eventType !== "EVALUATION_CASE_ENQUEUED") throw new ConflictException("EVALUATION_RETRY_IDEMPOTENCY_CONFLICT");
        const audit = await tx.oicAuditEvent.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, actorPrincipalId: actor.id, action: "evaluation.case.retry.requested", targetId: caseExecutionId, requestId: idempotencyKey }, select: { metadata: true } });
        if (object(audit?.metadata).reason !== reason.trim()) throw new ConflictException("EVALUATION_RETRY_IDEMPOTENCY_CONFLICT");
        return { runId, caseExecutionId, status: "REQUEUED", replayed: true };
      }
      if (!["RUNNING", "FAILED", "PARTIAL", "BUDGET_BLOCKED", "INCONCLUSIVE"].includes(run.status)) throw new ConflictException("EVALUATION_RETRY_RUN_STATE_INVALID");
      if (await tx.oicEvaluationReport.count({ where: { runId } })) throw new ConflictException("EVALUATION_RETRY_REPORT_ALREADY_PUBLISHED");
      const execution = await tx.oicEvaluationCaseExecution.findFirst({ where: { id: caseExecutionId, runId }, include: { attempts: { orderBy: { attemptOrdinal: "asc" } } } });
      const work = await tx.oicEvaluationWorkItem.findFirst({ where: { id: lockedWork.id, runId, caseExecutionId } });
      if (!execution || !work || !["FAILED", "BUDGET_BLOCKED", "INCONCLUSIVE"].includes(execution.status) || work.status !== "FAILED" || work.leaseOwner || work.leaseUntil || work.attemptCount >= work.maxAttempts || execution.attempts.length !== work.attemptCount) throw new ConflictException("EVALUATION_RETRY_STATE_INVALID");
      const priorEventType = execution.status === "INCONCLUSIVE" ? "EVALUATION_CASE_INCONCLUSIVE" : "EVALUATION_CASE_FAILED";
      const priorEventKey = `${caseExecutionId}:${execution.status === "INCONCLUSIVE" ? "inconclusive" : "failed"}:${work.leaseGeneration}`;
      const priorEvent = await tx.oicEvaluationOutbox.findFirst({ where: { runId, applicationId: run.applicationId, tenantId: run.tenantId, eventKey: priorEventKey, eventType: priorEventType, status: "PUBLISHED" }, select: { id: true } });
      if (!priorEvent) throw new ConflictException("EVALUATION_RETRY_RECONCILIATION_PENDING");
      const eligible = new Set(["WORKER_LEASE_EXPIRED", "ADMISSION_RECONCILIATION_REQUIRED", "SANDBOX_UNAVAILABLE", "UPSTREAM_TIMEOUT", "PROVIDER_UNAVAILABLE", "PROVIDER_STREAM_INTERRUPTED", "RUNTIME_UNAVAILABLE", "ADMISSION_BUSY", "BUDGET_BLOCKED"]);
      const latest = execution.attempts.at(-1);
      if (!latest || !["INFRA_FAILURE", "BUDGET_BLOCKED"].includes(latest.status) || !latest.failureClass || !eligible.has(latest.failureClass) || execution.attempts.some((attempt) => !["INFRA_FAILURE", "BUDGET_BLOCKED"].includes(attempt.status) || attempt.artifactManifest || attempt.evidenceDigest)) throw new ConflictException("EVALUATION_RETRY_FAILURE_INELIGIBLE");
      const settledAdmissions: string[] = [];
      for (const attempt of execution.attempts) {
        const admission = await tx.oicAdmission.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, ...(attempt.admissionId ? { OR: [{ id: attempt.admissionId }, { idempotencyKey: `evaluation-attempt:${attempt.id}` }] } : { idempotencyKey: `evaluation-attempt:${attempt.id}` }) }, select: { id: true, status: true } });
        if (admission && !["DENIED", "RELEASED", "SETTLED"].includes(admission.status)) throw new ConflictException("EVALUATION_RETRY_ADMISSION_UNRESOLVED");
        if (!admission && attempt.admissionId) throw new ConflictException("EVALUATION_RETRY_ADMISSION_UNRESOLVED");
        if (admission?.status === "SETTLED") settledAdmissions.push(admission.id);
      }
      if (!run.campaignId || !run.budgetReservationOiu) throw new ConflictException("EVALUATION_RETRY_BUDGET_UNAVAILABLE");
      const campaign = await tx.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId, status: "ACTIVE" }, select: { reservationPerAttemptOiu: true, budgetRevisionId: true } });
      const bound = campaign?.reservationPerAttemptOiu;
      if (!bound || !campaign.budgetRevisionId || execution.unusedReservationReleasedOiu.lt(bound)) throw new ConflictException("EVALUATION_RETRY_BUDGET_UNAVAILABLE");
      const policy = await tx.oicBudgetRevision.findFirst({ where: { id: campaign.budgetRevisionId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { status: true, enforcement: true, unit: true, reservationUpperBound: true, effectiveFrom: true, effectiveTo: true } });
      const now = new Date();
      if (!policy || policy.status !== "PUBLISHED" || policy.enforcement !== "HARD" || policy.unit !== "OIU" || !policy.reservationUpperBound?.equals(bound) || policy.effectiveFrom > now || (policy.effectiveTo && policy.effectiveTo <= now)) throw new ConflictException("EVALUATION_RETRY_BUDGET_UNAVAILABLE");
      for (const admissionId of settledAdmissions) {
        const legs = await tx.oicReservationLeg.findMany({ where: { admissionId, budgetRevisionId: campaign.budgetRevisionId }, select: { amount: true, state: true } });
        const leg = legs[0];
        if (legs.length !== 1 || !leg || !leg.amount.equals(bound) || !["SETTLED", "RELEASED"].includes(leg.state)) throw new ConflictException("EVALUATION_RETRY_ADMISSION_UNRESOLVED");
      }
      const reserved = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationCampaign" SET "reservedOiu" = "reservedOiu" + ${bound.toString()}::numeric
        WHERE "id" = ${run.campaignId}::uuid AND "status" = 'ACTIVE'
          AND "budgetLimitOiu" - "reservedOiu" >= ${bound.toString()}::numeric
        RETURNING "id"
      `);
      if (reserved.length !== 1) throw new ConflictException("CAMPAIGN_BUDGET_EXHAUSTED");
      await tx.oicEvaluationRun.update({ where: { id: runId }, data: { status: "RUNNING", completedAt: null, budgetReleasedOiu: { decrement: bound } } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: caseExecutionId }, data: { status: "QUEUED", outcome: Prisma.DbNull, completedAt: null, unusedReservationReleasedOiu: { decrement: bound } } });
      await tx.oicEvaluationWorkItem.update({ where: { id: work.id }, data: { status: "PENDING", lastFailureClass: null, completedAt: null, availableAt: new Date() } });
      await tx.oicEvaluationOutbox.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId, eventKey, eventType: "EVALUATION_CASE_ENQUEUED", payload: { runId, caseExecutionId, workItemId: work.id } } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.case.retry.requested", targetType: "evaluation-case", targetId: caseExecutionId, requestId: idempotencyKey, metadata: { reason: reason.trim(), runId, priorAttemptId: latest.id, nextPhysicalAttemptOrdinal: work.attemptCount + 1, reservedOiu: bound.toString(), stochasticRepetitionOrdinal: execution.repetitionOrdinal } } });
      return { runId, caseExecutionId, status: "REQUEUED", replayed: false };
    });
  }

  /** One owner-authorized Packet 7.6 replacement for an unusable cohort slot. This is separate from protocol retries. */
  async replacePacket76Observation(actor: AuthenticatedPrincipal, runId: string, caseExecutionId: string, input: Record<string, unknown>) {
    assertManage(actor);
    if (this.config?.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || this.config?.get<string>("OIC_ADMISSION_MODE") !== "ENFORCE") throw new ConflictException("PACKET76_CONTINGENCY_EXECUTION_DISABLED");
    const reason = input.reason;
    const idempotencyKey = input.idempotencyKey;
    if (Object.keys(input).some((key) => !["reason", "idempotencyKey"].includes(key)) || !uuidPattern.test(runId) || !uuidPattern.test(caseExecutionId) || typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("A bounded Packet 7.6 replacement reason and idempotency key are required");
    let diagnosticStage = "expired-admission-reconcile";
    try {
      if (this.workQueue) await this.workQueue.reconcileExpired();
      diagnosticStage = "transaction-start";
      return await this.db.$transaction(async (tx) => {
      diagnosticStage = "load-run";
      const run = await tx.oicEvaluationRun.findFirst({
        where: { id: runId, ...this.requireScope(actor) },
        select: { id: true, applicationId: true, tenantId: true, campaignId: true, status: true, budgetReservationOiu: true, manifest: { select: { id: true, canonicalDigest: true, payload: true, release: { select: { id: true, status: true, compromisedAt: true, caseManifest: true } } } } }
      });
      if (!run) throw new NotFoundException();
      const protocol = object(run.manifest.payload);
      const cohort = object(protocol.cohort);
      const cases = Array.isArray(run.manifest.release.caseManifest) ? run.manifest.release.caseManifest.map((item) => String(object(item).caseRevisionId)) : [];
      if (!run.campaignId || !run.budgetReservationOiu || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt || run.manifest.canonicalDigest !== sha256(protocol) || !validatePacket76Cohort(cohort, cases, Number(object(protocol.repetitionPolicy).plannedRepetitions)).valid) throw new ConflictException("PACKET76_CONTINGENCY_PROTOCOL_INVALID");
      diagnosticStage = "lock-work-item";
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationWorkItem" WHERE "runId" = ${runId}::uuid AND "caseExecutionId" = ${caseExecutionId}::uuid FOR UPDATE`);
      if (locked.length !== 1) throw new NotFoundException();
      diagnosticStage = "load-execution-and-work";
      const execution = await tx.oicEvaluationCaseExecution.findFirst({ where: { id: caseExecutionId, runId }, include: { attempts: { orderBy: { attemptOrdinal: "asc" } } } });
      const work = await tx.oicEvaluationWorkItem.findUnique({ where: { id: locked[0]!.id } });
      if (!execution || !work) throw new NotFoundException();
      diagnosticStage = "check-idempotency-audit";
      const existing = await tx.oicAuditEvent.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, actorPrincipalId: actor.id, action: "evaluation.case.contingency.requested", targetType: "evaluation-case", targetId: caseExecutionId, requestId: idempotencyKey }, select: { metadata: true } });
      if (existing) {
        const metadata = object(existing.metadata);
        if (metadata.reason !== reason.trim() || metadata.cohortKey !== cohort.cohortKey) throw new ConflictException("PACKET76_CONTINGENCY_IDEMPOTENCY_CONFLICT");
        return { runId, caseExecutionId, status: "REQUEUED", contingency: true, replayed: true };
      }
      diagnosticStage = "check-report-state";
      if (await tx.oicEvaluationReport.count({ where: { runId } }) > 0) throw new ConflictException("PACKET76_CONTINGENCY_REPORT_ALREADY_PUBLISHED");
      if (!["PARTIAL", "INCONCLUSIVE"].includes(run.status) || execution.status !== "INCONCLUSIVE" || work.status !== "FAILED" || work.leaseOwner || work.leaseUntil || work.maxAttempts !== 1 || work.attemptCount !== 1 || execution.attempts.length !== 1) throw new ConflictException("PACKET76_CONTINGENCY_SLOT_STATE_INVALID");
      const original = execution.attempts[0]!;
      if (original.status !== "INFRA_FAILURE" || original.failureClass !== "RUNTIME_UNAVAILABLE" || original.artifactManifest || original.evidenceDigest || !original.admissionId || !original.budgetReconciledAt) throw new ConflictException("PACKET76_CONTINGENCY_OBSERVATION_NOT_UNUSABLE");
      diagnosticStage = "check-prior-provider-attempts";
      const priorProviderAttempts = await tx.oicProviderAttempt.count({ where: { admissionId: original.admissionId } });
      diagnosticStage = "load-original-admission";
      const admission = await tx.oicAdmission.findFirst({ where: { id: original.admissionId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, status: true, legs: { select: { amount: true, state: true, budgetRevisionId: true } } } });
      if (!admission || admission.status !== "RELEASED" || admission.legs.length !== 1 || admission.legs[0]?.state !== "RELEASED" || priorProviderAttempts !== 0) throw new ConflictException("PACKET76_CONTINGENCY_ADMISSION_UNRESOLVED");
      diagnosticStage = "load-active-campaign";
      const campaign = await tx.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId, status: "ACTIVE" }, select: { id: true, budgetLimitOiu: true, reservedOiu: true, reservationPerAttemptOiu: true, budgetRevisionId: true, budgetRevision: { select: { status: true, enforcement: true, unit: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true, reservationUpperBound: true } } } });
      const bound = campaign?.reservationPerAttemptOiu;
      if (!campaign || !campaign.budgetLimitOiu || !bound || !campaign.budgetRevision || campaign.budgetRevision.status !== "PUBLISHED" || campaign.budgetRevision.enforcement !== "HARD" || campaign.budgetRevision.unit !== "OIU" || campaign.budgetRevision.unknownLiabilityRule !== "DENY" || campaign.budgetRevision.effectiveFrom > new Date() || (campaign.budgetRevision.effectiveTo && campaign.budgetRevision.effectiveTo <= new Date()) || !campaign.budgetRevision.reservationUpperBound?.equals(bound) || admission.legs[0]?.budgetRevisionId !== campaign.budgetRevisionId || !original.budgetReleasedOiu.equals(bound) || !admission.legs[0].amount.equals(bound) || !campaign.budgetLimitOiu.minus(campaign.reservedOiu).gte(bound)) throw new ConflictException("PACKET76_CONTINGENCY_HARD_BUDGET_INVALID");
      const slotIdentity = Array.isArray(cohort.slots) ? cohort.slots.map(object).find((item) => item.caseRevisionId === execution.caseRevisionId && item.repetitionOrdinal === execution.repetitionOrdinal) : undefined;
      if (!slotIdentity || typeof slotIdentity.pairKey !== "string") throw new ConflictException("PACKET76_CONTINGENCY_SLOT_IDENTITY_INVALID");
      diagnosticStage = "check-cohort-contingency-limit";
      const priorContingencies = await tx.oicAuditEvent.findMany({ where: { applicationId: run.applicationId, action: "evaluation.case.contingency.requested", targetType: "evaluation-case" }, select: { metadata: true } });
      if (priorContingencies.some((item) => object(item.metadata).cohortKey === cohort.cohortKey)) throw new ConflictException("PACKET76_CONTINGENCY_ALREADY_USED");
      diagnosticStage = "verify-inconclusive-projection";
      const events = await tx.oicEvaluationOutbox.findMany({ where: { runId, eventType: "EVALUATION_CASE_INCONCLUSIVE", status: "PUBLISHED", payload: { path: ["caseExecutionId"], equals: caseExecutionId } }, select: { id: true }, take: 2 });
      if (events.length !== 1) throw new ConflictException("PACKET76_CONTINGENCY_PROJECTION_NOT_RECONCILED");
      diagnosticStage = "reserve-campaign-budget";
      const reserved = await tx.oicEvaluationCampaign.updateMany({ where: { id: campaign.id, status: "ACTIVE", budgetLimitOiu: { gte: campaign.reservedOiu.plus(bound) } }, data: { reservedOiu: { increment: bound } } });
      if (reserved.count !== 1) throw new ConflictException("CAMPAIGN_BUDGET_EXHAUSTED");
      diagnosticStage = "write-contingency-audit";
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.case.contingency.requested", targetType: "evaluation-case", targetId: caseExecutionId, requestId: idempotencyKey, metadata: { runId, cohortKey: String(cohort.cohortKey), pairKey: slotIdentity.pairKey, repetitionOrdinal: execution.repetitionOrdinal, originalAttemptId: original.id, admissionId: admission.id, reservedOiu: bound.toString(), reason: reason.trim(), replacementPhysicalOrdinal: work.attemptCount + 1, providerAttemptCountBeforeReplacement: 0 } } });
      diagnosticStage = "extend-run-reservation";
      await tx.oicEvaluationRun.update({ where: { id: runId }, data: { status: "RUNNING", completedAt: null, budgetReservationOiu: { increment: bound } } });
      diagnosticStage = "requeue-work-item";
      await tx.oicEvaluationCaseExecution.update({ where: { id: caseExecutionId }, data: { status: "QUEUED", outcome: Prisma.DbNull, completedAt: null } });
      await tx.oicEvaluationWorkItem.update({ where: { id: work.id }, data: { status: "PENDING", maxAttempts: 2, lastFailureClass: null, completedAt: null, availableAt: new Date() } });
      const eventKey = `${caseExecutionId}:contingency:${sha256(idempotencyKey).slice(0, 24)}`;
      diagnosticStage = "write-enqueue-outbox";
      await tx.oicEvaluationOutbox.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId, eventKey, eventType: "EVALUATION_CASE_ENQUEUED", payload: { runId, caseExecutionId, workItemId: work.id } } });
      return { runId, caseExecutionId, status: "REQUEUED", contingency: true, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const exceptionClass = error instanceof Error ? error.constructor.name : "UnknownError";
      const errorCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{2,32}$/.test(error.code) ? error.code : undefined;
      process.stderr.write(`${JSON.stringify({ event: "evaluation.packet76.contingency_failed", requestId: idempotencyKey, stage: diagnosticStage, exceptionClass, errorCode })}\n`);
      throw error;
    }
  }

  /** Authorize the single audited Packet 7.6 recovery generation. */
  async retryPacket76ContingencyInfrastructure(actor: AuthenticatedPrincipal, runId: string, caseExecutionId: string, input: Record<string, unknown>) {
    assertManage(actor);
    if (this.config?.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || this.config?.get<string>("OIC_ADMISSION_MODE") !== "ENFORCE") throw new ConflictException("PACKET76_CONTINGENCY_EXECUTION_DISABLED");
    const reason = input.reason;
    const idempotencyKey = input.idempotencyKey;
    if (Object.keys(input).some((key) => !["reason", "idempotencyKey"].includes(key)) || !uuidPattern.test(runId) || !uuidPattern.test(caseExecutionId) || typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("A bounded infrastructure-recovery reason and idempotency key are required");
    let failureStage = "RECOVERY_REQUEST_VALIDATED";
    try {
      failureStage = "RECONCILE_EXPIRED_WORK";
      if (this.workQueue) await this.workQueue.reconcileExpired();
      failureStage = "AUTHORIZE_EXECUTION_RECOVERY";
      return await this.authorizePacket76RecoveryGeneration(actor, runId, caseExecutionId, reason.trim(), idempotencyKey, (stage) => { failureStage = stage; });
    } catch (error) {
      const errorType = error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.constructor.name) ? error.constructor.name : "UnknownError";
      const errorCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{2,32}$/.test(error.code) ? error.code : undefined;
      const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
      const meta = typeof record.meta === "object" && record.meta !== null ? record.meta as Record<string, unknown> : {};
      const nested = typeof meta.cause === "object" && meta.cause !== null ? meta.cause as Record<string, unknown> : {};
      const dbMessage = [error instanceof Error ? error.message : "", typeof meta.message === "string" ? meta.message : "", typeof meta.cause === "string" ? meta.cause : "", typeof nested.message === "string" ? nested.message : ""].join(" ");
      const sqlState = /Code:\s*([A-Z0-9]{5})/.exec(dbMessage)?.[1] ?? (typeof meta.code === "string" && /^[A-Z0-9]{5}$/.test(meta.code) ? meta.code : undefined);
      const constraint = /constraint[\s"']+([A-Za-z][A-Za-z0-9_]{0,95})["']?/i.exec(dbMessage)?.[1];
      const safeCause = /execution recovery generation source is ineligible/i.test(dbMessage) ? "RECOVERY_GENERATION_SOURCE_INELIGIBLE" : /recovery generation lacks matching authorization audit/i.test(dbMessage) ? "RECOVERY_GENERATION_AUDIT_MISMATCH" : /recovery generation has unresolved provider or admission evidence/i.test(dbMessage) ? "RECOVERY_GENERATION_UNRESOLVED_EVIDENCE" : sqlState === "23514" ? "DATABASE_CHECK_CONSTRAINT" : sqlState === "23505" ? "DATABASE_UNIQUE_CONSTRAINT" : sqlState === "23503" ? "DATABASE_FOREIGN_KEY" : /error occurred during query execution/i.test(dbMessage) ? "QUERY_EXECUTION_FAILURE" : undefined;
      const fingerprint = createHash("sha256").update(`${errorType}|${errorCode ?? ""}|${failureStage}|${sqlState ?? ""}|${constraint ?? ""}|${safeCause ?? "UNCLASSIFIED"}`).digest("hex").slice(0, 24);
      process.stderr.write(`${JSON.stringify({ event: "evaluation.packet76.recovery_authorization_failed", requestId: idempotencyKey, stage: failureStage, errorType, ...(errorCode ? { errorCode } : {}), prismaMetaKeys: Object.keys(meta).sort(), prismaMetaModel: typeof meta.modelName === "string" && /^[A-Za-z][A-Za-z0-9]{0,80}$/.test(meta.modelName) ? meta.modelName : undefined, nestedCauseKeys: Object.keys(nested).sort(), sqlState, constraint, safeCause, fingerprint })}\n`);
      throw error;
    }
  }

  async resumePacket76RecoveryAfterPreDispatchFix(actor: AuthenticatedPrincipal, runId: string, caseExecutionId: string, input: Record<string, unknown>) {
    assertManage(actor);
    if (runId !== PACKET76_APPROVED_SCOPE.runId || caseExecutionId !== "e2475eb2-8aeb-475a-b3a7-a54144c4b8fa"
      || actor.applicationId !== PACKET76_APPROVED_SCOPE.applicationId || Object.keys(input).some((key) => !["reason", "idempotencyKey"].includes(key))) throw new NotFoundException();
    const reason = input.reason;
    const idempotencyKey = input.idempotencyKey;
    const firstResumeReason = "Resume the already-authorized Packet 7.6 generation after repairing the diagnosed preflight lifecycle constraint.";
    const secondResumeReason = "Resume the already-authorized Packet 7.6 generation after restoring its bounded OIC-6 entitlement and exact extension-budget resolution.";
    const thirdResumeReason = "Resume the already-authorized Packet 7.6 Generation 3 for one additional pre-dispatch attempt with durable safe failure diagnostics after attempt 12 did not capture the operation-level cause.";
    const fourthResumeReason = "Resume the already-authorized Packet 7.6 Generation 3 for its final bounded attempt after correcting the deferred OIC-6 capacity guard to accept the canonical native.invoke.v1 operation.";
    const validResumeRequest = (reason === firstResumeReason && idempotencyKey === "p76-execution-recovery-generation-02-resume-20261016")
      || (reason === secondResumeReason && idempotencyKey === "p76-execution-recovery-generation-02-resume-20261016-attempt-10")
      || (reason === thirdResumeReason && idempotencyKey === "p76-execution-recovery-generation-03-resume-20261016-attempt-12-diagnostics")
      || (reason === fourthResumeReason && idempotencyKey === "p76-execution-recovery-generation-03-resume-20261016-attempt-13-admission-fix");
    if (typeof reason !== "string" || typeof idempotencyKey !== "string" || !validResumeRequest) throw new BadRequestException("The bounded Packet 7.6 recovery-resume authorization is invalid");
    const resumeGenerationOrdinal = idempotencyKey.includes("generation-03") ? 3 : 2;
    const readiness = this.workQueue ? await this.workQueue.workerReadiness() : null;
    if (!readiness || readiness.state !== "READY" || !readiness.fresh || readiness.availableExecutionSlots < 1) throw new ConflictException("PACKET76_RECOVERY_WORKER_NOT_READY");
    return this.db.$transaction(async (tx) => {
      const replay = await tx.oicAuditEvent.findFirst({ where: { applicationId: PACKET76_APPROVED_SCOPE.applicationId, actorPrincipalId: actor.id, action: "evaluation.packet76.recovery_generation.resumed_after_pre_dispatch_fix", requestId: idempotencyKey }, select: { metadata: true } });
      if (replay) {
        if (object(replay.metadata).reason !== reason.trim() || object(replay.metadata).caseExecutionId !== caseExecutionId) throw new ConflictException("PACKET76_RECOVERY_RESUME_IDEMPOTENCY_CONFLICT");
        const generationId = object(replay.metadata).generationId;
        const generation = typeof generationId === "string" ? await tx.oicEvaluationRecoveryGeneration.findUnique({ where: { id: generationId }, select: { id: true, generationOrdinal: true, status: true, usedPhysicalAttempts: true, maxPhysicalAttempts: true } }) : null;
        if (!generation) throw new ConflictException("PACKET76_RECOVERY_RESUME_AUDIT_WITHOUT_GENERATION");
        return { runId, caseExecutionId, recoveryGeneration: generation, replayed: true };
      }

      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationWorkItem" WHERE "runId" = ${runId}::uuid AND "caseExecutionId" = ${caseExecutionId}::uuid FOR UPDATE`);
      if (locked.length !== 1) throw new NotFoundException();
      const [run, work, execution, generation] = await Promise.all([
        tx.oicEvaluationRun.findFirst({ where: { id: runId, applicationId: actor.applicationId, campaignId: PACKET76_APPROVED_SCOPE.campaignId, diagnosticOnly: false }, select: { id: true, applicationId: true, tenantId: true, campaignId: true, status: true, manifest: { select: { payload: true, canonicalDigest: true, release: { select: { status: true, compromisedAt: true } } } } } }),
        tx.oicEvaluationWorkItem.findUnique({ where: { id: locked[0]!.id } }),
        tx.oicEvaluationCaseExecution.findFirst({ where: { id: caseExecutionId, runId }, include: { attempts: { orderBy: { attemptOrdinal: "asc" } } } }),
        tx.oicEvaluationRecoveryGeneration.findFirst({ where: { workItemId: locked[0]!.id, runId, generationOrdinal: resumeGenerationOrdinal, authorizationId: resumeGenerationOrdinal === 3 ? PACKET76_APPROVED_SCOPE.thirdExecutionRecoveryAuthorizationId : PACKET76_APPROVED_SCOPE.executionRecoveryAuthorizationId } })
      ]);
      const protocol = object(run?.manifest.payload);
      const cohort = object(protocol.cohort);
      const slot = Array.isArray(cohort.slots) ? cohort.slots.map(object).find((item) => item.caseRevisionId === execution?.caseRevisionId && item.repetitionOrdinal === 2) : undefined;
      const used = generation?.usedPhysicalAttempts ?? 0;
      const generationAnchorOrdinal = 5 + (resumeGenerationOrdinal - 1) * 3;
      const expectedAttemptOrdinal = generationAnchorOrdinal + used;
      const attempt = execution?.attempts.find((item) => item.attemptOrdinal === expectedAttemptOrdinal);
      const diagnosticCapture = resumeGenerationOrdinal === 3 && used === 2 && attempt ? await tx.oicAuditEvent.findFirst({ where: { applicationId: PACKET76_APPROVED_SCOPE.applicationId, tenantId: run?.tenantId, action: "evaluation.worker.failure_diagnostic.captured", targetType: "evaluation-attempt", targetId: attempt.id }, select: { metadata: true } }) : null;
      const expectedReason = used === 1 ? firstResumeReason : secondResumeReason;
      const expectedKey = used === 1 ? "p76-execution-recovery-generation-02-resume-20261016" : "p76-execution-recovery-generation-02-resume-20261016-attempt-10";
      const expectedFailure = resumeGenerationOrdinal === 3
        ? (used === 1 || used === 2) && attempt?.failureStage === "MODEL_RESOLUTION" && attempt.safeErrorCode === "UNKNOWN_EXCEPTION" && attempt.safeErrorType === "PrismaClientUnknownRequestError"
          && (used === 1 || object(diagnosticCapture?.metadata).safeStackFrame === "oic-api/dist/modules/admission/admission.service.js:58:24")
        : used === 1
        ? attempt?.failureStage === "EPM_RESOLUTION" && attempt.safeErrorCode === "PRISMA_P2010" && attempt.safeErrorType === "PrismaClientKnownRequestError"
        : attempt?.failureStage === "MODEL_RESOLUTION" && attempt.safeErrorCode === "UNKNOWN_EXCEPTION" && attempt.safeErrorType === "PrismaClientUnknownRequestError";
      const runStatusValid = run && (resumeGenerationOrdinal === 3 ? ["RUNNING", "PARTIAL", "INCONCLUSIVE"].includes(run.status) : run.status === "RUNNING");
      const expectedGenerationReason = resumeGenerationOrdinal === 3 ? (used === 1 ? thirdResumeReason : fourthResumeReason) : expectedReason;
      const expectedGenerationKey = resumeGenerationOrdinal === 3 ? (used === 1 ? "p76-execution-recovery-generation-03-resume-20261016-attempt-12-diagnostics" : "p76-execution-recovery-generation-03-resume-20261016-attempt-13-admission-fix") : expectedKey;
      if (!run || !runStatusValid || run.campaignId !== PACKET76_APPROVED_SCOPE.campaignId
        || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt || run.manifest.canonicalDigest !== sha256(protocol)
        || cohort.cohortKey !== PACKET76_APPROVED_SCOPE.cohortKey || !slot || typeof slot.pairKey !== "string"
        || !work || work.status !== "FAILED" || work.attemptCount !== expectedAttemptOrdinal || work.maxAttempts !== generationAnchorOrdinal + 3 || work.leaseOwner || work.leaseUntil
        || !execution || execution.repetitionOrdinal !== 2 || execution.status !== "FAILED" || execution.leaseOwner || execution.leaseUntil
        || execution.attempts.length !== expectedAttemptOrdinal || !attempt || !expectedFailure || reason !== expectedGenerationReason || idempotencyKey !== expectedGenerationKey
        || attempt.status !== "INFRA_FAILURE" || attempt.failureClass !== "EVALUATION_WORKER_FAILURE" || attempt.lifecycleStage !== "FAILED"
        || attempt.admissionId || attempt.providerAttemptId || attempt.providerDispatchStartedAt || attempt.artifactManifest || attempt.evidenceDigest
        || !generation || generation.status !== "CLOSED" || generation.usedPhysicalAttempts !== used || ![1, 2].includes(generation.usedPhysicalAttempts) || generation.usedPhysicalAttempts >= generation.maxPhysicalAttempts || generation.maxPhysicalAttempts !== 3
        || generation.previousAttemptId !== execution.attempts.find((item) => item.attemptOrdinal === generationAnchorOrdinal)?.id
        || generation.pairKey !== slot.pairKey || generation.cohortKey !== cohort.cohortKey || generation.repetitionOrdinal !== 2
        || execution.attempts.some((item) => item.providerAttemptId || item.providerDispatchStartedAt || item.artifactManifest || item.evidenceDigest)) throw new ConflictException("PACKET76_RECOVERY_RESUME_PRECONDITION_INVALID");

      const unresolvedAdmission = await tx.oicAdmission.findFirst({ where: { idempotencyKey: `evaluation-attempt:${attempt.id}` }, select: { id: true, status: true } });
      if (unresolvedAdmission || await tx.oicProviderAttempt.count({ where: { admission: { idempotencyKey: `evaluation-attempt:${attempt.id}` } } }) !== 0) throw new ConflictException("PACKET76_RECOVERY_RESUME_UNRESOLVED_ADMISSION");

      const closure = await tx.oicAuditEvent.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.packet76.recovery_generation.closed", targetType: "evaluation-recovery-generation", targetId: generation.id }, orderBy: { occurredAt: "desc" }, select: { metadata: true } });
      if (object(closure?.metadata).closure !== "NON_RECOVERABLE_OR_PROVIDER_BOUNDARY" || object(closure?.metadata).terminalAttemptId !== attempt.id
        || Number(object(closure?.metadata).usedPhysicalAttempts) !== generation.usedPhysicalAttempts
        || object(closure?.metadata).providerDispatchStarted !== false || Number(object(closure?.metadata).providerAttemptCount) !== 0) throw new ConflictException("PACKET76_RECOVERY_RESUME_CLOSURE_EVIDENCE_INVALID");

      const staleEventKey = `${caseExecutionId}:failed:${work.leaseGeneration}`;
      const staleLock = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationOutbox" WHERE "runId" = ${runId}::uuid AND "eventKey" = ${staleEventKey} FOR UPDATE`);
      if (staleLock.length !== 1) throw new ConflictException("PACKET76_RECOVERY_RESUME_TERMINAL_OUTBOX_MISSING");
      const staleEvent = await tx.oicEvaluationOutbox.findUnique({ where: { id: staleLock[0]!.id }, select: { id: true, eventKey: true, eventType: true, status: true, attemptCount: true, leaseOwner: true, publishedAt: true, payload: true } });
      if (!staleEvent || staleEvent.eventType !== "EVALUATION_CASE_FAILED" || staleEvent.status === "PUBLISHED" || staleEvent.status === "LEASED"
        || staleEvent.publishedAt || staleEvent.leaseOwner || object(staleEvent.payload).caseExecutionId !== caseExecutionId) throw new ConflictException("PACKET76_RECOVERY_RESUME_TERMINAL_OUTBOX_INVALID");

      const generationResumeAuditId = randomUUID();
      await tx.oicAuditEvent.create({ data: { id: generationResumeAuditId, actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.packet76.recovery_generation.resumed_after_pre_dispatch_fix", targetType: "evaluation-recovery-generation", targetId: generation.id, requestId: idempotencyKey, metadata: { reason: reason.trim(), generationId: generation.id, generationOrdinal: resumeGenerationOrdinal, runId, workItemId: work.id, caseExecutionId, cohortKey: cohort.cohortKey, pairKey: slot.pairKey, resumedAfterAttemptId: attempt.id, physicalAttemptsUsedBeforeResume: generation.usedPhysicalAttempts, maxPhysicalAttempts: generation.maxPhysicalAttempts, diagnosedFailureStage: attempt.failureStage, diagnosedSafeErrorCode: attempt.safeErrorCode, ...(resumeGenerationOrdinal === 3 ? { diagnosticCaptureUpgrade: "SAFE_STACK_FRAME_AND_OPERATION_AUDIT" } : used === 1 ? { lifecycleFixMigration: "20261016225000_oic7_worker_preflight_lifecycle_stages" } : { admissionPlanRevisionId: "1b5561bd-2e32-4552-831c-87e77b9aa987", extensionBudgetResolutionFix: "ACTIVE_EXTENSION_REVISION_BY_ID" }), providerDispatchOccurred: false, admissionLinked: false, supersededOutboxEventId: staleEvent.id, supersededOutboxAttemptCount: staleEvent.attemptCount } } });
      const reopened = await tx.oicEvaluationRecoveryGeneration.updateMany({ where: { id: generation.id, status: "CLOSED", usedPhysicalAttempts: used }, data: { status: "ACTIVE", closedAt: null } });
      if (reopened.count !== 1) throw new ConflictException("PACKET76_RECOVERY_RESUME_GENERATION_CHANGED");
      const superseded = await tx.oicEvaluationOutbox.updateMany({ where: { id: staleEvent.id, status: staleEvent.status, publishedAt: null }, data: { status: "FAILED", leaseOwner: null, leaseUntil: null, lastFailureClass: "SUPERSEDED_BY_AUTHORIZED_RECOVERY_RESUME" } });
      if (superseded.count !== 1) throw new ConflictException("PACKET76_RECOVERY_RESUME_OUTBOX_CHANGED");
      await tx.oicEvaluationWorkItem.update({ where: { id: work.id, status: "FAILED", attemptCount: expectedAttemptOrdinal }, data: { status: "PENDING", lastFailureClass: null, completedAt: null, availableAt: new Date() } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: execution.id, status: "FAILED" }, data: { status: "QUEUED", outcome: Prisma.DbNull, completedAt: null } });
      await tx.oicEvaluationRun.update({ where: { id: run.id }, data: { status: "RUNNING", completedAt: null } });
      await tx.oicEvaluationOutbox.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId, eventKey: `${caseExecutionId}:recovery-resume:${generation.id}:${attempt.id}`, eventType: "EVALUATION_CASE_ENQUEUED", payload: { runId, caseExecutionId, workItemId: work.id, recoveryGenerationId: generation.id } } });
      return { runId, caseExecutionId, recoveryGeneration: { id: generation.id, generationOrdinal: generation.generationOrdinal, status: "ACTIVE", usedPhysicalAttempts: generation.usedPhysicalAttempts, maxPhysicalAttempts: generation.maxPhysicalAttempts }, resumedAfterAttemptOrdinal: attempt.attemptOrdinal, supersededOutboxEvent: staleEvent.id, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Requeue one slot of the single owner-authorized successor run after its recorded pre-admission worker defect is fixed. */
  async resumePacket76SuccessorAfterPreDispatchFix(actor: AuthenticatedPrincipal, runId: string, caseExecutionId: string, input: Record<string, unknown>) {
    assertManage(actor);
    const scope = PACKET76_SUCCESSOR_SCOPE;
    const reason = "Resume the same owner-authorized paired run after correcting a verified pre-dispatch infrastructure failure; no provider dispatch or additional budget reservation occurred.";
    const idempotencyKey = input.idempotencyKey;
    const firstResumeKey = `p76-successor-pre-dispatch-${caseExecutionId}`;
    const thirdAttemptResumeKey = `${firstResumeKey}-attempt-3`;
    const resumeKey = typeof idempotencyKey === "string" ? idempotencyKey : "";
    if (runId !== scope.runId || actor.applicationId !== scope.applicationId || !uuidPattern.test(caseExecutionId)
      || Object.keys(input).some((key) => key !== "idempotencyKey") || ![firstResumeKey, thirdAttemptResumeKey].includes(resumeKey)) throw new NotFoundException();
    const readiness = this.workQueue ? await this.workQueue.workerReadiness() : null;
    if (!readiness || readiness.state !== "READY" || !readiness.fresh || readiness.availableExecutionSlots < 1) throw new ConflictException("PACKET76_RECOVERY_WORKER_NOT_READY");
    return this.db.$transaction(async (tx) => {
      const prior = await tx.oicAuditEvent.findFirst({ where: { applicationId: scope.applicationId, actorPrincipalId: actor.id, action: "evaluation.packet76.successor.pre_dispatch_resumed", targetType: "evaluation-case", targetId: caseExecutionId, requestId: resumeKey }, select: { metadata: true } });
      if (prior) {
        if (object(prior.metadata).reason !== reason || object(prior.metadata).runId !== runId) throw new ConflictException("PACKET76_SUCCESSOR_RESUME_IDEMPOTENCY_CONFLICT");
        return { runId, caseExecutionId, status: "REQUEUED", replayed: true };
      }
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationWorkItem" WHERE "runId" = ${runId}::uuid AND "caseExecutionId" = ${caseExecutionId}::uuid FOR UPDATE`);
      if (locked.length !== 1) throw new NotFoundException();
      const [run, work, execution, campaign] = await Promise.all([
        tx.oicEvaluationRun.findFirst({ where: { id: runId, applicationId: scope.applicationId, campaignId: scope.campaignId, diagnosticOnly: false }, include: { manifest: { select: { id: true, payload: true, canonicalDigest: true, release: { select: { id: true, status: true, compromisedAt: true, caseManifest: true } } } }, reports: { select: { id: true } }, cases: { orderBy: { repetitionOrdinal: "asc" }, select: { id: true, repetitionOrdinal: true, status: true, attempts: { orderBy: { attemptOrdinal: "asc" }, select: { id: true, status: true, admissionId: true, providerAttemptId: true, providerDispatchStartedAt: true, evidenceDigest: true, budgetReconciledAt: true } } } } } }),
        tx.oicEvaluationWorkItem.findUnique({ where: { id: locked[0]!.id } }),
        tx.oicEvaluationCaseExecution.findFirst({ where: { id: caseExecutionId, runId }, include: { attempts: { orderBy: { attemptOrdinal: "asc" } } } }),
        tx.oicEvaluationCampaign.findFirst({ where: { id: scope.campaignId, applicationId: scope.applicationId, tenantId: null, status: "ACTIVE" }, select: { id: true, budgetRevisionId: true, budgetLimitOiu: true, reservedOiu: true, reservationPerAttemptOiu: true, budgetPolicyDigest: true, budgetRevision: { select: { status: true, sourceDigest: true, unit: true, enforcement: true, amount: true, reservationUpperBound: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true, planRevisionId: true } } } })
      ]);
      const protocol = object(run?.manifest.payload);
      const cohort = object(protocol.cohort);
      const budgetPolicy = object(protocol.budgetPolicy);
      const slot = Array.isArray(cohort.slots) ? cohort.slots.map(object).find((item) => item.caseRevisionId === execution?.caseRevisionId && item.repetitionOrdinal === execution?.repetitionOrdinal) : undefined;
      const previous = execution?.attempts.at(-1);
      const now = new Date();
      const budgetOkay = !!campaign?.budgetRevision && campaign.id === scope.campaignId && campaign.budgetRevisionId === scope.budgetRevisionId
        && campaign.budgetPolicyDigest === budgetPolicy.budgetRevisionDigest && !!campaign.budgetLimitOiu?.equals(scope.baseCampaignLimitOiu)
        && !!campaign.reservationPerAttemptOiu?.equals(scope.perAdmissionOiu) && campaign.budgetRevision.status === "PUBLISHED"
        && campaign.budgetRevision.sourceDigest === budgetPolicy.budgetRevisionDigest && campaign.budgetRevision.amount.equals(scope.authorizedOiu)
        && campaign.budgetRevision.reservationUpperBound?.equals(scope.perAdmissionOiu) && campaign.budgetRevision.unit === "OIU"
        && campaign.budgetRevision.enforcement === "HARD" && campaign.budgetRevision.unknownLiabilityRule === "DENY"
        && campaign.budgetRevision.planRevisionId === scope.planRevisionId && campaign.budgetRevision.effectiveFrom <= now
        && !!campaign.budgetRevision.effectiveTo && campaign.budgetRevision.effectiveTo > now
        && !!run?.budgetReservationOiu && run.budgetReservationOiu.plus(scope.perAdmissionOiu).lte(scope.authorizedOiu)
        && campaign.budgetLimitOiu.minus(campaign.reservedOiu).gte(scope.perAdmissionOiu);
      if (!run || !["FAILED", "PARTIAL", "RUNNING"].includes(run.status) || run.manifest.id !== scope.manifestId
        || run.manifest.release.id !== "57760658-578b-42f7-bb0d-e91763a3995e" || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt
        || run.manifest.canonicalDigest !== sha256(protocol) || cohort.cohortKey !== scope.cohortKey || !budgetOkay
        || run.plannedDenominator !== 2 || run.plannedTrials !== 2 || run.reports.length !== 0 || !execution || !slot || typeof slot.pairKey !== "string"
        || !work || work.status !== "FAILED" || work.attemptCount !== execution.attempts.length || work.maxAttempts !== execution.attempts.length || ![1, 2].includes(execution.attempts.length) || work.leaseOwner || work.leaseUntil
        || execution.status !== "FAILED" || execution.attempts.length < 1 || execution.attempts.length > 2 || !previous
        || !packet76SafeSuccessorPreDispatchFailure({ runId, manifestId: run.manifest.id, campaignId: run.campaignId, applicationId: run.applicationId, cohortKey: cohort.cohortKey,
          failureClass: previous.failureClass, failureStage: previous.failureStage ?? previous.lastDurableStage, safeErrorCode: previous.safeErrorCode, status: previous.status,
          admissionId: previous.admissionId, providerAttemptId: previous.providerAttemptId, providerDispatchStartedAt: previous.providerDispatchStartedAt,
          artifactManifestPresent: previous.artifactManifest !== null, evidenceDigestPresent: previous.evidenceDigest !== null,
          attemptOrdinal: previous.attemptOrdinal, repetitionOrdinal: execution.repetitionOrdinal })
        || previous.completedAt === null || previous.recoveryGenerationId) throw new ConflictException("PACKET76_SUCCESSOR_RESUME_PRECONDITION_INVALID");

      if (execution.attempts.length === 2) {
        const first = execution.attempts[0]!;
        if (!packet76SafeSuccessorPreDispatchFailure({ runId, manifestId: run.manifest.id, campaignId: run.campaignId, applicationId: run.applicationId, cohortKey: cohort.cohortKey,
          failureClass: first.failureClass, failureStage: first.failureStage ?? first.lastDurableStage, safeErrorCode: first.safeErrorCode, status: first.status,
          admissionId: first.admissionId, providerAttemptId: first.providerAttemptId, providerDispatchStartedAt: first.providerDispatchStartedAt,
          artifactManifestPresent: first.artifactManifest !== null, evidenceDigestPresent: first.evidenceDigest !== null,
          attemptOrdinal: first.attemptOrdinal, repetitionOrdinal: execution.repetitionOrdinal })
          || first.completedAt === null || first.recoveryGenerationId
          || resumeKey !== thirdAttemptResumeKey) throw new ConflictException("PACKET76_SUCCESSOR_RESUME_HISTORY_INVALID");
      } else if (resumeKey !== firstResumeKey) throw new ConflictException("PACKET76_SUCCESSOR_RESUME_IDEMPOTENCY_INVALID");

      if (execution.repetitionOrdinal === 2) {
        const first = run.cases.find((item) => item.repetitionOrdinal === 1);
        const priorAttempt = first?.attempts.at(-1);
        if (first?.status !== "EXECUTED" || priorAttempt?.status !== "SUCCEEDED" || !priorAttempt.admissionId || !priorAttempt.evidenceDigest || !priorAttempt.budgetReconciledAt) throw new ConflictException("PACKET76_SUCCESSOR_FIRST_REPETITION_NOT_RECONCILED");
        const [admission, provider] = await Promise.all([
          tx.oicAdmission.findFirst({ where: { id: priorAttempt.admissionId, applicationId: scope.applicationId, tenantId: null }, select: { id: true, status: true, legs: { select: { state: true, budgetRevisionId: true } } } }),
          tx.oicProviderAttempt.findMany({ where: { admissionId: priorAttempt.admissionId, applicationId: scope.applicationId, tenantId: null }, select: { id: true, admissionId: true, status: true, usageStatus: true, providerKey: true, upstreamModelId: true, bindingId: true, connectionId: true, startedAt: true } })
        ]);
        const link = resolvePacket76ProviderDispatchLink({ attempt: { providerAttemptId: priorAttempt.providerAttemptId, providerDispatchStartedAt: priorAttempt.providerDispatchStartedAt, admissionId: priorAttempt.admissionId }, providerAttempts: provider, expected: { providerKey: "openai-compatible", upstreamModelId: "deepseek-flash", bindingId: "ada73ca7-ca5c-4b30-bae6-80c221b3eab4", connectionId: "bc113c1b-e8fc-4a0b-9bda-8428a94f3005" } });
        if (admission?.status !== "SETTLED" || admission.legs.length !== 1 || admission.legs[0]?.budgetRevisionId !== scope.budgetRevisionId || admission.legs[0]?.state !== "SETTLED" || !link.valid) throw new ConflictException("PACKET76_SUCCESSOR_FIRST_REPETITION_NOT_RECONCILED");
      }
      const priorFailureEvent = await tx.oicEvaluationOutbox.findMany({ where: { runId, eventKey: `${caseExecutionId}:failed:${work.leaseGeneration}`, eventType: "EVALUATION_CASE_FAILED", status: "PUBLISHED", publishedAt: { not: null } }, select: { id: true }, take: 2 });
      if (priorFailureEvent.length !== 1) throw new ConflictException("PACKET76_SUCCESSOR_FAILURE_PROJECTION_NOT_RECONCILED");
      const nextAttemptOrdinal = execution.attempts.length + 1;
      const campaignReserved = await tx.oicEvaluationCampaign.updateMany({ where: { id: scope.campaignId, applicationId: scope.applicationId, status: "ACTIVE", reservedOiu: campaign.reservedOiu, budgetLimitOiu: { gte: campaign.reservedOiu.plus(scope.perAdmissionOiu) } }, data: { reservedOiu: { increment: scope.perAdmissionOiu } } });
      if (campaignReserved.count !== 1) throw new ConflictException("PACKET76_SUCCESSOR_RESERVATION_CONFLICT");
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.packet76.successor.pre_dispatch_resumed", targetType: "evaluation-case", targetId: caseExecutionId, requestId: resumeKey, metadata: { reason, runId, caseExecutionId, campaignId: run.campaignId, manifestId: run.manifestId, budgetRevisionId: scope.budgetRevisionId, cohortKey: cohort.cohortKey, pairKey: slot.pairKey, repetitionOrdinal: execution.repetitionOrdinal, previousAttemptId: previous.id, previousFailureClass: previous.failureClass, previousFailureStage: previous.failureStage ?? previous.lastDurableStage, providerDispatchOccurredBeforeResume: false, priorAdmissionPresent: false, additionalBudgetReserved: true, reservedOiu: scope.perAdmissionOiu, withinExistingAuthorization: true, maxPhysicalAttemptsAfterResume: nextAttemptOrdinal } } });
      const runReserved = await tx.oicEvaluationRun.updateMany({ where: { id: run.id, applicationId: scope.applicationId, status: "PARTIAL", budgetReservationOiu: run.budgetReservationOiu, budgetReleasedOiu: run.budgetReleasedOiu }, data: { budgetReservationOiu: { increment: scope.perAdmissionOiu }, status: "RUNNING", completedAt: null } });
      if (runReserved.count !== 1) throw new ConflictException("PACKET76_SUCCESSOR_RESERVATION_CONFLICT");
      for (const attempt of execution.attempts) {
        const [priorAdmission, admissionProviderCount, directProviderCount] = await Promise.all([
          tx.oicAdmission.findFirst({ where: { applicationId: scope.applicationId, tenantId: null, idempotencyKey: `evaluation-attempt:${attempt.id}` }, select: { id: true } }),
          tx.oicProviderAttempt.count({ where: { applicationId: scope.applicationId, tenantId: null, admission: { idempotencyKey: `evaluation-attempt:${attempt.id}` } } }),
          tx.oicProviderAttempt.count({ where: { applicationId: scope.applicationId, tenantId: null, requestId: `evaluation-${attempt.id}` } })
        ]);
        if (priorAdmission || admissionProviderCount !== 0 || directProviderCount !== 0) throw new ConflictException("PACKET76_SUCCESSOR_PRIOR_ATTEMPT_HAS_ADMISSION");
      }
      const resumeEventKey = `${caseExecutionId}:safe-pre-dispatch-resume:${nextAttemptOrdinal}`;
      await tx.oicEvaluationWorkItem.update({ where: { id: work.id }, data: { status: "PENDING", maxAttempts: nextAttemptOrdinal, lastFailureClass: null, completedAt: null, availableAt: new Date() } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: execution.id }, data: { status: "QUEUED", outcome: Prisma.DbNull, completedAt: null } });
      await tx.oicEvaluationRun.update({ where: { id: run.id }, data: { status: "RUNNING", completedAt: null } });
      await tx.oicEvaluationOutbox.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId, eventKey: resumeEventKey, eventType: "EVALUATION_CASE_ENQUEUED", payload: { runId, caseExecutionId, workItemId: work.id } } });
      return { runId, caseExecutionId, status: "REQUEUED", priorDispatch: false, additionalBudgetReserved: false, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async authorizePacket76RecoveryGeneration(actor: AuthenticatedPrincipal, runId: string, caseExecutionId: string, reason: string, idempotencyKey: string, setStage: (stage: string) => void) {
    if (runId !== PACKET76_APPROVED_SCOPE.runId || !actor.scopes.includes("oic:evaluation:manage")) throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      setStage("LOAD_FROZEN_RUN_AND_PROTOCOL");
      const run = await tx.oicEvaluationRun.findFirst({
        where: { id: runId, ...this.requireScope(actor) },
        select: { id: true, applicationId: true, tenantId: true, campaignId: true, status: true, manifest: { select: { payload: true, canonicalDigest: true, release: { select: { status: true, compromisedAt: true, caseManifest: true } } } } }
      });
      if (!run || run.campaignId !== PACKET76_APPROVED_SCOPE.campaignId || !["PARTIAL", "INCONCLUSIVE"].includes(run.status)) throw new ConflictException("PACKET76_RECOVERY_RUN_INVALID");
      setStage("VALIDATE_FROZEN_PROTOCOL");
      const protocol = object(run.manifest.payload);
      const cohort = object(protocol.cohort);
      const revisions = Array.isArray(run.manifest.release.caseManifest) ? run.manifest.release.caseManifest.map((item) => String(object(item).caseRevisionId)) : [];
      if (run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt || run.manifest.canonicalDigest !== sha256(protocol)
        || cohort.cohortKey !== PACKET76_APPROVED_SCOPE.cohortKey || !validatePacket76Cohort(cohort, revisions, Number(object(protocol.repetitionPolicy).plannedRepetitions)).valid) throw new ConflictException("PACKET76_RECOVERY_PROTOCOL_INVALID");
      setStage("VALIDATE_HARD_OIC6_CAPACITY");
      const ext = await tx.oicEvaluationCapacityExtension.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, campaignId: run.campaignId, runId, cohortKey: PACKET76_APPROVED_SCOPE.cohortKey, status: "ACTIVE", expiresAt: { gt: new Date() } }, select: { id: true, budgetRevisionId: true, authorizedOiu: true, perAdmissionLimitOiu: true, budgetRevision: { select: { status: true, unit: true, enforcement: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true } } } });
      if (!ext || ext.authorizedOiu.toString() !== "1536" || ext.perAdmissionLimitOiu.toString() !== "256" || ext.budgetRevision.status !== "PUBLISHED" || ext.budgetRevision.unit !== "OIU" || ext.budgetRevision.enforcement !== "HARD" || ext.budgetRevision.unknownLiabilityRule !== "DENY" || ext.budgetRevision.effectiveFrom > new Date() || (ext.budgetRevision.effectiveTo && ext.budgetRevision.effectiveTo <= new Date())) throw new ConflictException("PACKET76_RECOVERY_CAPACITY_UNAVAILABLE");
      setStage("LOCK_TERMINAL_WORK_ITEM");
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationWorkItem" WHERE "runId" = ${runId}::uuid AND "caseExecutionId" = ${caseExecutionId}::uuid FOR UPDATE`);
      if (locked.length !== 1) throw new NotFoundException();
      setStage("LOAD_EXECUTION_AND_WORK_ITEM");
      const execution = await tx.oicEvaluationCaseExecution.findFirst({ where: { id: caseExecutionId, runId }, include: { attempts: { orderBy: { attemptOrdinal: "asc" } } } });
      const work = await tx.oicEvaluationWorkItem.findUnique({ where: { id: locked[0]!.id } });
      if (!execution || !work) throw new NotFoundException();
      const replay = await tx.oicAuditEvent.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, actorPrincipalId: actor.id, action: "evaluation.packet76.recovery_generation.authorized", targetType: "evaluation-recovery-generation", requestId: idempotencyKey }, select: { metadata: true } });
      if (replay) {
        if (object(replay.metadata).reason !== reason) throw new ConflictException("PACKET76_RECOVERY_IDEMPOTENCY_CONFLICT");
        const generationId = object(replay.metadata).generationId;
        const generation = typeof generationId === "string" ? await tx.oicEvaluationRecoveryGeneration.findUnique({ where: { id: generationId }, select: { id: true, status: true, generationOrdinal: true, maxPhysicalAttempts: true, usedPhysicalAttempts: true } }) : null;
        if (!generation) throw new ConflictException("PACKET76_RECOVERY_AUDIT_WITHOUT_GENERATION");
        return { runId, caseExecutionId, recoveryGeneration: generation, replayed: true };
      }
      setStage("VALIDATE_PRIOR_GENERATION_AND_ATTEMPTS");
      const slot = Array.isArray(cohort.slots) ? cohort.slots.map(object).find((item) => item.caseRevisionId === execution.caseRevisionId && item.repetitionOrdinal === execution.repetitionOrdinal) : undefined;
      const previous = execution.attempts.at(-1);
      setStage("LOAD_PRIOR_GENERATIONS");
      const priorGenerations = await tx.oicEvaluationRecoveryGeneration.findMany({ where: { workItemId: work.id }, orderBy: { generationOrdinal: "asc" }, select: { id: true, generationOrdinal: true, authorizationId: true, status: true, maxPhysicalAttempts: true, usedPhysicalAttempts: true, previousAttemptId: true } });
      const priorGeneration = priorGenerations.at(-1);
      const expectedPriorOrdinal = priorGeneration ? 5 + priorGeneration.generationOrdinal * 3 : 5;
      const expectedGenerationOrdinal = priorGenerations.length + 1;
      const recoveryAuthorizationId = expectedGenerationOrdinal === 3 ? PACKET76_APPROVED_SCOPE.thirdExecutionRecoveryAuthorizationId
        : expectedGenerationOrdinal === 2 ? PACKET76_APPROVED_SCOPE.executionRecoveryAuthorizationId
          : PACKET76_APPROVED_SCOPE.recoveryAuthorizationId;
      if (await tx.oicEvaluationReport.count({ where: { runId } }) > 0 || !slot || typeof slot.pairKey !== "string" || priorGenerations.length > 2
        || priorGenerations.some((generation, index) => generation.generationOrdinal !== index + 1 || generation.authorizationId !== (index === 0 ? PACKET76_APPROVED_SCOPE.recoveryAuthorizationId : PACKET76_APPROVED_SCOPE.executionRecoveryAuthorizationId) || generation.status !== "EXHAUSTED" || generation.maxPhysicalAttempts !== 3 || generation.usedPhysicalAttempts !== 3)
        || expectedGenerationOrdinal > 3
        || !["FAILED", "INCONCLUSIVE"].includes(execution.status) || work.status !== "FAILED" || work.leaseOwner || work.leaseUntil
        || work.attemptCount !== expectedPriorOrdinal || work.maxAttempts !== expectedPriorOrdinal || execution.attempts.length !== expectedPriorOrdinal || !previous
        || previous.attemptOrdinal !== expectedPriorOrdinal || previous.status !== "INFRA_FAILURE" || !previous.completedAt
        || previous.admissionId !== null || previous.providerAttemptId !== null || previous.providerDispatchStartedAt !== null
        || previous.artifactManifest !== null || previous.evidenceDigest !== null
        || execution.attempts.some((attempt) => attempt.status !== "INFRA_FAILURE" || !attempt.completedAt || attempt.providerAttemptId || attempt.providerDispatchStartedAt || attempt.artifactManifest || attempt.evidenceDigest)
        || (priorGeneration && (previous.recoveryGenerationId !== priorGeneration.id || previous.recoveryOrdinal !== 3))) throw new ConflictException("PACKET76_RECOVERY_GENERATION_NOT_ELIGIBLE");
      if (priorGeneration) {
        for (const generation of priorGenerations) {
          const anchorOrdinal = 5 + (generation.generationOrdinal - 1) * 3;
          const attemptStartOrdinal = anchorOrdinal + 1;
          const anchor = execution.attempts.find((attempt) => attempt.id === generation.previousAttemptId);
          const generationAttempts = execution.attempts.filter((attempt) => attempt.recoveryGenerationId === generation.id).sort((a, b) => (a.recoveryOrdinal ?? 0) - (b.recoveryOrdinal ?? 0));
          if (!anchor || anchor.attemptOrdinal !== anchorOrdinal || generationAttempts.length !== 3 || generationAttempts.some((attempt, index) => attempt.recoveryOrdinal !== index + 1 || attempt.attemptOrdinal !== attemptStartOrdinal + index)) throw new ConflictException("PACKET76_PRIOR_RECOVERY_GENERATION_INVALID");
        }
      }
      setStage("RECONCILE_PRIOR_ADMISSIONS");
      for (const attempt of execution.attempts) {
        if (!attempt.admissionId) continue;
        const admission = await tx.oicAdmission.findFirst({ where: { id: attempt.admissionId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, status: true, legs: { select: { state: true } } } });
        const providerAttempts = await tx.oicProviderAttempt.count({ where: { admissionId: attempt.admissionId } });
        if (!admission || admission.status !== "RELEASED" || admission.legs.some((leg) => leg.state !== "RELEASED") || providerAttempts !== 0) throw new ConflictException("PACKET76_RECOVERY_HISTORY_UNRESOLVED");
      }
      setStage("WRITE_GENERATION_AUDIT");
      const generationId = randomUUID();
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.packet76.recovery_generation.authorized", targetType: "evaluation-recovery-generation", targetId: generationId, requestId: idempotencyKey, metadata: { authorizationId: recoveryAuthorizationId, generationId, generationOrdinal: expectedGenerationOrdinal, runId, workItemId: work.id, caseExecutionId, cohortKey: PACKET76_APPROVED_SCOPE.cohortKey, pairKey: slot.pairKey, repetitionOrdinal: execution.repetitionOrdinal, previousAttemptId: previous.id, maxPhysicalAttempts: 3, maxProviderDispatches: 3, providerDispatchCeilingRemainingBefore: 4, diagnosticPasses: 3, reason } } });
      setStage("CREATE_RECOVERY_GENERATION");
      const generation = await tx.oicEvaluationRecoveryGeneration.create({ data: {
        id: generationId, applicationId: run.applicationId, tenantId: run.tenantId, runId, workItemId: work.id,
        cohortKey: PACKET76_APPROVED_SCOPE.cohortKey, pairKey: slot.pairKey, repetitionOrdinal: execution.repetitionOrdinal,
        previousAttemptId: previous.id, generationOrdinal: expectedGenerationOrdinal, maxPhysicalAttempts: 3, usedPhysicalAttempts: 0, status: "ACTIVE",
        authorizationId: recoveryAuthorizationId, reason, createdBy: actor.id
      } });
      setStage("REQUEUE_WORK_ITEM_AND_RUN");
      const nextMaxAttempts = expectedPriorOrdinal + 3;
      await tx.oicEvaluationWorkItem.update({ where: { id: work.id }, data: { status: "PENDING", maxAttempts: nextMaxAttempts, lastFailureClass: null, completedAt: null, availableAt: new Date() } });
      setStage("REQUEUE_CASE_AND_RUN");
      await tx.oicEvaluationCaseExecution.update({ where: { id: caseExecutionId }, data: { status: "QUEUED", outcome: Prisma.DbNull, completedAt: null } });
      await tx.oicEvaluationRun.update({ where: { id: runId }, data: { status: "RUNNING", completedAt: null } });
      await tx.oicEvaluationOutbox.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId, eventKey: `${caseExecutionId}:recovery-generation:${generation.id}`, eventType: "EVALUATION_CASE_ENQUEUED", payload: { runId, caseExecutionId, workItemId: work.id, recoveryGenerationId: generation.id } } });
      return { runId, caseExecutionId, recoveryGeneration: { id: generation.id, generationOrdinal: generation.generationOrdinal, status: generation.status, maxPhysicalAttempts: generation.maxPhysicalAttempts, usedPhysicalAttempts: generation.usedPhysicalAttempts }, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async retryOutbox(actor: AuthenticatedPrincipal, id: string, input: Record<string, unknown>) {
    assertManage(actor);
    const reason = input.reason;
    const idempotencyKey = input.idempotencyKey;
    if (!uuidPattern.test(id) || typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Outbox recovery requires an event, bounded reason and idempotency key");
    if (this.config?.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true") throw new ConflictException("EVALUATION_OUTBOX_WORKER_DISABLED");
    return this.db.$transaction(async (tx) => {
      const row = await tx.oicEvaluationOutbox.findFirst({ where: { id, ...this.requireScope(actor) }, select: { id: true, applicationId: true, tenantId: true, runId: true, status: true, eventType: true } });
      if (!row || !row.runId) throw new NotFoundException();
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OicEvaluationOutbox" WHERE "id" = ${id}::uuid FOR UPDATE`);
      if (locked.length !== 1) throw new ConflictException("EVALUATION_OUTBOX_RECOVERY_CONFLICT");
      const audit = await tx.oicAuditEvent.findFirst({ where: { applicationId: row.applicationId, tenantId: row.tenantId, actorPrincipalId: actor.id, action: "evaluation.outbox.retry.requested", targetId: id, requestId: idempotencyKey }, select: { metadata: true } });
      if (audit) {
        if (object(audit.metadata).reason !== reason.trim()) throw new ConflictException("EVALUATION_OUTBOX_IDEMPOTENCY_CONFLICT");
        return { id, status: "REQUEUED", replayed: true };
      }
      if (row.status !== "FAILED" || !["EVALUATION_CASE_ENQUEUED", "EVALUATION_CASE_EXECUTED", "EVALUATION_CASE_FAILED", "EVALUATION_CASE_INCONCLUSIVE", "EVALUATION_CASE_CANCELLED"].includes(row.eventType)) throw new ConflictException("EVALUATION_OUTBOX_RECOVERY_INELIGIBLE");
      const changed = await tx.oicEvaluationOutbox.updateMany({ where: { id, status: "FAILED" }, data: { status: "PENDING", attemptCount: 0, lastFailureClass: null, availableAt: new Date(), leaseOwner: null, leaseUntil: null } });
      if (changed.count !== 1) throw new ConflictException("EVALUATION_OUTBOX_RECOVERY_CONFLICT");
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: "evaluation.outbox.retry.requested", targetType: "evaluation-outbox", targetId: id, requestId: idempotencyKey, metadata: { reason: reason.trim(), runId: row.runId, eventType: row.eventType } } });
      return { id, status: "REQUEUED", replayed: false };
    });
  }

  async listRuns(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationRun.findMany({ where: { ...scope, diagnosticOnly: false }, orderBy: [{ createdAt: "desc" }], take: 100, select: { id: true, campaignId: true, manifestId: true, targetClass: true, targetFingerprint: true, status: true, verificationTier: true, plannedDenominator: true, budgetReservationOiu: true, budgetReleasedOiu: true, completedAt: true, createdAt: true, _count: { select: { cases: true, reports: true } } } });
  }

  async listReports(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationReport.findMany({
      where: { run: { ...scope, diagnosticOnly: false } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true, run: { select: { targetClass: true, targetFingerprint: true, status: true, manifest: { select: { id: true } } } } }
    });
  }

  async report(actor: AuthenticatedPrincipal, id: string) {
    const report = await this.db.oicEvaluationReport.findFirst({
      where: { id, run: this.requireScope(actor) },
      select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, summary: true, verificationTier: true, decisionEligible: true, createdAt: true, run: { select: { applicationId: true, tenantId: true, targetClass: true, targetFingerprint: true, manifest: { select: { id: true, canonicalDigest: true } } } } }
    });
    if (!report) throw new NotFoundException();
    return report;
  }

  async listComparisons(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationComparison.findMany({
      where: { baselineReport: { run: scope }, candidateReport: { run: scope } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, outcome: true, reasonCodes: true, commonCases: true, coverage: true, estimates: true, methodRevision: true, decisionEligible: true, createdAt: true, baselineReport: { select: { id: true, run: { select: { targetClass: true, targetFingerprint: true, status: true } } } }, candidateReport: { select: { id: true, run: { select: { targetClass: true, targetFingerprint: true, status: true } } } } }
    });
  }

  async analyzeRun(actor: AuthenticatedPrincipal, runId: string) {
    assertManage(actor);
    const run = await this.db.oicEvaluationRun.findFirst({
      where: { id: runId, ...this.requireScope(actor) },
      include: { manifest: { include: { release: { select: { id: true, status: true, releaseTier: true, compromisedAt: true, manifestDigest: true, environment: { select: { definitionDigest: true } } } } } }, cases: { orderBy: [{ caseRevisionId: "asc" }, { repetitionOrdinal: "asc" }], include: { measurements: true, attempts: { orderBy: { attemptOrdinal: "asc" }, select: { id: true, status: true, admissionId: true, providerAttemptId: true, providerDispatchStartedAt: true, failureClass: true, verificationTier: true, evidenceDigest: true, artifactManifest: true } } } } }
    });
    if (!run) throw new NotFoundException();
    if (run.diagnosticOnly) throw new ConflictException("EVALUATION_DIAGNOSTIC_RUN_NOT_ANALYZABLE");
    if (!["EXECUTED", "PARTIAL", "FAILED", "INCONCLUSIVE", "BUDGET_BLOCKED", "INVALID_ENVIRONMENT", "CANCELLED"].includes(run.status)) throw new ConflictException("EVALUATION_RUN_NOT_TERMINAL");
    const protocol = object(run.manifest.payload);
    const metricRefs = Array.isArray(protocol.metricRevisions) ? protocol.metricRevisions : [];
    const metricIds = metricRefs.flatMap((item) => typeof item === "string" && uuidPattern.test(item) ? [item] : object(item).id && typeof object(item).id === "string" && uuidPattern.test(object(item).id as string) ? [object(item).id as string] : []);
    const metricRows = metricIds.length ? await this.db.oicEvaluationMetricRevision.findMany({ where: { id: { in: metricIds }, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, metricKey: true, revision: true, definition: true } }) : [];
    const expectedMetrics: ExpectedMetric[] = metricRows.map((row) => {
      const definition = object(row.definition);
      return { metricKey: row.metricKey, revision: row.revision, type: typeof definition.type === "string" ? definition.type : "UNKNOWN", unit: typeof definition.unit === "string" ? definition.unit : "UNKNOWN", polarity: typeof definition.polarity === "string" ? definition.polarity : "UNKNOWN", minimumEffectiveN: typeof definition.minimumEffectiveN === "number" && Number.isInteger(definition.minimumEffectiveN) ? definition.minimumEffectiveN : 1 };
    });
    const physicalAttempts = run.cases.flatMap((item) => item.attempts);
    const admissionIds = [...new Set(physicalAttempts.map((attempt) => attempt.admissionId).filter((id): id is string => !!id))];
    const [providerAttempts, admissions] = await Promise.all([
      admissionIds.length ? this.db.oicProviderAttempt.findMany({
        where: { applicationId: run.applicationId, tenantId: run.tenantId, admissionId: { in: admissionIds } },
        select: { id: true, admissionId: true, status: true, usageStatus: true, usageEvents: { select: {
          id: true, normalizedDimensions: true,
          oiuAssessments: { select: { status: true, oiu: true } },
          costAssessments: { select: { status: true, nativeAmount: true, currency: true, evidenceClass: true } }
        } } }
      }) : Promise.resolve([]),
      admissionIds.length ? this.db.oicAdmission.findMany({ where: { id: { in: admissionIds }, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, status: true, planRevisionId: true, legs: { select: { amount: true, state: true, budgetRevisionId: true } }, postings: { select: { kind: true, amount: true } } } }) : Promise.resolve([])
    ]);
    const artifactIds = [...new Set(physicalAttempts.flatMap((attempt) => Object.values(object(attempt.artifactManifest)).flatMap((value) => {
      const artifactId = object(value).artifactId;
      return typeof artifactId === "string" && uuidPattern.test(artifactId) ? [artifactId] : [];
    })))];
    const artifacts = artifactIds.length ? await this.db.oicEvaluationArtifact.findMany({ where: { id: { in: artifactIds }, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, purpose: true, exposureTier: true, status: true, digest: true, keyVersion: true } }) : [];
    const terminal = new Set(["EXECUTED", "FAILED", "INCONCLUSIVE", "BUDGET_BLOCKED", "INVALID_ENVIRONMENT", "CANCELLED"]);
    const failures: string[] = [];
    if (run.cases.length !== run.plannedDenominator) failures.push("CASE_DENOMINATOR_MISMATCH");
    if (run.cases.some((item) => !terminal.has(item.status))) failures.push("CASE_NOT_TERMINAL");
    if (run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt) failures.push("RELEASE_INELIGIBLE");
    if (run.cases.some((item) => item.status === "EXECUTED" && ![...item.attempts].some((attempt) => attempt.status === "SUCCEEDED" && attempt.admissionId && digestPattern.test(attempt.evidenceDigest ?? "")))) failures.push("ATTEMPT_EVIDENCE_INCOMPLETE");
    if (run.cases.some((item) => item.status === "EXECUTED" && !(object(item.outcome).oracle && object(item.outcome).output))) failures.push("ORACLE_EVIDENCE_MISSING");
    if (metricIds.length !== metricRows.length) failures.push("PINNED_METRIC_REVISION_MISSING");
    if (physicalAttempts.some((attempt) => attempt.status === "SUCCEEDED" && (!attempt.admissionId || !admissions.some((admission) => admission.id === attempt.admissionId && admission.status === "SETTLED")))) failures.push("OIC6_SETTLEMENT_INCOMPLETE");
    if (providerAttempts.some((attempt) => attempt.status === "SUCCEEDED" && (!attempt.usageEvents.length || attempt.usageEvents.some((usage) => !usage.oiuAssessments.some((assessment) => assessment.status === "ASSESSED"))))) failures.push("USAGE_ASSESSMENT_INCOMPLETE");
    if (providerAttempts.some((attempt) => attempt.status === "SUCCEEDED" && (!attempt.usageEvents.length || attempt.usageEvents.some((usage) => !usage.costAssessments.some((assessment) => assessment.status === "ASSESSED" && accountingEvidence(assessment.nativeAmount) !== null))))) failures.push("COST_ASSESSMENT_INCOMPLETE");
    if (artifactIds.some((id) => !artifacts.some((artifact) => artifact.id === id && artifact.status === "AVAILABLE" && artifact.keyVersion === 2))) failures.push("V2_ARTIFACT_EVIDENCE_INCOMPLETE");
    const measurements: AnalysisMeasurement[] = run.cases.flatMap((execution) => execution.measurements.map((measurement) => ({
      caseId: execution.caseRevisionId, trial: execution.repetitionOrdinal, metricKey: measurement.metricKey, metricRevision: measurement.metricRevision,
      type: measurement.valueType, unit: measurement.unit, availability: measurement.availability, value: measurement.value,
      evidenceDigest: measurement.evidenceDigest
    })));
    const summary = {
      protocol: { manifestId: run.manifest.id, manifestDigest: run.manifest.canonicalDigest, targetClass: run.targetClass, releaseId: run.manifest.release.id, releaseDigest: run.manifest.release.manifestDigest, environmentDigest: run.manifest.release.environment?.definitionDigest ?? null },
      target: { fingerprint: run.targetFingerprint, identity: run.targetIdentity },
      analysis: buildRunAnalysis({ plannedCases: run.plannedDenominator, terminalCases: run.cases.filter((item) => terminal.has(item.status)).length, expectedMetrics, measurements, failures }),
      evidenceGraph: {
        cases: run.cases.map((item) => ({ caseRevisionId: item.caseRevisionId, repetitionOrdinal: item.repetitionOrdinal, status: item.status, attempts: item.attempts.map((attempt) => ({ attemptId: attempt.id, status: attempt.status, admissionLinked: !!attempt.admissionId, evidenceDigestPresent: digestPattern.test(attempt.evidenceDigest ?? ""), artifactReferenceCount: Object.keys(object(attempt.artifactManifest)).length })) })),
        artifacts: artifacts.map((artifact) => ({ id: artifact.id, purpose: artifact.purpose, exposureTier: artifact.exposureTier, status: artifact.status, digest: artifact.digest, keyVersion: artifact.keyVersion })),
        providerAccounting: { unknownUsageRemainsUnknown: true, providerAttempts: providerAttempts.map((attempt) => ({ status: attempt.status, usageStatus: attempt.usageStatus, usageEvents: attempt.usageEvents.map((usage) => ({ id: usage.id, oiuAssessments: usage.oiuAssessments.map((assessment) => ({ status: assessment.status, oiu: accountingEvidence(assessment.oiu) })), costAssessments: usage.costAssessments.map((assessment) => ({ status: assessment.status, nativeAmount: accountingEvidence(assessment.nativeAmount), currency: assessment.currency, evidenceClass: assessment.evidenceClass })) })) })), admissions: admissions.map((admission) => ({ status: admission.status, planRevisionId: admission.planRevisionId, legs: admission.legs.map((leg) => ({ amount: accountingEvidence(leg.amount), state: leg.state, budgetRevisionId: leg.budgetRevisionId })), postings: admission.postings.map((posting) => ({ kind: posting.kind, amount: accountingEvidence(posting.amount) })) })) }
      },
      limitations: ["REPORT_IS_DESCRIPTIVE_UNTIL_OWNER_ACCEPTS_COMPARISON_CLAIMS"]
    };
    const cohort = object(protocol.cohort);
    const gate = object(protocol.preDispatchDecisionGate);
    const gateCheck = validatePredispatchDecisionGate(gate);
    const tokenCount = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    const cohortAttempts = run.cases.flatMap((execution) => execution.attempts.filter((attempt) => attempt.status === "SUCCEEDED").map((attempt) => {
      const linkedProviderAttempts = providerAttempts.filter((providerAttempt) => providerAttempt.admissionId === attempt.admissionId);
      const providerAttempt = linkedProviderAttempts.length === 1 ? linkedProviderAttempts[0] : undefined;
      const usageEvents = providerAttempt?.usageEvents ?? [];
      const normalizedUsage = usageEvents.length === 1 ? object(usageEvents[0]!.normalizedDimensions) : {};
      const admission = admissions.find((item) => item.id === attempt.admissionId);
      const manifestRefs = Object.values(object(attempt.artifactManifest)).map((value) => object(value).artifactId).filter((value): value is string => typeof value === "string");
      return {
        status: attempt.status,
        admitted: !!attempt.admissionId && !!admission && admission.status === "SETTLED" && linkedProviderAttempts.length === 1 && providerAttempt?.status === "SUCCEEDED",
        evidenceDigestPresent: digestPattern.test(attempt.evidenceDigest ?? ""),
        artifactVerified: manifestRefs.length > 0 && manifestRefs.every((id) => artifacts.some((artifact) => artifact.id === id && artifact.status === "AVAILABLE" && artifact.keyVersion === 2)),
        admissionSettled: !!admission && admission.status === "SETTLED",
        usageAssessed: usageEvents.length === 1 && usageEvents.every((usage) => usage.oiuAssessments.length > 0 && usage.oiuAssessments.every((assessment) => assessment.status === "ASSESSED")),
        costAssessed: usageEvents.length === 1 && usageEvents.every((usage) => usage.costAssessments.length > 0 && usage.costAssessments.every((assessment) => assessment.status === "ASSESSED" && accountingEvidence(assessment.nativeAmount) !== null)),
        reportedInputTokens: tokenCount(normalizedUsage.inputTokens),
        reportedOutputTokens: tokenCount(normalizedUsage.outputTokens)
      };
    }));
    const oneSuccessfulObservationPerCase = run.cases.every((execution) => execution.attempts.filter((attempt) => attempt.status === "SUCCEEDED").length === 1);
    const recoveryHistoryValid = oneSuccessfulObservationPerCase && packet76PreDispatchHistorySafe(physicalAttempts.filter((attempt) => attempt.status !== "SUCCEEDED").map((attempt) => {
      const linkedProviderAttempts = providerAttempts.filter((providerAttempt) => providerAttempt.admissionId === attempt.admissionId);
      const admission = admissions.find((item) => item.id === attempt.admissionId);
      return {
        status: attempt.status,
        providerDispatched: !!attempt.providerAttemptId || !!attempt.providerDispatchStartedAt,
        evidenceDigestPresent: digestPattern.test(attempt.evidenceDigest ?? ""),
        artifactPresent: Object.keys(object(attempt.artifactManifest)).length > 0,
        admissionStatus: admission?.status ?? (attempt.admissionId ? "UNKNOWN" : null),
        linkedProviderAttemptCount: linkedProviderAttempts.length
      };
    }));
    const observationsFullyVerified = cohortAttempts.length === run.plannedDenominator && cohortAttempts.every((attempt) => attempt.status === "SUCCEEDED" && attempt.admitted && attempt.admissionSettled && attempt.evidenceDigestPresent && attempt.artifactVerified && attempt.usageAssessed && attempt.costAssessed && attempt.reportedInputTokens !== null && attempt.reportedInputTokens <= 128 && attempt.reportedOutputTokens !== null && attempt.reportedOutputTokens <= 128);
    const reportVerificationTier = failures.length === 0 && oneSuccessfulObservationPerCase && recoveryHistoryValid && observationsFullyVerified
      ? "OIC_EXECUTED_VERIFIED"
      : "OIC_EXECUTED_PARTIAL";
    const cohortEligibility = packet76RunEligibility({
      cohortKey: cohort.cohortKey,
      plannedRepetitions: object(protocol.repetitionPolicy).plannedRepetitions,
      minimumEffectiveN: gate.minimumEffectiveN,
      verificationTier: reportVerificationTier,
      releaseValid: run.manifest.release.status === "PUBLISHED" && !run.manifest.release.compromisedAt,
      holdoutFresh: run.manifest.release.releaseTier === "PRIVATE_HOLDOUT" && run.manifest.release.status === "PUBLISHED" && !run.manifest.release.compromisedAt,
      analysisStatus: object(summary.analysis).status as string,
      plannedCases: run.plannedDenominator,
      terminalCases: run.cases.filter((item) => terminal.has(item.status)).length,
      attempts: cohortAttempts,
      recoveryHistoryValid
    });
    const cohortDecisionEligible = !!cohort.cohortKey && gateCheck.valid && cohortEligibility.eligible
      && failures.length === 0 && expectedMetrics.length === 1 && expectedMetrics[0]?.metricKey === "oic7-objective-exact-match" && expectedMetrics[0]?.revision === 2;
    const cohortEvidence = { decisionEligible: cohortDecisionEligible, reasonCodes: [...new Set([...gateCheck.reasonCodes, ...cohortEligibility.reasonCodes, ...(expectedMetrics.length !== 1 || expectedMetrics[0]?.metricKey !== "oic7-objective-exact-match" || expectedMetrics[0]?.revision !== 2 ? ["PACKET76_METRIC_BASIS_INVALID"] : []), ...(failures.length ? failures : [])])].sort(), cohortKey: typeof cohort.cohortKey === "string" ? cohort.cohortKey : null, plannedRepetitions: object(protocol.repetitionPolicy).plannedRepetitions, observedPhysicalAttempts: physicalAttempts.length, observedCohortObservations: cohortAttempts.length, preDispatchRecoveryHistoryValid: recoveryHistoryValid };
    (summary as Record<string, unknown>).cohortEvidence = cohortEvidence;
    const resultDigest = sha256(summary);
    const existing = await this.db.oicEvaluationReport.findFirst({ where: { runId: run.id, resultDigest }, select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true } });
    if (existing) return existing;
    try {
      return await this.db.$transaction(async (tx) => {
        const latest = await tx.oicEvaluationReport.findFirst({ where: { runId: run.id }, orderBy: { analysisRevision: "desc" }, select: { analysisRevision: true } });
        const report = await tx.oicEvaluationReport.create({ data: {
          runId: run.id, analysisRevision: (latest?.analysisRevision ?? 0) + 1,
          status: object(summary.analysis).status as string, resultDigest,
          summary: summary as Prisma.InputJsonValue, verificationTier: reportVerificationTier, decisionEligible: cohortDecisionEligible
        } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.run.analyzed", targetType: "evaluation-report", targetId: report.id, metadata: { runId: run.id, analysisRevision: report.analysisRevision, resultDigest, decisionEligible: cohortDecisionEligible, cohortKey: cohortEvidence.cohortKey, reasonCodes: cohortEvidence.reasonCodes } } });
        return { id: report.id, runId: report.runId, analysisRevision: report.analysisRevision, status: report.status, resultDigest: report.resultDigest, verificationTier: report.verificationTier, decisionEligible: report.decisionEligible, createdAt: report.createdAt };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const replay = await this.db.oicEvaluationReport.findFirst({ where: { runId: run.id, resultDigest }, select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true } });
        if (replay) return replay;
      }
      throw error;
    }
  }

  async regradeRun(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const { sourceRunId, sourceReportId, gradingManifestId, bridgeRevisionId, idempotencyKey } = input;
    if ([sourceRunId, sourceReportId, gradingManifestId, bridgeRevisionId].some((value) => typeof value !== "string" || !uuidPattern.test(value)) || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey) || Object.keys(input).some((key) => !["sourceRunId", "sourceReportId", "gradingManifestId", "bridgeRevisionId", "idempotencyKey"].includes(key))) throw new BadRequestException("Invalid evaluation regrade identity");
    const existingPass = await this.db.oicEvaluationRegradePass.findFirst({ where: { ...this.requireScope(actor), idempotencyKey }, include: { report: { select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true } } } });
    if (existingPass) {
      if (existingPass.status !== "COMPLETE" || !existingPass.report || existingPass.sourceRunId !== sourceRunId || existingPass.gradingManifestId !== gradingManifestId || existingPass.bridgeRevisionId !== bridgeRevisionId) throw new ConflictException("EVALUATION_REGRADE_IDEMPOTENCY_CONFLICT");
      return { passId: existingPass.id, report: existingPass.report, provenance: "REGRADE_REPLAY", providerDispatches: 0, replayed: true };
    }
    if (!this.sealedOracle) throw new ConflictException("EVALUATION_REGRADE_VERIFIER_UNAVAILABLE");
    const run = await this.db.oicEvaluationRun.findFirst({
      where: { id: sourceRunId as string, ...this.requireScope(actor) },
      include: { manifest: { include: { release: true } }, cases: { orderBy: [{ caseRevisionId: "asc" }, { repetitionOrdinal: "asc" }], include: { attempts: { select: { id: true, status: true, admissionId: true, artifactManifest: true, evidenceDigest: true } } } } }
    });
    const sourceReport = await this.db.oicEvaluationReport.findFirst({ where: { id: sourceReportId as string, runId: sourceRunId as string } });
    const [bridge, gradingManifest] = await Promise.all([
      this.db.oicEvaluationBasisBridgeRevision.findFirst({ where: { id: bridgeRevisionId as string, ...this.requireScope(actor), status: "PUBLISHED", revokedAt: null } }),
      this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: gradingManifestId as string, ...this.requireScope(actor) } })
    ]);
    if (!run || !sourceReport || !bridge || !gradingManifest || run.status !== "EXECUTED" || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt || sourceReport.runId !== run.id || sourceReport.status !== "INCOMPLETE" || sourceReport.regradePassId !== null || sourceReport.effectiveGradingManifestId !== null) throw new ConflictException("EVALUATION_REGRADE_SOURCE_INVALID");
    if (run.applicationId !== bridge.applicationId || run.tenantId !== bridge.tenantId || gradingManifest.tenantId !== run.tenantId || bridge.sourceManifestId !== run.manifestId || bridge.targetGradingManifestId !== gradingManifest.id || gradingManifest.releaseId !== run.manifest.releaseId || run.manifest.canonicalDigest !== sha256(run.manifest.payload)) throw new ConflictException("EVALUATION_REGRADE_BRIDGE_SCOPE_INVALID");
    const sourceProtocol = object(run.manifest.payload);
    const gradingProtocol = object(gradingManifest.payload);
    if (gradingProtocol.evaluationPurpose !== "GRADING_REPLAY" || gradingManifest.canonicalDigest !== sha256(gradingManifest.payload) || canonicalJson(sourceProtocol.caseSchedule) !== canonicalJson(gradingProtocol.caseSchedule) || sourceProtocol.releaseDigest !== gradingProtocol.releaseDigest || sourceProtocol.environment === undefined || gradingProtocol.environment === undefined || canonicalJson(sourceProtocol.environment) !== canonicalJson(gradingProtocol.environment)) throw new ConflictException("EVALUATION_REGRADE_BASIS_INVALID");
    const metricRefs = Array.isArray(gradingProtocol.metricRevisions) ? gradingProtocol.metricRevisions : [];
    const idList = (items: unknown) => Array.isArray(items) ? items.map((item) => typeof item === "string" ? item : object(item).id).filter((item): item is string => typeof item === "string") : [];
    const gradingMetricRef = metricRefs.map(object).find((item) => item.id === bridge.targetMetricRevisionId);
    const sourceMetricRef = (Array.isArray(sourceProtocol.metricRevisions) ? sourceProtocol.metricRevisions : []).map(object).find((item) => item.id === bridge.sourceMetricRevisionId);
    const bridgeMethod = object(object(bridge.validationEvidence).method);
    if (!gradingMetricRef || !sourceMetricRef || bridge.bridgeType !== "RAW_OUTPUT_REGRADE" || !digestPattern.test(bridge.validationEvidenceDigest) || !digestPattern.test(bridge.bridgeDigest) || sha256(bridge.validationEvidence) !== bridge.validationEvidenceDigest || object(bridge.validationEvidence).result !== "VALID" || object(object(bridge.validationEvidence).sourceMetric).id !== bridge.sourceMetricRevisionId || object(object(bridge.validationEvidence).targetMetric).id !== bridge.targetMetricRevisionId || object(object(bridge.validationEvidence).sourceManifest).id !== run.manifestId || object(object(bridge.validationEvidence).targetGradingManifest).id !== gradingManifest.id || !idList(sourceProtocol.metricRevisions).includes(bridge.sourceMetricRevisionId) || !idList(sourceProtocol.judgeRevisions).includes(String(bridgeMethod.judgeId)) || !idList(gradingProtocol.judgeRevisions).includes(String(bridgeMethod.judgeId))) throw new ConflictException("EVALUATION_REGRADE_BRIDGE_INVALID");
    const [targetMetric, sourceMetric] = await Promise.all([
      this.db.oicEvaluationMetricRevision.findFirst({ where: { id: bridge.targetMetricRevisionId, applicationId: run.applicationId, tenantId: run.tenantId, status: "PUBLISHED" } }),
      this.db.oicEvaluationMetricRevision.findFirst({ where: { id: bridge.sourceMetricRevisionId, applicationId: run.applicationId, tenantId: run.tenantId, status: "PUBLISHED" } })
    ]);
    if (!targetMetric || !sourceMetric || targetMetric.revision !== gradingMetricRef.revision || targetMetric.metricKey !== "oic7-objective-exact-match" || object(targetMetric.definition).methodRevision !== bridge.targetMethodRevision || object(gradingMetricRef).definitionDigest !== targetMetric.definitionDigest || object(object(bridge.validationEvidence).targetMetric).digest !== targetMetric.definitionDigest || object(sourceMetricRef).definitionDigest !== sourceMetric.definitionDigest || object(object(bridge.validationEvidence).sourceMetric).digest !== sourceMetric.definitionDigest) throw new ConflictException("EVALUATION_REGRADE_METRIC_INVALID");
    const schedule = Array.isArray(sourceProtocol.caseSchedule) ? sourceProtocol.caseSchedule : [];
    if (run.cases.length !== run.plannedDenominator || run.cases.length !== schedule.length || run.cases.some((item, index) => item.caseRevisionId !== schedule[index] || item.status !== "EXECUTED" || item.attempts.length !== 1 || item.attempts.filter((attempt) => attempt.status === "SUCCEEDED" && attempt.admissionId).length !== 1)) throw new ConflictException("EVALUATION_REGRADE_CASE_SET_INVALID");

    const replayed: Array<{ execution: typeof run.cases[number]; attemptId: string; outputDigest: string; oracleEvidenceDigest: string; value: boolean | null; availability: string }> = [];
    for (const execution of run.cases) {
      const attempt = execution.attempts.find((item) => item.status === "SUCCEEDED" && item.admissionId);
      if (!attempt) throw new ConflictException("EVALUATION_REGRADE_ATTEMPT_INVALID");
      const outcome = object(execution.outcome);
      const output = object(outcome.output);
      if (typeof output.digest !== "string" || !digestPattern.test(output.digest) || !digestPattern.test(attempt.evidenceDigest ?? "")) throw new ConflictException("EVALUATION_REGRADE_OUTPUT_REFERENCE_INVALID");
      const oracleResult = await this.sealedOracle.verifyCaseExecution(execution.id);
      if (oracleResult.attemptId !== attempt.id || oracleResult.method !== OBJECTIVE_ORACLE_METHOD || !digestPattern.test(oracleResult.evidenceDigest)) throw new ConflictException("EVALUATION_REGRADE_VERIFICATION_INVALID");
      replayed.push({ execution, attemptId: attempt.id, outputDigest: output.digest, oracleEvidenceDigest: oracleResult.evidenceDigest, value: oracleResult.success, availability: oracleResult.availability });
    }
    const sourceSetDigest = sha256(replayed.map((item) => ({ caseExecutionId: item.execution.id, caseRevisionId: item.execution.caseRevisionId, attemptId: item.attemptId, outputDigest: item.outputDigest, oracleEvidenceDigest: item.oracleEvidenceDigest })));
    const definition = object(targetMetric.definition);
    const analysisMeasurements: AnalysisMeasurement[] = replayed.map((item) => ({ caseId: item.execution.caseRevisionId, trial: item.execution.repetitionOrdinal, metricKey: targetMetric.metricKey, metricRevision: targetMetric.revision, type: "BOOLEAN", unit: String(definition.unit), availability: item.availability, value: item.value, evidenceDigest: item.oracleEvidenceDigest }));
    const analysis = buildRunAnalysis({ plannedCases: run.plannedDenominator, terminalCases: replayed.length, expectedMetrics: [{ metricKey: targetMetric.metricKey, revision: targetMetric.revision, type: "BOOLEAN", unit: String(definition.unit), polarity: String(definition.polarity), minimumEffectiveN: Number(definition.minimumEffectiveN) }], measurements: analysisMeasurements, failures: [] });
    if (analysis.status !== "COMPLETE") throw new ConflictException("EVALUATION_REGRADE_INCOMPLETE");
    const now = new Date();
    const summary = { provenance: "REGRADE_REPLAY", sourceReportId: sourceReport.id, sourceRunId: run.id, sourceManifestId: run.manifestId, gradingManifestId: gradingManifest.id, bridgeRevisionId: bridge.id, bridgeDigest: bridge.bridgeDigest, sourceSetDigest, providerDispatches: 0, analysis, evidenceGraph: { sourceExecutions: replayed.map((item) => ({ caseExecutionId: item.execution.id, attemptId: item.attemptId, outputDigest: item.outputDigest, oracleEvidenceDigest: item.oracleEvidenceDigest, provenance: "REGRADE" })) }, decisionEligibility: { eligible: false, reasonCodes: ["PREDISPATCH_GATE_POLICY_AND_SAMPLE_REQUIREMENTS_NOT_ESTABLISHED"] } };
    const resultDigest = sha256(summary);
    try {
      const result = await this.db.$transaction(async (tx) => {
        const pass = await tx.oicEvaluationRegradePass.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, sourceRunId: run.id, sourceManifestId: run.manifestId, gradingManifestId: gradingManifest.id, bridgeRevisionId: bridge.id, idempotencyKey, sourceSetDigest, status: "COMPLETE", resultDigest, createdByPrincipalId: actor.id, completedAt: now } });
        for (const item of replayed) {
          const source = await tx.oicEvaluationRegradeSource.create({ data: { regradePassId: pass.id, caseExecutionId: item.execution.id, attemptId: item.attemptId, outputDigest: item.outputDigest, oracleEvidenceDigest: item.oracleEvidenceDigest } });
          await tx.oicEvaluationRegradeMeasurement.create({ data: { regradePassId: pass.id, regradeSourceId: source.id, caseExecutionId: item.execution.id, metricKey: targetMetric.metricKey, metricRevision: targetMetric.revision, judgeType: "REFERENCE", valueType: "BOOLEAN", value: item.value as Prisma.InputJsonValue, unit: String(definition.unit), polarity: String(definition.polarity), availability: item.availability, evidenceDigest: item.oracleEvidenceDigest, provenance: "REGRADE" } });
        }
        const latest = await tx.oicEvaluationReport.findFirst({ where: { runId: run.id }, orderBy: { analysisRevision: "desc" }, select: { analysisRevision: true } });
        const report = await tx.oicEvaluationReport.create({ data: { runId: run.id, analysisRevision: (latest?.analysisRevision ?? 0) + 1, status: "COMPLETE", resultDigest, summary: summary as Prisma.InputJsonValue, verificationTier: "OIC_EXECUTED_VERIFIED", decisionEligible: false, regradePassId: pass.id, effectiveGradingManifestId: gradingManifest.id, sourceReportId: sourceReport.id } });
        await tx.oicEvaluationOutbox.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, runId: null, eventKey: `regrade:${sha256(idempotencyKey)}`, eventType: "EVALUATION_REGRADE_COMPLETED", payload: { regradePassId: pass.id, reportId: report.id } } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.regrade.completed", targetType: "evaluation-regrade-pass", targetId: pass.id, requestId: idempotencyKey, metadata: { sourceRunId: run.id, sourceReportId: sourceReport.id, gradingManifestId: gradingManifest.id, bridgeRevisionId: bridge.id, reportId: report.id, sourceSetDigest, resultDigest, providerDispatches: 0 } } });
        return { pass, report };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { passId: result.pass.id, report: { id: result.report.id, runId: result.report.runId, analysisRevision: result.report.analysisRevision, status: result.report.status, resultDigest: result.report.resultDigest, verificationTier: result.report.verificationTier, decisionEligible: result.report.decisionEligible, createdAt: result.report.createdAt }, provenance: "REGRADE_REPLAY", providerDispatches: 0, replayed: false };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const prior = await this.db.oicEvaluationRegradePass.findFirst({ where: { applicationId: run.applicationId, tenantId: run.tenantId, idempotencyKey }, include: { report: { select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true } } } });
        if (prior?.status === "COMPLETE" && prior.report) return { passId: prior.id, report: prior.report, provenance: "REGRADE_REPLAY", providerDispatches: 0, replayed: true };
      }
      throw error;
    }
  }

  /** Creates a no-dispatch Parent projection whose only changed basis dimension is operational OIC-6 budget authority. */
  async rebaselinePacket76BudgetBasis(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const { sourceRunId, sourceReportId, targetManifestId, bridgeRevisionId, idempotencyKey } = input;
    if ([sourceRunId, sourceReportId, targetManifestId, bridgeRevisionId].some((value) => typeof value !== "string" || !uuidPattern.test(value))
      || typeof idempotencyKey !== "string" || !/^packet76-budget-rebaseline:[A-Za-z0-9._:-]{8,96}$/.test(idempotencyKey)
      || Object.keys(input).some((key) => !["sourceRunId", "sourceReportId", "targetManifestId", "bridgeRevisionId", "idempotencyKey"].includes(key))) throw new BadRequestException("Invalid Packet 7.6 budget rebaseline identity");
    const prior = await this.db.oicEvaluationRegradePass.findFirst({ where: { ...this.requireScope(actor), idempotencyKey }, include: { report: { select: { id: true, runId: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true } } } });
    if (prior) {
      if (prior.status !== "COMPLETE" || !prior.report || prior.sourceRunId !== sourceRunId || prior.gradingManifestId !== targetManifestId || prior.bridgeRevisionId !== bridgeRevisionId) throw new ConflictException("PACKET76_BUDGET_REBASELINE_IDEMPOTENCY_CONFLICT");
      return { passId: prior.id, report: prior.report, providerDispatches: 0, admissions: 0, targetExecutions: 0, replayed: true };
    }
    const [run, sourceReport, bridge, targetManifest] = await Promise.all([
      this.db.oicEvaluationRun.findFirst({ where: { id: sourceRunId as string, ...this.requireScope(actor) }, include: { manifest: { include: { release: true } }, cases: { orderBy: [{ caseRevisionId: "asc" }, { repetitionOrdinal: "asc" }], include: { attempts: { select: { id: true, status: true, admissionId: true, evidenceDigest: true, artifactManifest: true, providerAttemptId: true, providerDispatchStartedAt: true } }, measurements: { select: { id: true, metricKey: true, metricRevision: true, valueType: true, value: true, unit: true, polarity: true, availability: true, evidenceDigest: true, judgeType: true } } } } } }),
      this.db.oicEvaluationReport.findFirst({ where: { id: sourceReportId as string, runId: sourceRunId as string } }),
      this.db.oicEvaluationBasisBridgeRevision.findFirst({ where: { id: bridgeRevisionId as string, ...this.requireScope(actor), status: "PUBLISHED", revokedAt: null } }),
      this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: targetManifestId as string, ...this.requireScope(actor) }, include: { release: { select: { id: true, status: true, compromisedAt: true, manifestDigest: true, caseManifest: true } } } })
    ]);
    if (!run || !sourceReport || !bridge || !targetManifest || sourceReport.runId !== run.id || run.status !== "EXECUTED" || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt
      || sourceReport.status !== "COMPLETE" || sourceReport.verificationTier !== "OIC_EXECUTED_VERIFIED" || sourceReport.decisionEligible !== true || sourceReport.regradePassId !== null || sourceReport.effectiveGradingManifestId !== null
      || targetManifest.releaseId !== run.manifest.releaseId || targetManifest.release.status !== "PUBLISHED" || targetManifest.release.compromisedAt) throw new ConflictException("PACKET76_BUDGET_REBASELINE_SOURCE_INVALID");
    const latest = await this.db.oicEvaluationReport.findFirst({ where: { runId: run.id }, orderBy: [{ analysisRevision: "desc" }], select: { id: true } });
    if (latest?.id !== sourceReport.id) throw new ConflictException("PACKET76_BUDGET_REBASELINE_SOURCE_NOT_LATEST");
    if (bridge.bridgeType !== "OPERATIONAL_BUDGET_REBASELINE" || bridge.sourceManifestId !== run.manifestId || bridge.targetGradingManifestId !== targetManifest.id
      || bridge.validationEvidenceDigest !== sha256(bridge.validationEvidence) || object(bridge.validationEvidence).result !== "VALID"
      || object(object(bridge.validationEvidence).sourceManifest).digest !== run.manifest.canonicalDigest || object(object(bridge.validationEvidence).targetManifest).digest !== targetManifest.canonicalDigest) throw new ConflictException("PACKET76_BUDGET_REBASELINE_BRIDGE_INVALID");
    const sourceProtocol = object(run.manifest.payload);
    const targetProtocol = object(targetManifest.payload);
    const budgetRefs = [object(sourceProtocol.budgetPolicy), object(targetProtocol.budgetPolicy)];
    const budgets = await this.db.oicBudgetRevision.findMany({ where: { id: { in: budgetRefs.map((item) => String(item.budgetRevisionId)) }, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, applicationId: true, tenantId: true, planRevisionId: true, sourceDigest: true, status: true, unit: true, enforcement: true, amount: true, reservationUpperBound: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true } });
    const toBudget = (id: unknown) => { const row = budgets.find((item) => item.id === id); return row ? { ...row, amount: row.amount.toString(), reservationUpperBound: row.reservationUpperBound?.toString() ?? null } : null; };
    const sourceBudget = toBudget(budgetRefs[0]!.budgetRevisionId)!;
    const targetBudget = toBudget(budgetRefs[1]!.budgetRevisionId)!;
    const planIds = [sourceBudget.planRevisionId, targetBudget.planRevisionId].filter((id): id is string => typeof id === "string");
    const planRevisions = await this.db.oicPlanRevision.findMany({ where: { id: { in: planIds } }, include: { plan: { select: { planKey: true, applicationId: true } } } });
    const planContinuity = (id: string | null | undefined) => {
      const plan = planRevisions.find((item) => item.id === id);
      if (!plan) return null;
      const entitlements = object(plan.entitlements);
      return { id: plan.id, planKey: plan.plan.planKey, applicationId: plan.plan.applicationId, status: plan.status, effectiveFrom: plan.effectiveFrom, effectiveTo: plan.effectiveTo, models: Array.isArray(entitlements.models) ? entitlements.models.filter((value): value is string => typeof value === "string").sort() : [], maxOutputUnits: plan.maxOutputUnits, maxConcurrency: plan.maxConcurrency };
    };
    const sourcePlan = planContinuity(sourceBudget.planRevisionId);
    const targetPlan = planContinuity(targetBudget.planRevisionId);
    const modelId = object(object(targetProtocol.targetIdentity).resolvedTarget).modelId;
    const validation = validateOperationalBudgetRebaseline({ sourceManifestId: run.manifest.id, sourceDigest: run.manifest.canonicalDigest, sourceProtocol, targetManifestId: targetManifest.id, targetDigest: targetManifest.canonicalDigest, targetProtocol, sourceBudget, targetBudget, admissionPlanContinuity: sourcePlan && targetPlan && typeof modelId === "string" ? { source: sourcePlan, target: targetPlan, modelId } : undefined, now: new Date() });
    if (!validation.valid) throw new ConflictException("PACKET76_BUDGET_REBASELINE_SEMANTIC_MISMATCH");
    const schedule = Array.isArray(sourceProtocol.caseSchedule) ? sourceProtocol.caseSchedule : [];
    if (run.cases.length !== 2 || run.cases.length !== run.plannedDenominator || run.plannedTrials !== 2 || schedule.length !== 1
      || run.cases.some((item, index) => item.caseRevisionId !== schedule[0] || item.repetitionOrdinal !== index + 1 || item.status !== "EXECUTED" || item.attempts.filter((attempt) => attempt.status === "SUCCEEDED" && attempt.admissionId).length !== 1 || !item.measurements.some((measurement) => measurement.metricKey === "oic7-objective-exact-match" && measurement.metricRevision === 2 && measurement.valueType === "BOOLEAN" && measurement.availability === "MEASURED" && digestPattern.test(measurement.evidenceDigest ?? "")))) throw new ConflictException("PACKET76_BUDGET_REBASELINE_OBSERVATION_SET_INVALID");
    const allAdmissionIds = [...new Set(run.cases.flatMap((item) => item.attempts.map((attempt) => attempt.admissionId).filter((id): id is string => Boolean(id))))];
    const admissions = allAdmissionIds.length ? await this.db.oicAdmission.findMany({ where: { id: { in: allAdmissionIds }, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, status: true, createdAt: true, capacityExtensionId: true, legs: { select: { amount: true, state: true, budgetRevisionId: true, bucket: { select: { unit: true } } } } } }) : [];
    const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
    const extensionIds = [...new Set(admissions.map((admission) => admission.capacityExtensionId).filter((id): id is string => Boolean(id)))];
    const sourceBudgetReference = object(sourceProtocol.budgetPolicy).budgetRevisionId;
    const sourceCohortReference = object(sourceProtocol.cohort).cohortKey;
    const sourceBudgetRevisionId = typeof sourceBudgetReference === "string" ? sourceBudgetReference : "";
    const sourceCohortKey = typeof sourceCohortReference === "string" ? sourceCohortReference : "";
    const extensions = extensionIds.length && run.campaignId ? await this.db.oicEvaluationCapacityExtension.findMany({
      where: { id: { in: extensionIds }, applicationId: run.applicationId, tenantId: run.tenantId, campaignId: run.campaignId, runId: run.id, baseBudgetRevisionId: sourceBudgetRevisionId, cohortKey: sourceCohortKey },
      select: { id: true, applicationId: true, tenantId: true, runId: true, campaignId: true, cohortKey: true, status: true, baseBudgetRevisionId: true, budgetRevisionId: true, authorizedOiu: true, perAdmissionLimitOiu: true, expiresAt: true, budgetRevision: { select: { id: true, status: true, unit: true, enforcement: true, unknownLiabilityRule: true, amount: true, reservationUpperBound: true, effectiveFrom: true, effectiveTo: true } } }
    }) : [];
    const extensionById = new Map(extensions.map((extension) => [extension.id, extension]));
    const historySafe = packet76PreDispatchHistorySafe(run.cases.flatMap((item) => item.attempts.filter((attempt) => attempt.status !== "SUCCEEDED").map((attempt) => {
      const admission = attempt.admissionId ? admissionById.get(attempt.admissionId) : undefined;
      return { status: attempt.status, providerDispatched: !!attempt.providerAttemptId || !!attempt.providerDispatchStartedAt, evidenceDigestPresent: digestPattern.test(attempt.evidenceDigest ?? ""), artifactPresent: Object.keys(object(attempt.artifactManifest)).length > 0, admissionStatus: admission?.status ?? (attempt.admissionId ? "UNKNOWN" : null), linkedProviderAttemptCount: attempt.providerAttemptId ? 1 : 0 };
    })));
    const successfulAttempts = run.cases.map((item) => item.attempts.find((attempt) => attempt.status === "SUCCEEDED" && attempt.admissionId)!);
    const providerAttempts = allAdmissionIds.length ? await this.db.oicProviderAttempt.findMany({ where: { admissionId: { in: allAdmissionIds } }, select: { id: true, admissionId: true, status: true, usageStatus: true, providerKey: true, upstreamModelId: true, bindingId: true, connectionId: true, startedAt: true } }) : [];
    const resolvedTarget = object(object(run.manifest.payload).targetIdentity).resolvedTarget;
    const resolvedTargetFields = object(resolvedTarget);
    const expectedProvider = { providerKey: typeof resolvedTargetFields.providerKey === "string" ? resolvedTargetFields.providerKey : "", upstreamModelId: typeof resolvedTargetFields.upstreamModelRef === "string" ? resolvedTargetFields.upstreamModelRef : "", bindingId: typeof resolvedTargetFields.bindingId === "string" ? resolvedTargetFields.bindingId : "", connectionId: typeof resolvedTargetFields.providerConnectionId === "string" ? resolvedTargetFields.providerConnectionId : "" };
    const providerLinks = new Map(successfulAttempts.map((attempt) => [attempt.id, resolvePacket76ProviderDispatchLink({ attempt: { providerAttemptId: attempt.providerAttemptId, providerDispatchStartedAt: attempt.providerDispatchStartedAt, admissionId: attempt.admissionId }, providerAttempts, expected: expectedProvider })]));
    if (!historySafe || admissions.length !== allAdmissionIds.length || successfulAttempts.some((attempt) => {
      const admission = admissionById.get(attempt.admissionId!);
      const leg = admission?.legs[0];
      const extension = admission?.capacityExtensionId ? extensionById.get(admission.capacityExtensionId) : undefined;
      const admissionFundingValid = !!admission && !!leg && packet76AdmissionBudgetIsAuthorized({
        sourceBudgetRevisionId, admissionBudgetRevisionId: leg.budgetRevisionId, admissionCapacityExtensionId: admission.capacityExtensionId,
        admissionCreatedAt: admission.createdAt, applicationId: run.applicationId, tenantId: run.tenantId, runId: run.id, campaignId: run.campaignId,
        cohortKey: sourceCohortKey, legAmount: leg.amount.toString(), legState: leg.state, legUnit: leg.bucket.unit,
        ...(extension ? { extension: { ...extension, authorizedOiu: extension.authorizedOiu.toString(), perAdmissionLimitOiu: extension.perAdmissionLimitOiu.toString(), budget: { ...extension.budgetRevision, amount: extension.budgetRevision.amount.toString(), reservationUpperBound: extension.budgetRevision.reservationUpperBound?.toString() ?? null } } } : {})
      });
      return !digestPattern.test(attempt.evidenceDigest ?? "") || !providerLinks.get(attempt.id)?.valid || !admission || admission.status !== "SETTLED" || admission.legs.length !== 1 || !admissionFundingValid;
    })) throw new ConflictException("PACKET76_BUDGET_REBASELINE_ADMISSION_EVIDENCE_INVALID");
    const sourceEntries = run.cases.map((item, index) => {
      const attempt = successfulAttempts[index]!;
      const outputDigest = object(object(item.outcome).output).digest;
      if (typeof outputDigest !== "string" || !digestPattern.test(outputDigest)) throw new ConflictException("PACKET76_BUDGET_REBASELINE_OUTPUT_EVIDENCE_INVALID");
      const providerLink = providerLinks.get(attempt.id)!;
      const admission = admissionById.get(attempt.admissionId!);
      return { caseExecutionId: item.id, caseRevisionId: item.caseRevisionId, repetitionOrdinal: item.repetitionOrdinal, attemptId: attempt.id, admissionId: attempt.admissionId, admissionBudgetRevisionId: admission?.legs[0]?.budgetRevisionId ?? null, capacityExtensionId: admission?.capacityExtensionId ?? null, providerAttemptId: providerLink.providerAttemptId, providerAttemptLinkage: providerLink.linkage, providerDispatchStartedAt: providerLink.providerDispatchStartedAt?.toISOString() ?? null, outputDigest, attemptEvidenceDigest: attempt.evidenceDigest, measurements: item.measurements.map((measurement) => ({ id: measurement.id, metricKey: measurement.metricKey, metricRevision: measurement.metricRevision, valueType: measurement.valueType, value: measurement.value, unit: measurement.unit, polarity: measurement.polarity, availability: measurement.availability, evidenceDigest: measurement.evidenceDigest, judgeType: measurement.judgeType })) };
    });
    const safeFailureHistory = run.cases.flatMap((item) => item.attempts.filter((attempt) => attempt.status !== "SUCCEEDED").map((attempt) => ({ caseExecutionId: item.id, attemptId: attempt.id, status: attempt.status, providerDispatched: !!attempt.providerAttemptId || !!attempt.providerDispatchStartedAt, admissionStatus: attempt.admissionId ? admissionById.get(attempt.admissionId)?.status ?? "UNKNOWN" : null })));
    const sourceSetDigest = sha256({ originalReportId: sourceReport.id, originalResultDigest: sourceReport.resultDigest, sourceManifestId: run.manifestId, targetManifestId: targetManifest.id, observations: sourceEntries, safeFailureHistory });
    const sourceSummary = object(sourceReport.summary);
    const summary = { ...sourceSummary, provenance: "OPERATIONAL_BUDGET_REBASELINE", sourceReportId: sourceReport.id, sourceRunId: run.id, sourceManifestId: run.manifestId, gradingManifestId: targetManifest.id, bridgeRevisionId: bridge.id, bridgeDigest: bridge.bridgeDigest, sourceSetDigest, providerDispatches: 0, admissions: 0, targetExecutions: 0, preservedEvidence: { measurementValuesCopiedWithoutRescoring: true, observationCount: sourceEntries.length, sourceMeasurementDigest: sha256(sourceEntries.map((entry) => entry.measurements)) }, providerDispatchLineage: sourceEntries.map((entry) => ({ caseExecutionId: entry.caseExecutionId, repetitionOrdinal: entry.repetitionOrdinal, admissionId: entry.admissionId, admissionBudgetRevisionId: entry.admissionBudgetRevisionId, capacityExtensionId: entry.capacityExtensionId, providerAttemptId: entry.providerAttemptId, linkage: entry.providerAttemptLinkage, providerDispatchStartedAt: entry.providerDispatchStartedAt })), operationalBudgetRebaseline: { oldBudgetRevisionId: object(sourceProtocol.budgetPolicy).budgetRevisionId, newBudgetRevisionId: object(targetProtocol.budgetPolicy).budgetRevisionId, bridgeType: bridge.bridgeType, reason: "EXPIRED_OPERATIONAL_BUDGET_REBASELINE" } };
    const resultDigest = sha256(summary);
    const now = new Date();
    const projected = await this.db.$transaction(async (tx) => {
      const pass = await tx.oicEvaluationRegradePass.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, sourceRunId: run.id, sourceManifestId: run.manifestId, gradingManifestId: targetManifest.id, bridgeRevisionId: bridge.id, idempotencyKey, sourceSetDigest, status: "COMPLETE", resultDigest, createdByPrincipalId: actor.id, completedAt: now } });
      for (const item of sourceEntries) await tx.oicEvaluationRegradeSource.create({ data: { regradePassId: pass.id, caseExecutionId: item.caseExecutionId, attemptId: item.attemptId, outputDigest: item.outputDigest, oracleEvidenceDigest: item.measurements.find((measurement) => measurement.metricKey === "oic7-objective-exact-match")!.evidenceDigest! } });
      const latestRevision = await tx.oicEvaluationReport.findFirst({ where: { runId: run.id }, orderBy: [{ analysisRevision: "desc" }], select: { analysisRevision: true } });
      const report = await tx.oicEvaluationReport.create({ data: { runId: run.id, analysisRevision: (latestRevision?.analysisRevision ?? 0) + 1, status: sourceReport.status, resultDigest, summary: summary as Prisma.InputJsonValue, verificationTier: sourceReport.verificationTier, decisionEligible: sourceReport.decisionEligible, regradePassId: pass.id, effectiveGradingManifestId: targetManifest.id, sourceReportId: sourceReport.id } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.budget_rebaseline.projected", targetType: "evaluation-report", targetId: report.id, metadata: { sourceReportId: sourceReport.id, sourceRunId: run.id, sourceManifestId: run.manifestId, targetManifestId: targetManifest.id, bridgeRevisionId: bridge.id, bridgeDigest: bridge.bridgeDigest, sourceSetDigest, resultDigest, preservedDecisionEligibility: sourceReport.decisionEligible, providerDispatches: 0, admissions: 0, targetExecutions: 0 } } });
      return { passId: pass.id, report: { id: report.id, runId: report.runId, analysisRevision: report.analysisRevision, status: report.status, resultDigest: report.resultDigest, verificationTier: report.verificationTier, decisionEligible: report.decisionEligible, createdAt: report.createdAt } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ...projected, providerDispatches: 0, admissions: 0, targetExecutions: 0, replayed: false };
  }

  async compareReports(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const baselineId = input.baselineReportId;
    const candidateId = input.candidateReportId;
    if (typeof baselineId !== "string" || !uuidPattern.test(baselineId) || typeof candidateId !== "string" || !uuidPattern.test(candidateId) || baselineId === candidateId) throw new BadRequestException("Two distinct scoped report IDs are required");
    const reports = await this.db.oicEvaluationReport.findMany({
      where: { id: { in: [baselineId, candidateId] }, run: this.requireScope(actor) },
      include: { effectiveGradingManifest: true, regradePass: { include: { bridgeRevision: true } }, run: { include: { manifest: { include: { release: { include: { pack: { select: { domain: true } } } } } }, cases: { include: { measurements: true } } } } }
    });
    const baseline = reports.find((item) => item.id === baselineId);
    const candidate = reports.find((item) => item.id === candidateId);
    if (!baseline || !candidate || reports.length !== 2) throw new NotFoundException();
    if (baseline.run.applicationId !== candidate.run.applicationId || baseline.run.tenantId !== candidate.run.tenantId) throw new NotFoundException();
    const baselineProtocol = object((baseline.effectiveGradingManifest ?? baseline.run.manifest).payload);
    const candidateProtocol = object((candidate.effectiveGradingManifest ?? candidate.run.manifest).payload);
    if (baseline.regradePass && (baseline.regradePass.status !== "COMPLETE" || baseline.regradePass.bridgeRevision.status !== "PUBLISHED" || baseline.regradePass.bridgeRevision.revokedAt || baseline.regradePass.sourceManifestId !== baseline.run.manifestId || baseline.regradePass.gradingManifestId !== baseline.effectiveGradingManifestId)) throw new ConflictException("COMPARISON_REGRADE_LINEAGE_INVALID");
    const environmentDigest = (protocol: Record<string, unknown>) => typeof object(protocol.environment).digest === "string" ? object(protocol.environment).digest as string : "NONE";
    const caseIds = (report: typeof baseline) => report.run.cases.map((row) => row.caseRevisionId);
    let comparable = compareProtocols({
      targetClass: baseline.run.targetClass, treatmentKey: baseline.run.targetFingerprint,
      releaseId: baseline.run.manifest.releaseId, harnessDigest: typeof baselineProtocol.harnessDigest === "string" ? baselineProtocol.harnessDigest : "NONE",
      environmentDigest: environmentDigest(baselineProtocol), oracleRevision: typeof baselineProtocol.oracleRevision === "string" ? baselineProtocol.oracleRevision : "NONE",
      metricRevision: sha256(baselineProtocol.metricRevisions ?? []), judgeRevision: sha256(baselineProtocol.judgeRevisions ?? []),
      samplingRevision: sha256({ samplingPolicy: baselineProtocol.samplingPolicy ?? null, repetitionPolicy: baselineProtocol.repetitionPolicy ?? null }),
      retryRevision: sha256(baselineProtocol.retryPolicy ?? null), caseIds: caseIds(baseline), verificationTier: baseline.verificationTier,
      holdoutCompromised: baseline.run.manifest.release.status === "COMPROMISED" || !!baseline.run.manifest.release.compromisedAt,
      releaseEligible: baseline.run.manifest.release.status === "PUBLISHED" && !baseline.run.manifest.release.compromisedAt,
      evidenceComplete: baseline.status === "COMPLETE" && baseline.verificationTier === "OIC_EXECUTED_VERIFIED",
      bridgeValidated: baseline.regradePass ? true : undefined
    }, {
      targetClass: candidate.run.targetClass, treatmentKey: typeof object(candidate.run.manifest.payload).candidateTreatmentFingerprint === "string" ? object(candidate.run.manifest.payload).candidateTreatmentFingerprint as string : candidate.run.targetFingerprint,
      releaseId: candidate.run.manifest.releaseId, harnessDigest: typeof candidateProtocol.harnessDigest === "string" ? candidateProtocol.harnessDigest : "NONE",
      environmentDigest: environmentDigest(candidateProtocol), oracleRevision: typeof candidateProtocol.oracleRevision === "string" ? candidateProtocol.oracleRevision : "NONE",
      metricRevision: sha256(candidateProtocol.metricRevisions ?? []), judgeRevision: sha256(candidateProtocol.judgeRevisions ?? []),
      samplingRevision: sha256({ samplingPolicy: candidateProtocol.samplingPolicy ?? null, repetitionPolicy: candidateProtocol.repetitionPolicy ?? null }),
      retryRevision: sha256(candidateProtocol.retryPolicy ?? null), caseIds: caseIds(candidate), verificationTier: candidate.verificationTier,
      holdoutCompromised: candidate.run.manifest.release.status === "COMPROMISED" || !!candidate.run.manifest.release.compromisedAt,
      releaseEligible: candidate.run.manifest.release.status === "PUBLISHED" && !candidate.run.manifest.release.compromisedAt,
      evidenceComplete: candidate.status === "COMPLETE" && candidate.verificationTier === "OIC_EXECUTED_VERIFIED"
    });
    const candidateRevision = object(candidateProtocol.candidateRevision);
    if (typeof candidateProtocol.candidateTreatmentFingerprint !== "string" || candidateRevision.treatmentFingerprint !== candidateProtocol.candidateTreatmentFingerprint || candidateRevision.parentTargetFingerprint !== baseline.run.targetFingerprint || typeof candidateRevision.changeDigest !== "string" || sha256({ parentTargetFingerprint: candidateRevision.parentTargetFingerprint, changeDigest: candidateRevision.changeDigest }) !== candidateProtocol.candidateTreatmentFingerprint) {
      comparable = { status: "NOT_COMPARABLE", reasonCodes: [...new Set([...comparable.reasonCodes, "CANDIDATE_TREATMENT_LINEAGE_INVALID"])].sort(), commonCaseIds: [], decisionEligible: false };
    }
    const estimates: Array<Record<string, unknown>> = [];
    const baselineSummary = object(baseline.summary);
    const candidateSummary = object(candidate.summary);
    const baselineAnalysis = object(baselineSummary.analysis);
    const candidateAnalysis = object(candidateSummary.analysis);
    if (["DIRECTLY_COMPARABLE", "MATCHED_SUBSET_COMPARABLE"].includes(comparable.status)) {
      const leftMetrics = Array.isArray(baselineAnalysis.metrics) ? baselineAnalysis.metrics.map(object) : [];
      const rightMetrics = Array.isArray(candidateAnalysis.metrics) ? candidateAnalysis.metrics.map(object) : [];
      for (const left of leftMetrics) {
        const right = rightMetrics.find((item) => item.metricKey === left.metricKey && item.revision === left.revision && item.unit === left.unit);
        if (!right || !Array.isArray(left.trials) || !Array.isArray(right.trials)) continue;
        const leftTrials = left.trials.map(object);
        const rightTrials = right.trials.map(object);
        const plannedRepetitions = Math.max(1, Number(object(baselineProtocol.repetitionPolicy).plannedRepetitions ?? 1));
        const plan = new Set(baseline.run.cases.map((item) => item.caseRevisionId)).size * plannedRepetitions;
        const seedText = sha256({ baselineId, candidateId, metricKey: left.metricKey, revision: left.revision });
        const estimate = estimatePairedMetric({
          baseline: leftTrials.map((item) => ({ caseId: String(item.caseId), trial: Number(item.trial), value: item.value, availability: String(item.availability) })),
          candidate: rightTrials.map((item) => ({ caseId: String(item.caseId), trial: Number(item.trial), value: item.value, availability: String(item.availability) })),
          valueType: String(left.type), plannedPairs: plan, minimumCases: Math.max(1, Number(left.minimumEffectiveN ?? 1)), seed: Number.parseInt(seedText.slice(0, 8), 16)
        });
        estimates.push({ metricKey: left.metricKey, revision: left.revision, unit: left.unit, ...estimate });
      }
    }
    const gate = object(candidateProtocol.preDispatchDecisionGate);
    const candidateCohort = object(candidateProtocol.cohort);
    const baselineCohort = object(baselineProtocol.cohort);
    const expectedPairs = (run: typeof baseline.run) => run.cases.map((item) => `${item.caseRevisionId}:${item.repetitionOrdinal}`).sort();
    const baselinePairs = expectedPairs(baseline.run);
    const candidatePairs = expectedPairs(candidate.run);
    const baselineParentLinkValid = candidateRevision.parentManifestId === baseline.run.manifest.id
      ? gate.parentManifestId === baseline.run.manifest.id && gate.parentManifestDigest === baseline.run.manifest.canonicalDigest
      : candidateRevision.parentReportId === baseline.id && baseline.regradePass?.bridgeRevision.bridgeType === "OPERATIONAL_BUDGET_REBASELINE"
        && baseline.effectiveGradingManifest?.id === gate.parentManifestId && baseline.effectiveGradingManifest?.canonicalDigest === gate.parentManifestDigest;
    const candidateRevisionValid = baselineParentLinkValid
      && candidateCohort.cohortKey === baselineCohort.cohortKey
      && typeof candidateCohort.cohortKey === "string"
      && baseline.run.plannedDenominator === 2 && candidate.run.plannedDenominator === 2
      && Number(object(baselineProtocol.repetitionPolicy).plannedRepetitions) === 2
      && Number(object(candidateProtocol.repetitionPolicy).plannedRepetitions) === 2
      && validatePacket76Cohort(baselineCohort, [...new Set(baseline.run.cases.map((item) => item.caseRevisionId))], 2).valid
      && validatePacket76Cohort(candidateCohort, [...new Set(candidate.run.cases.map((item) => item.caseRevisionId))], 2).valid
      && baselinePairs.length === 2 && candidatePairs.length === 2
      && baselinePairs[0] === candidatePairs[0] && baselinePairs[1] === candidatePairs[1]
      && baseline.run.cases.map((item) => item.repetitionOrdinal).sort().join(",") === "1,2"
      && candidate.run.cases.map((item) => item.repetitionOrdinal).sort().join(",") === "1,2";
    const releaseEligibleForDecision = baseline.run.manifest.release.status === "PUBLISHED" && candidate.run.manifest.release.status === "PUBLISHED"
      && baseline.run.manifest.release.releaseTier === "PRIVATE_HOLDOUT" && candidate.run.manifest.release.releaseTier === "PRIVATE_HOLDOUT"
      && !baseline.run.manifest.release.compromisedAt && !candidate.run.manifest.release.compromisedAt;
    const criticalSlice = baseline.run.manifest.release.pack.domain;
    const criticalSlices = Array.isArray(gate.criticalSlices) ? gate.criticalSlices : [];
    const criticalSliceCovered = typeof criticalSlice === "string" && criticalSlices.length === 1 && criticalSlices[0] === criticalSlice && candidate.run.manifest.release.pack.domain === criticalSlice;
    const decisionGate = packet76ComparisonEligibility({
      gate, cohortValid: candidateRevisionValid, reportsEligible: baseline.decisionEligible && candidate.decisionEligible,
      freshHoldout: releaseEligibleForDecision, criticalSliceCovered, directlyComparable: comparable.status === "DIRECTLY_COMPARABLE",
      estimates: estimates.map((estimate) => ({ availability: String(estimate.availability), pairedTrials: Number(estimate.pairedTrials), plannedPairs: Number(estimate.plannedPairs), missingPairs: Number(estimate.missingPairs), confidence: typeof object(estimate.interval).confidence === "number" ? object(estimate.interval).confidence as number : null }))
    });
    const decisionEligible = decisionGate.eligible;
    const reasonCodes = [...new Set([...comparable.reasonCodes, ...decisionGate.reasonCodes])].sort();
    const methodRevision = "oic-paired-report-comparison-v1";
    const coverage = { baseline: baselineSummary.analysis && object(baselineSummary.analysis).completeness, candidate: candidateSummary.analysis && object(candidateSummary.analysis).completeness, commonCases: comparable.commonCaseIds.length };
    const result = await this.db.$transaction(async (tx) => {
      const existing = await tx.oicEvaluationComparison.findFirst({ where: { baselineReportId: baseline.id, candidateReportId: candidate.id, methodRevision }, orderBy: { projectionRevision: "desc" } });
      const projection = { outcome: comparable.status, reasonCodes, commonCases: comparable.commonCaseIds.length, coverage, estimates, decisionEligible };
      if (existing && canonicalJson({ outcome: existing.outcome, reasonCodes: existing.reasonCodes, commonCases: existing.commonCases, coverage: existing.coverage, estimates: existing.estimates, decisionEligible: existing.decisionEligible }) === canonicalJson(projection)) return existing;
      const projectionRevision = (existing?.projectionRevision ?? 0) + 1;
      const row = await tx.oicEvaluationComparison.create({ data: {
        baselineReportId: baseline.id, candidateReportId: candidate.id, projectionRevision, outcome: comparable.status, reasonCodes,
        commonCases: comparable.commonCaseIds.length, coverage: coverage as Prisma.InputJsonValue, estimates: estimates as Prisma.InputJsonValue,
        methodRevision, decisionEligible
      } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: baseline.run.applicationId, tenantId: baseline.run.tenantId, action: "evaluation.reports.compared", targetType: "evaluation-comparison", targetId: row.id, metadata: { baselineReportId: baseline.id, candidateReportId: candidate.id, methodRevision, projectionRevision, supersedesComparisonId: existing?.id ?? null, outcome: comparable.status, decisionEligible } } });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { id: result.id, projectionRevision: result.projectionRevision, outcome: result.outcome, reasonCodes: result.reasonCodes, commonCases: result.commonCases, coverage: result.coverage, estimates: result.estimates, methodRevision: result.methodRevision, decisionEligible: result.decisionEligible };
  }

  async listCampaigns(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationCampaign.findMany({ where: scope, orderBy: [{ createdAt: "desc" }], take: 100, select: { id: true, releaseId: true, campaignKey: true, status: true, budgetRevisionId: true, budgetLimitOiu: true, reservationPerAttemptOiu: true, reservedOiu: true, createdAt: true, _count: { select: { runs: true } } } });
  }

  async listWork(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationWorkItem.findMany({ where: { run: scope }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, runId: true, caseExecutionId: true, status: true, attemptCount: true, maxAttempts: true, lastFailureClass: true, availableAt: true, leaseUntil: true, updatedAt: true } });
  }

  async listOutbox(actor: AuthenticatedPrincipal, applicationId?: string, tenantId?: string) {
    const scope = this.requireScope(actor, applicationId, tenantId);
    return this.db.oicEvaluationOutbox.findMany({ where: { run: scope }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, runId: true, eventType: true, status: true, attemptCount: true, lastFailureClass: true, availableAt: true, publishedAt: true } });
  }

  async createCandidate(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const candidateKey = input.candidateKey;
    const parentReportId = input.parentReportId;
    const parentManifestId = input.parentManifestId;
    const changeSet = object(input.changeSet);
    const instruction = changeSet.instruction;
    const isReportParent = typeof parentReportId === "string" && uuidPattern.test(parentReportId) && parentManifestId === undefined;
    const isManifestParent = typeof parentManifestId === "string" && uuidPattern.test(parentManifestId) && parentReportId === undefined;
    if (Object.keys(input).some((key) => !["candidateKey", "parentReportId", "parentManifestId", "changeSet"].includes(key)) || typeof candidateKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(candidateKey) || (!isReportParent && !isManifestParent) || Object.keys(changeSet).sort().join(",") !== "instruction,type" || changeSet.type !== "SYSTEM_INSTRUCTION" || typeof instruction !== "string" || instruction.trim().length < 16 || instruction.length > 512) throw new BadRequestException("A bounded single-instruction candidate change and one valid parent basis are required");
    const [parent, parentManifest] = await Promise.all([
      isReportParent ? this.db.oicEvaluationReport.findFirst({ where: { id: parentReportId, run: this.requireScope(actor) }, include: { run: { include: { manifest: { include: { release: true } } } } } }) : null,
      isManifestParent ? this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: parentManifestId, ...this.requireScope(actor) }, include: { release: true } }) : null
    ]);
    const parentProtocol = object(parentManifest?.payload);
    const parentTargetClass = parent?.run.targetClass ?? parentManifest?.targetClass;
    const parentTargetFingerprint = parent?.run.targetFingerprint ?? parentProtocol.targetFingerprint;
    const appId = parent?.run.applicationId ?? parentManifest?.applicationId;
    const tenantId = parent?.run.tenantId ?? parentManifest?.tenantId;
    const validReport = !!parent && parent.run.status === "EXECUTED" && parent.run.manifest.release.status === "PUBLISHED" && !parent.run.manifest.release.compromisedAt;
    const validManifest = !!parentManifest && parentManifest.canonicalDigest === sha256(parentManifest.payload) && parentProtocol.evaluationPurpose !== "GRADING_REPLAY" && parentManifest.release.status === "PUBLISHED" && !parentManifest.release.compromisedAt && parentManifest.targetClass === "MODEL_WITH_OIC_RUNTIME" && typeof parentTargetFingerprint === "string" && digestPattern.test(parentTargetFingerprint);
    if (parentTargetClass !== "MODEL_WITH_OIC_RUNTIME" || (isReportParent ? !validReport : !validManifest)) throw new ConflictException("CANDIDATE_PARENT_INVALID");
    const definitionDigest = sha256({ type: "SYSTEM_INSTRUCTION", instruction: instruction.trim() });
    const targetFingerprint = sha256({ parentTargetFingerprint, changeDigest: definitionDigest });
    try {
      return await this.db.$transaction(async (tx) => {
        const parentRef = isReportParent ? parentReportId : parentManifestId;
        if (typeof parentRef !== "string") throw new ConflictException("CANDIDATE_PARENT_INVALID");
        const candidate = await tx.oicEvaluationCandidate.create({ data: { applicationId: appId!, tenantId, candidateKey, parentIds: [parentRef], changeDigest: definitionDigest, targetClass: parentTargetClass, targetFingerprint } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: appId!, tenantId, action: "evaluation.candidate.created", targetType: "evaluation-candidate", targetId: candidate.id, metadata: { candidateKey, ...(isReportParent ? { parentReportId: parentRef } : { parentManifestId: parentRef }), changeDigest: definitionDigest, changeSet: { type: "SYSTEM_INSTRUCTION", instruction: instruction.trim() }, targetFingerprint } } });
        return { id: candidate.id, candidateKey, ...(isReportParent ? { parentReportId: parentRef } : { parentManifestId: parentRef }), changeDigest: definitionDigest, targetFingerprint, status: candidate.status };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException("CANDIDATE_REVISION_EXISTS");
      throw error;
    }
  }

  async listCandidates(actor: AuthenticatedPrincipal) {
    const rows = await this.db.oicEvaluationCandidate.findMany({ where: this.requireScope(actor), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, candidateKey: true, parentIds: true, changeDigest: true, targetClass: true, targetFingerprint: true, status: true, createdAt: true } });
    return rows.map((row) => ({ ...row, changeDigestPresent: digestPattern.test(row.changeDigest), targetFingerprintPresent: digestPattern.test(row.targetFingerprint) }));
  }

  async projectDna(actor: AuthenticatedPrincipal, reportId: string) {
    assertManage(actor);
    const report = await this.db.oicEvaluationReport.findFirst({ where: { id: reportId, run: this.requireScope(actor) }, include: { run: { include: { manifest: { select: { id: true, releaseId: true, canonicalDigest: true, payload: true } } } } } });
    if (!report) throw new NotFoundException();
    const traitKeys = ["reasoning", "retrieval", "evidence", "memory", "verification", "tools", "search", "repair", "reliability", "efficiency", "latency", "cost", "stability"];
    const contextKey = `release:${report.run.manifest.releaseId}:report:${report.id}`;
    if (report.regradePassId) return this.projectRegradeDnaEvidence(actor, report, contextKey);
    const protocol = object(report.run.manifest.payload);
    const cohort = object(protocol.cohort);
    if (typeof cohort.cohortKey === "string") {
      const executions = await this.db.oicEvaluationCaseExecution.findMany({ where: { runId: report.runId }, orderBy: [{ caseRevisionId: "asc" }, { repetitionOrdinal: "asc" }], select: { id: true, caseRevisionId: true, repetitionOrdinal: true, measurements: { select: { id: true, metricKey: true, metricRevision: true, valueType: true, value: true, availability: true, evidenceDigest: true } } } });
      const measurements = executions.flatMap((execution) => execution.measurements.map((measurement) => ({
        ...measurement, caseExecutionId: execution.id, caseRevisionId: execution.caseRevisionId, repetitionOrdinal: execution.repetitionOrdinal
      })));
      const projection = derivePacket76DnaEvidence({ reportId: report.id, reportDigest: report.resultDigest, reportStatus: report.status, reportDecisionEligible: report.decisionEligible, cohortKey: cohort.cohortKey, plannedRepetitions: object(protocol.repetitionPolicy).plannedRepetitions, measurements });
      const cohortKey = cohort.cohortKey;
      const scopedContextKey = `release:${report.run.manifest.releaseId}:cohort:${cohortKey}:report:${report.id}`;
      const row = await this.db.$transaction(async (tx) => {
        const existing = await tx.oicEvaluationDnaMeasurement.findFirst({ where: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey: scopedContextKey, traitKey: projection.traitKey, sourceDigest: projection.sourceDigest } });
        const saved = existing ?? await tx.oicEvaluationDnaMeasurement.create({ data: {
          reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey: scopedContextKey,
          traitKey: projection.traitKey, value: projection.value === null ? Prisma.JsonNull : projection.value as Prisma.InputJsonValue, uncertainty: projection.uncertainty === null ? Prisma.JsonNull : projection.uncertainty as Prisma.InputJsonValue,
          availability: projection.availability, evidenceStrength: projection.evidenceStrength, sourceDigest: projection.sourceDigest,
          provenance: projection.provenance as Prisma.InputJsonValue
        } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: report.run.applicationId, tenantId: report.run.tenantId, action: "evaluation.dna.projected", targetType: "evaluation-report", targetId: report.id, metadata: { reportDigest: report.resultDigest, traitKey: projection.traitKey, cohortKey, sourceDigest: projection.sourceDigest, availability: projection.availability, measurementCount: measurements.length } } });
        return saved;
      });
      return { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey: scopedContextKey, measuredCount: row.availability === "MEASURED" ? 1 : 0, insufficientCount: row.availability === "INSUFFICIENT" ? 1 : 0, sourceMeasurementCount: measurements.length, provenance: "PACKET76_COHORT_METRIC", availability: row.availability };
    }
    const projections = await this.db.$transaction(async (tx) => {
      const result = [];
      for (const traitKey of traitKeys) {
        const sourceDigest = sha256({ reportId: report.id, reportDigest: report.resultDigest, traitKey, method: "oic-dna-evidence-projection-v1", availability: "INSUFFICIENT" });
        const existing = await tx.oicEvaluationDnaMeasurement.findFirst({ where: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey, traitKey, sourceDigest } });
        const row = existing ?? await tx.oicEvaluationDnaMeasurement.create({ data: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey, traitKey, availability: "INSUFFICIENT", evidenceStrength: "WEAK", sourceDigest } });
        result.push(row);
      }
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: report.run.applicationId, tenantId: report.run.tenantId, action: "evaluation.dna.projected", targetType: "evaluation-report", targetId: report.id, metadata: { reportDigest: report.resultDigest, traitCount: traitKeys.length, measuredCount: 0, availability: "INSUFFICIENT" } } });
      return result;
    });
    return { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey, measuredCount: projections.filter((item) => item.availability === "MEASURED").length, insufficientCount: projections.filter((item) => item.availability === "INSUFFICIENT").length };
  }

  private async projectRegradeDnaEvidence(actor: AuthenticatedPrincipal, report: { id: string; runId: string; resultDigest: string; status: string; decisionEligible: boolean; sourceReportId: string | null; regradePassId: string | null; run: { applicationId: string; tenantId: string | null; targetClass: string; targetFingerprint: string; plannedDenominator: number; manifest: { id: string; releaseId: string } } }, contextKey: string) {
    const pass = report.regradePassId ? await this.db.oicEvaluationRegradePass.findFirst({ where: { id: report.regradePassId, applicationId: report.run.applicationId, tenantId: report.run.tenantId }, include: { sources: { include: { measurements: { select: { id: true, caseExecutionId: true, metricKey: true, metricRevision: true, judgeType: true, availability: true, evidenceDigest: true, provenance: true } } } }, bridgeRevision: { select: { id: true, status: true, revokedAt: true, bridgeType: true } } } }) : null;
    if (!pass || pass.status !== "COMPLETE" || pass.sourceRunId !== report.runId || !pass.bridgeRevision || pass.bridgeRevision.status !== "PUBLISHED" || pass.bridgeRevision.revokedAt) throw new ConflictException("REGRADE_DNA_SOURCE_INVALID");
    const gradingManifest = await this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: pass.gradingManifestId, applicationId: report.run.applicationId, tenantId: report.run.tenantId, releaseId: report.run.manifest.releaseId }, select: { payload: true } });
    if (!gradingManifest) throw new ConflictException("REGRADE_DNA_BASIS_UNAVAILABLE");
    if (pass.bridgeRevision.bridgeType === "OPERATIONAL_BUDGET_REBASELINE") {
      const protocol = object(gradingManifest.payload);
      const cohort = object(protocol.cohort);
      const executions = await this.db.oicEvaluationCaseExecution.findMany({ where: { runId: report.runId }, orderBy: [{ caseRevisionId: "asc" }, { repetitionOrdinal: "asc" }], select: { id: true, caseRevisionId: true, repetitionOrdinal: true, measurements: { select: { id: true, metricKey: true, metricRevision: true, valueType: true, value: true, availability: true, evidenceDigest: true } } } });
      const measurements = executions.flatMap((execution) => execution.measurements.map((measurement) => ({ ...measurement, caseExecutionId: execution.id, caseRevisionId: execution.caseRevisionId, repetitionOrdinal: execution.repetitionOrdinal })));
      const projection = derivePacket76DnaEvidence({ reportId: report.id, reportDigest: report.resultDigest, reportStatus: report.status, reportDecisionEligible: report.decisionEligible, cohortKey: cohort.cohortKey, plannedRepetitions: object(protocol.repetitionPolicy).plannedRepetitions, measurements });
      const scopedContextKey = `release:${report.run.manifest.releaseId}:cohort:${String(cohort.cohortKey)}:report:${report.id}`;
      const provenance = { ...projection.provenance, provenance: "OPERATIONAL_BUDGET_REBASELINE", sourceReportId: report.sourceReportId, regradePassId: pass.id, bridgeRevisionId: pass.bridgeRevisionId };
      const sourceDigest = sha256({ originalSourceDigest: projection.sourceDigest, provenance });
      const row = await this.db.$transaction(async (tx) => {
        const existing = await tx.oicEvaluationDnaMeasurement.findFirst({ where: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey: scopedContextKey, traitKey: projection.traitKey, sourceDigest } });
        const saved = existing ?? await tx.oicEvaluationDnaMeasurement.create({ data: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey: scopedContextKey, traitKey: projection.traitKey, value: projection.value === null ? Prisma.JsonNull : asInputJson(projection.value), uncertainty: projection.uncertainty === null ? Prisma.JsonNull : asInputJson(projection.uncertainty), availability: projection.availability, evidenceStrength: projection.evidenceStrength, sourceDigest, provenance } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: report.run.applicationId, tenantId: report.run.tenantId, action: "evaluation.dna.projected", targetType: "evaluation-report", targetId: report.id, metadata: { reportDigest: report.resultDigest, sourceReportId: report.sourceReportId, bridgeRevisionId: pass.bridgeRevisionId, traitKey: projection.traitKey, cohortKey: typeof cohort.cohortKey === "string" ? cohort.cohortKey : null, sourceDigest, availability: projection.availability, measurementCount: measurements.length, scoringReplayed: false } } });
        return saved;
      });
      return { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey: scopedContextKey, measuredCount: row.availability === "MEASURED" ? 1 : 0, insufficientCount: row.availability === "INSUFFICIENT" ? 1 : 0, sourceMeasurementCount: measurements.length, provenance: "OPERATIONAL_BUDGET_REBASELINE" };
    }
    const measurements = pass.sources.flatMap((source) => source.measurements);
    const protocol = object(gradingManifest.payload);
    const metricIds = (Array.isArray(protocol.metricRevisions) ? protocol.metricRevisions : []).map((item) => typeof item === "string" ? item : object(item).id).filter((item): item is string => typeof item === "string");
    const metrics = await this.db.oicEvaluationMetricRevision.findMany({ where: { id: { in: metricIds }, applicationId: report.run.applicationId, tenantId: report.run.tenantId }, select: { definition: true } });
    const methodRevision = metrics.map((metric) => object(metric.definition).methodRevision).find((item): item is string => typeof item === "string") ?? "UNSUPPORTED";
    const projection = deriveRegradeDnaEvidence({
      reportId: report.id, reportDigest: report.resultDigest, reportStatus: report.status, decisionEligible: report.decisionEligible,
      sourceReportId: report.sourceReportId ?? "", sourceRunId: report.runId, sourceManifestId: pass.sourceManifestId,
      gradingManifestId: pass.gradingManifestId, bridgeRevisionId: pass.bridgeRevisionId, regradePassId: pass.id,
      plannedCases: report.run.plannedDenominator,
      measurements: measurements.map((item) => ({ id: item.id, caseExecutionId: item.caseExecutionId, metricKey: item.metricKey, metricRevision: item.metricRevision, judgeType: item.judgeType, availability: item.availability, evidenceDigest: item.evidenceDigest, provenance: item.provenance })),
      methodRevision
    });
    const provenance = { ...projection.provenance, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey };
    const sourceDigest = sha256({ reportId: report.id, reportDigest: report.resultDigest, provenance });
    const reasonCodes = Array.isArray(projection.provenance.reasonCodes) ? projection.provenance.reasonCodes.filter((item): item is string => typeof item === "string") : [];
    const row = await this.db.$transaction(async (tx) => {
      const existing = await tx.oicEvaluationDnaMeasurement.findFirst({ where: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey, traitKey: projection.traitKey, sourceDigest } });
      const measurement = existing ?? await tx.oicEvaluationDnaMeasurement.create({ data: { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey, traitKey: projection.traitKey, value: Prisma.JsonNull, uncertainty: Prisma.JsonNull, availability: projection.availability, evidenceStrength: projection.evidenceStrength, sourceDigest, provenance } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: report.run.applicationId, tenantId: report.run.tenantId, action: "evaluation.dna.projected", targetType: "evaluation-report", targetId: report.id, metadata: { reportDigest: report.resultDigest, traitCount: 1, measuredCount: 0, sourceMeasurementCount: measurements.length, sourceDigest, provenance: "REGRADE", availability: projection.availability, reasonCodes } } });
      return measurement;
    });
    return { reportId: report.id, targetClass: report.run.targetClass, targetFingerprint: report.run.targetFingerprint, contextKey, measuredCount: row.availability === "MEASURED" ? 1 : 0, insufficientCount: row.availability === "INSUFFICIENT" ? 1 : 0, sourceMeasurementCount: measurements.length, provenance: "REGRADE", availability: row.availability };
  }

  async recordComparisonVerdict(actor: AuthenticatedPrincipal, comparisonId: string) {
    assertManage(actor);
    const comparison = await this.db.oicEvaluationComparison.findFirst({ where: { id: comparisonId, baselineReport: { run: this.requireScope(actor) }, candidateReport: { run: this.requireScope(actor) } }, include: { baselineReport: { select: { id: true, status: true, decisionEligible: true } }, candidateReport: { select: { id: true, status: true, decisionEligible: true, run: { select: { manifest: { select: { payload: true } } } } } } } });
    if (!comparison) throw new NotFoundException();
    const firstEstimate = Array.isArray(comparison.estimates) ? object(comparison.estimates[0]) : {};
    const interval = object(firstEstimate.interval);
    const verdict = comparison.decisionEligible && firstEstimate.availability === "MEASURED"
      && typeof interval.lower === "number" && interval.lower > 0 ? "PROMOTE"
      : comparison.decisionEligible && firstEstimate.availability === "MEASURED"
        && typeof interval.upper === "number" && interval.upper < 0 ? "REJECT" : "INCONCLUSIVE";
    const candidateRevision = object(object(comparison.candidateReport.run.manifest.payload).candidateRevision);
    const candidateId = typeof candidateRevision.id === "string" && uuidPattern.test(candidateRevision.id) ? candidateRevision.id : null;
    const verdictDigest = sha256({ comparisonId: comparison.id, outcome: comparison.outcome, reasonCodes: comparison.reasonCodes, estimates: comparison.estimates, decisionEligible: comparison.decisionEligible, baselineReportId: comparison.baselineReport.id, candidateReportId: comparison.candidateReport.id, verdict });
    const existing = await this.db.oicAuditEvent.findFirst({ where: { applicationId: actor.applicationId, action: "evaluation.candidate.verdict.recorded", targetType: "evaluation-comparison", targetId: comparison.id }, select: { id: true, metadata: true } });
    if (existing) {
      const metadata = object(existing.metadata);
      if (metadata.verdictDigest !== verdictDigest) throw new ConflictException("CANDIDATE_VERDICT_IMMUTABILITY_CONFLICT");
      return { comparisonId, verdict, verdictDigest, replayed: true, promotionEligible: comparison.decisionEligible };
    }
    await this.db.$transaction(async (tx) => {
      if (candidateId) await tx.oicEvaluationCandidate.updateMany({ where: { id: candidateId, applicationId: actor.applicationId }, data: { status: verdict === "PROMOTE" ? "PROMOTION_ELIGIBLE" : "UNVERIFIED" } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: actor.applicationId, action: "evaluation.candidate.verdict.recorded", targetType: "evaluation-comparison", targetId: comparison.id, metadata: { verdict, verdictDigest, reason: comparison.decisionEligible ? "LOCKED_PAIRED_INTERVAL_GATE" : "COMPARISON_NOT_DECISION_ELIGIBLE", baselineReportId: comparison.baselineReport.id, candidateReportId: comparison.candidateReport.id, baselineStatus: comparison.baselineReport.status, candidateStatus: comparison.candidateReport.status, candidateId, decisionEligible: comparison.decisionEligible } } });
    });
    return { comparisonId, verdict, verdictDigest, replayed: false, promotionEligible: comparison.decisionEligible };
  }

  /** One-time, owner-approved Packet 7.6 supplement; all scope and limits are fixed in code. */
  async provisionPacket76CapacityExtension(actor: AuthenticatedPrincipal, runId: string) {
    if (!canProvisionPacket76CapacityExtension(actor.scopes)) throw new ForbiddenException();
    if (runId !== PACKET76_APPROVED_SCOPE.runId) throw new NotFoundException();
    const run = await this.db.oicEvaluationRun.findFirst({
      where: { id: runId, ...this.requireScope(actor) },
      select: {
        id: true, applicationId: true, tenantId: true, campaignId: true, manifestId: true,
        manifest: { select: { payload: true, canonicalDigest: true, release: { select: { status: true, compromisedAt: true, caseManifest: true } } } }
      }
    });
    if (!run || run.campaignId !== PACKET76_APPROVED_SCOPE.campaignId || run.applicationId !== PACKET76_APPROVED_SCOPE.applicationId) throw new ConflictException("PACKET76_CAPACITY_EXTENSION_SCOPE_INVALID");
    // Nullable tenant IDs do not join reliably through the composite Prisma relation.
    // Resolve application-scoped campaigns by the explicit run/application/tenant tuple.
    const campaign = await this.db.oicEvaluationCampaign.findFirst({
      where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId },
      select: { id: true, budgetRevisionId: true, budgetRevision: { select: { id: true, applicationId: true, tenantId: true, planRevisionId: true, unit: true, enforcement: true, unknownLiabilityRule: true } } }
    });
    if (!campaign?.budgetRevision || campaign.budgetRevisionId !== PACKET76_APPROVED_SCOPE.baseBudgetRevisionId || campaign.budgetRevision.id !== PACKET76_APPROVED_SCOPE.baseBudgetRevisionId) throw new ConflictException("PACKET76_CAPACITY_EXTENSION_SCOPE_INVALID");
    const protocol = object(run.manifest.payload);
    const cohort = object(protocol.cohort);
    const caseIds = Array.isArray(run.manifest.release.caseManifest) ? run.manifest.release.caseManifest.map((item) => String(object(item).caseRevisionId)) : [];
    if (run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt || run.manifest.canonicalDigest !== sha256(protocol)
      || cohort.cohortKey !== PACKET76_APPROVED_SCOPE.cohortKey
      || !validatePacket76Cohort(cohort, caseIds, Number(object(protocol.repetitionPolicy).plannedRepetitions)).valid
      || object(protocol.budgetPolicy).budgetRevisionId !== PACKET76_APPROVED_SCOPE.baseBudgetRevisionId
      || campaign.budgetRevision.applicationId !== run.applicationId || campaign.budgetRevision.tenantId !== run.tenantId
      || campaign.budgetRevision.unit !== "OIU" || campaign.budgetRevision.enforcement !== "HARD" || campaign.budgetRevision.unknownLiabilityRule !== "DENY") throw new ConflictException("PACKET76_CAPACITY_EXTENSION_BASIS_INVALID");

    const existing = await this.db.oicEvaluationCapacityExtension.findFirst({ where: { applicationId: run.applicationId, campaignId: run.campaignId, runId, cohortKey: PACKET76_APPROVED_SCOPE.cohortKey, authorizationId: PACKET76_APPROVED_SCOPE.authorizationId }, select: { id: true, budgetRevisionId: true, authorizedOiu: true, perAdmissionLimitOiu: true, status: true, expiresAt: true } });
    if (existing) return { ...existing, authorizedOiu: existing.authorizedOiu.toString(), perAdmissionLimitOiu: existing.perAdmissionLimitOiu.toString(), replayed: true };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const amount = new Prisma.Decimal("1536");
    const perAdmission = new Prisma.Decimal("256");
    const budgetInput = {
      applicationId: run.applicationId, tenantId: run.tenantId, planRevisionId: campaign.budgetRevision.planRevisionId,
      budgetKey: "oic7-packet76-supplemental-20261016", revision: 0,
      status: "DRAFT" as const, unit: "OIU" as const, currency: null, enforcement: "HARD" as const,
      amount, reservationUpperBound: perAdmission, safetyMargin: new Prisma.Decimal(0),
      purpose: "Owner-approved Packet 7.6 supplemental hard OIC-6 OIU capacity; Packet 7.6 only",
      deadline: expiresAt, unknownLiabilityRule: "DENY" as const,
      effectiveFrom: now, effectiveTo: expiresAt
    };
    const sourceDigest = createHash("sha256").update(JSON.stringify({
      applicationId: run.applicationId, tenantId: run.tenantId, planRevisionId: budgetInput.planRevisionId,
      budgetKey: budgetInput.budgetKey, unit: budgetInput.unit, enforcement: budgetInput.enforcement,
      amount: "1536", reservationUpperBound: "256", safetyMargin: "0", purpose: budgetInput.purpose,
      deadline: expiresAt.toISOString(), unknownLiabilityRule: budgetInput.unknownLiabilityRule,
      effectiveFrom: now.toISOString(), effectiveTo: expiresAt.toISOString()
    })).digest("hex");
    const result = await this.db.$transaction(async (tx) => {
      const prior = await tx.oicBudgetRevision.aggregate({ where: { scopeKey: `${run.applicationId}:${run.tenantId ?? "application"}`, budgetKey: budgetInput.budgetKey }, _max: { revision: true } });
      const budget = await tx.oicBudgetRevision.create({ data: {
        ...budgetInput, scopeKey: `${run.applicationId}:${run.tenantId ?? "application"}`,
        revision: (prior._max.revision ?? 0) + 1, sourceDigest
      } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "admission.budget.drafted", targetType: "budget-policy", targetId: budget.id, metadata: { revision: budget.revision, sourceDigest, authorizationId: PACKET76_APPROVED_SCOPE.authorizationId } } });
      const published = await tx.oicBudgetRevision.update({ where: { id: budget.id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: now } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "admission.budget.published", targetType: "budget-policy", targetId: budget.id, metadata: { revision: published.revision, sourceDigest, authorizationId: PACKET76_APPROVED_SCOPE.authorizationId } } });
      const extensionId = randomUUID();
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.packet76.capacity_extension.authorized", targetType: "evaluation-capacity-extension", targetId: extensionId, metadata: { authorizationId: PACKET76_APPROVED_SCOPE.authorizationId, runId, campaignId: run.campaignId, cohortKey: PACKET76_APPROVED_SCOPE.cohortKey, baseBudgetRevisionId: PACKET76_APPROVED_SCOPE.baseBudgetRevisionId, budgetRevisionId: budget.id, authorizedOiu: "1536", perAdmissionLimitOiu: "256", reason: "Owner-approved narrow Packet 7.6 supplemental OIC-6 capacity extension", expiresAt: expiresAt.toISOString() } } });
      return tx.oicEvaluationCapacityExtension.create({ data: {
        id: extensionId, applicationId: run.applicationId, tenantId: run.tenantId, campaignId: run.campaignId!, runId,
        baseBudgetRevisionId: PACKET76_APPROVED_SCOPE.baseBudgetRevisionId, budgetRevisionId: budget.id,
        cohortKey: PACKET76_APPROVED_SCOPE.cohortKey, authorizedOiu: amount, perAdmissionLimitOiu: perAdmission,
        status: "ACTIVE", authorizationId: PACKET76_APPROVED_SCOPE.authorizationId,
        reason: "Owner-approved narrow Packet 7.6 supplemental OIC-6 capacity extension", createdBy: actor.id, expiresAt
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ...result, authorizedOiu: result.authorizedOiu.toString(), perAdmissionLimitOiu: result.perAdmissionLimitOiu.toString(), replayed: false };
  }

  async createCampaign(actor: AuthenticatedPrincipal, input: Record<string, unknown>) {
    assertManage(actor);
    const { releaseId, campaignKey, idempotencyKey, budgetRevisionId } = input;
    if (typeof releaseId !== "string" || typeof campaignKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(campaignKey) || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey) || typeof budgetRevisionId !== "string" || !uuidPattern.test(budgetRevisionId) || Object.keys(input).some((key) => !["releaseId", "campaignKey", "idempotencyKey", "budgetRevisionId", "budgetLimitOiu"].includes(key))) throw new BadRequestException("Invalid campaign identity or budget policy");
    const limit = positiveOiu(input.budgetLimitOiu);
    const release = await this.db.oicEvaluationRelease.findFirst({ where: { id: releaseId, ...this.requireScope(actor) } });
    if (!release || release.status !== "PUBLISHED") throw new ConflictException("RELEASE_INVALID");
    const now = new Date();
    const budgetPolicy = await this.db.oicBudgetRevision.findFirst({ where: {
      id: budgetRevisionId, applicationId: release.applicationId, tenantId: release.tenantId,
      status: "PUBLISHED", unit: "OIU", enforcement: "HARD", effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
    }, select: { id: true, amount: true, reservationUpperBound: true, sourceDigest: true } });
    if (!budgetPolicy?.reservationUpperBound || !budgetPolicy.reservationUpperBound.gt(0) || limit.gt(budgetPolicy.amount) || limit.lt(budgetPolicy.reservationUpperBound)) throw new ConflictException("CAMPAIGN_HARD_BUDGET_UNAVAILABLE");
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.oicEvaluationCampaign.create({ data: { applicationId: release.applicationId, tenantId: release.tenantId, releaseId: release.id, campaignKey, createdBy: actor.id, idempotencyKey, status: "ACTIVE", budgetRevisionId: budgetPolicy.id, budgetLimitOiu: limit, reservationPerAttemptOiu: budgetPolicy.reservationUpperBound!, budgetPolicyDigest: budgetPolicy.sourceDigest } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: release.applicationId, tenantId: release.tenantId, action: "evaluation.campaign.created", targetType: "evaluation-campaign", targetId: row.id, requestId: idempotencyKey, metadata: { releaseId: release.id, budgetRevisionId: budgetPolicy.id, budgetLimitOiu: limit.toString(), reservationPerAttemptOiu: budgetPolicy.reservationUpperBound!.toString() } } });
        return { id: row.id, campaignKey: row.campaignKey, releaseId: row.releaseId, status: row.status, budgetRevisionId: budgetPolicy.id, budgetLimitOiu: limit.toString(), reservedOiu: row.reservedOiu.toString() };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const previous = await this.db.oicEvaluationCampaign.findFirst({ where: { applicationId: release.applicationId, tenantId: release.tenantId, idempotencyKey } });
        if (previous && previous.releaseId === release.id && previous.campaignKey === campaignKey && previous.budgetRevisionId === budgetPolicy.id && previous.budgetLimitOiu?.equals(limit)) return { id: previous.id, campaignKey: previous.campaignKey, releaseId: previous.releaseId, status: previous.status, budgetRevisionId: previous.budgetRevisionId, budgetLimitOiu: previous.budgetLimitOiu.toString(), reservedOiu: previous.reservedOiu.toString() };
        throw new ConflictException("IDEMPOTENCY_CONFLICT");
      }
      throw error;
    }
  }

  async run(actor: AuthenticatedPrincipal, id: string) {
    const row = await this.db.oicEvaluationRun.findFirst({ where: { id, ...this.requireScope(actor) }, include: { manifest: { select: { id: true, targetClass: true, canonicalDigest: true, protocolVersion: true } }, cases: { orderBy: [{ caseRevisionId: "asc" }, { repetitionOrdinal: "asc" }], take: 256, select: { id: true, caseRevisionId: true, repetitionOrdinal: true, status: true, unusedReservationReleasedOiu: true, completedAt: true, attempts: { orderBy: { attemptOrdinal: "asc" }, take: 32, select: { id: true, attemptOrdinal: true, status: true, admissionId: true, failureClass: true, verificationTier: true, evidenceDigest: true, startedAt: true, completedAt: true } }, _count: { select: { attempts: true, measurements: true } } } }, reports: { orderBy: { analysisRevision: "desc" }, take: 32, select: { id: true, analysisRevision: true, status: true, resultDigest: true, verificationTier: true, decisionEligible: true, createdAt: true } } } });
    if (!row) throw new NotFoundException();
    const physicalAttempts = row.cases.flatMap((execution) => execution.attempts);
    const admissionIds = [...new Set(physicalAttempts.map((attempt) => attempt.admissionId).filter((value): value is string => !!value))];
    const [admissions, providerAttempts] = await Promise.all([
      admissionIds.length ? this.db.oicAdmission.findMany({ where: { id: { in: admissionIds }, applicationId: row.applicationId, tenantId: row.tenantId }, select: { id: true, status: true, legs: { select: { amount: true, state: true, bucket: { select: { unit: true } } } }, postings: { select: { kind: true, amount: true, bucket: { select: { unit: true } } } } } }) : Promise.resolve([]),
      admissionIds.length ? this.db.oicProviderAttempt.findMany({ where: { admissionId: { in: admissionIds }, applicationId: row.applicationId, tenantId: row.tenantId }, select: { id: true, admissionId: true, status: true, usageStatus: true, providerKey: true, upstreamModelId: true, bindingId: true, connectionId: true, binding: { select: { status: true, environment: true } }, connection: { select: { displayName: true, providerDefinition: { select: { key: true, displayName: true } } } }, startedAt: true, completedAt: true, usageEvents: { select: { id: true, normalizedDimensions: true, costAssessments: { select: { kind: true, status: true, nativeAmount: true, currency: true, evidenceClass: true } }, oiuAssessments: { select: { kind: true, status: true, oiu: true } } } } } }) : Promise.resolve([])
    ]);
    const providerByAdmission = new Map<string, typeof providerAttempts>();
    for (const attempt of providerAttempts) if (attempt.admissionId) providerByAdmission.set(attempt.admissionId, [...(providerByAdmission.get(attempt.admissionId) ?? []), attempt]);
    const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
    const executionByAttempt = new Map<string, typeof row.cases[number]>();
    for (const execution of row.cases) for (const attempt of execution.attempts) executionByAttempt.set(attempt.id, execution);
    const accounting = physicalAttempts.map((attempt) => {
      const providers = attempt.admissionId ? providerByAdmission.get(attempt.admissionId) ?? [] : [];
      const admission = attempt.admissionId ? admissionById.get(attempt.admissionId) : undefined;
      const execution = executionByAttempt.get(attempt.id);
      return {
        caseExecutionId: execution?.id ?? null,
        repetition: execution?.repetitionOrdinal ?? null,
        attemptId: attempt.id,
        attemptStatus: attempt.status,
        admission: admission ? {
          id: admission.id, status: admission.status,
          reserved: admission.legs.map((leg) => ({ amount: leg.amount.toString(), unit: leg.bucket.unit, state: leg.state })),
          postings: admission.postings.map((posting) => ({ kind: posting.kind, amount: posting.amount.toString() }))
        } : null,
        providerAttempts: providers.map((provider) => ({
          id: provider.id, provider: provider.connection.providerDefinition.displayName, providerKey: provider.providerKey, model: provider.upstreamModelId,
          bindingId: provider.bindingId, bindingStatus: provider.binding.status, bindingEnvironment: provider.binding.environment,
          connectionId: provider.connectionId, connectionName: provider.connection.displayName,
          status: provider.status, usageStatus: provider.usageStatus, startedAt: provider.startedAt, completedAt: provider.completedAt,
          usage: provider.usageEvents.map((event) => ({ id: event.id, dimensions: event.normalizedDimensions,
            costs: event.costAssessments.map((cost) => ({ kind: cost.kind, status: cost.status, amount: cost.nativeAmount?.toString() ?? null, currency: cost.currency, evidenceClass: cost.evidenceClass })),
            oiu: event.oiuAssessments.map((assessment) => ({ kind: assessment.kind, status: assessment.status, amount: assessment.oiu?.toString() ?? null }))
          }))
        }))
      };
    });
    const sumDecimal = (values: string[]) => values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)).toString();
    const dispatches = accounting.flatMap((item) => item.providerAttempts);
    const dimensions = dispatches.flatMap((attempt) => attempt.usage.map((usage) => object(usage.dimensions)));
    const isTokenCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    const tokenTotal = (key: string) => {
      const values = dimensions.map((usage) => usage[key]);
      return dimensions.length === dispatches.length && dispatches.length > 0 && dispatches.every((attempt) => attempt.usage.length === 1) && values.every(isTokenCount)
        ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const costs = dispatches.flatMap((attempt) => attempt.usage.flatMap((usage) => usage.costs.filter((cost) => cost.kind === "ORIGINAL")));
    const currencyTotals = Object.fromEntries([...new Set(costs.map((cost) => cost.currency).filter((currency): currency is string => typeof currency === "string"))].map((currency) => {
      const currencyCosts = costs.filter((cost) => cost.currency === currency);
      const assessed = currencyCosts.every((cost) => cost.status === "ASSESSED" && cost.amount !== null);
      const amounts = currencyCosts.map((cost) => cost.amount).filter((amount): amount is string => amount !== null);
      return [currency, {
        amount: assessed ? sumDecimal(amounts) : null,
        state: assessed ? "ASSESSED" : "PARTIAL"
      }];
    }));
    const oiuAmounts = dispatches.flatMap((attempt) => attempt.usage.flatMap((usage) => usage.oiu.filter((item) => item.kind === "ORIGINAL")));
    const legs = admissions.flatMap((admission) => admission.legs.filter((leg) => leg.bucket.unit === "OIU"));
    const postings = admissions.flatMap((admission) => admission.postings.filter((posting) => posting.bucket.unit === "OIU"));
    const settledOiu = oiuAmounts.length === dispatches.length && dispatches.length > 0 && oiuAmounts.every((item) => item.status === "ASSESSED" && item.amount !== null);
    const admissionSettlementKnown = admissionIds.length === admissions.length && admissions.every((admission) => ["SETTLED", "RELEASED", "DENIED"].includes(admission.status)
      && admission.legs.every((leg) => ["SETTLED", "RELEASED"].includes(leg.state)));
    const consumedOiu = settledOiu ? sumDecimal(oiuAmounts.map((item) => item.amount!)) : null;
    const legReservationOiu = sumDecimal(legs.map((leg) => leg.amount.toString()));
    const postedReservationOiu = sumDecimal(postings.filter((posting) => posting.kind === "RESERVE").map((posting) => posting.amount.toString()));
    const postedConsumedOiu = sumDecimal(postings.filter((posting) => posting.kind === "CONSUME").map((posting) => posting.amount.toString()));
    const postedReleasedOiu = sumDecimal(postings.filter((posting) => posting.kind === "RELEASE").map((posting) => posting.amount.toString()));
    const reservationReconciled = admissionIds.length > 0 && admissionIds.length === admissions.length && new Prisma.Decimal(legReservationOiu).eq(postedReservationOiu);
    const consumptionReconciled = consumedOiu !== null && new Prisma.Decimal(consumedOiu).eq(postedConsumedOiu);
    const ledgerBalanced = consumedOiu !== null && reservationReconciled
      && new Prisma.Decimal(legReservationOiu).eq(new Prisma.Decimal(postedConsumedOiu).plus(postedReleasedOiu));
    // SETTLED legs can contain both consumed and released postings. The ledger
    // postings, rather than the terminal leg label, are the canonical release
    // amount. Keep that amount visible when the terminal reservation ledger
    // reconciles, even if provider usage is still unknown.
    const releaseReconciled = admissionSettlementKnown && reservationReconciled;
    return {
      id: row.id,
      campaignId: row.campaignId,
      manifest: row.manifest,
      targetClass: row.targetClass,
      targetFingerprint: row.targetFingerprint,
      status: row.status,
      verificationTier: row.verificationTier,
      diagnosticOnly: row.diagnosticOnly,
      plannedTrials: row.plannedTrials,
      plannedDenominator: row.plannedDenominator,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      cases: row.cases,
      reports: row.reports,
      accounting: {
        state: admissionIds.length === 0 ? "NO_DATA_YET" : dispatches.length === physicalAttempts.length && settledOiu && admissionSettlementKnown && consumptionReconciled && releaseReconciled && ledgerBalanced ? "LIVE" : "PARTIAL",
        dispatchCount: dispatches.length,
        inputTokens: tokenTotal("inputTokens"), outputTokens: tokenTotal("outputTokens"),
        providerCosts: currencyTotals,
        oiu: {
          reserved: reservationReconciled ? legReservationOiu : null,
          consumed: consumptionReconciled ? postedConsumedOiu : null,
          released: releaseReconciled ? postedReleasedOiu : null,
          state: settledOiu && admissionSettlementKnown && consumptionReconciled && releaseReconciled && ledgerBalanced ? "SETTLED" : oiuAmounts.length ? "PARTIAL" : "UNKNOWN"
        },
        attempts: accounting
      }
    };
  }
}
