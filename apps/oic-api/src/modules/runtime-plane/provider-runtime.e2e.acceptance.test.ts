import "reflect-metadata";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { RuntimeContextResolver } from "./runtime-context";
import { DatabaseOicModelResolver } from "./model-resolver";
import { BoundedRuntimePolicy } from "./runtime-policy";
import { OicRuntimeService } from "./runtime.service";
import { OpenAICompatibilityController } from "./openai-compatibility.controller";
import { encryptProviderCredential } from "../control-plane/provider-credential.crypto";
import { ProviderRuntimeExecutor } from "./provider-runtime-executor";
import { LocalProviderHttpFixture } from "./provider-http.fixture";
import { IntelligenceRuntimeExecutor } from "../intelligence/intelligence-runtime-executor";
import { OicMemoryRepository } from "../intelligence/memory.repository";
import { IntelligenceWorkbenchService } from "./intelligence-workbench.service";
import { IntelligenceDataService } from "../intelligence/intelligence-data.service";
import { IntelligenceProfileService } from "../intelligence/intelligence-profile.service";
import { Oic5AcceptanceLedger } from "./oic5-acceptance-ledger";

function useDedicatedDatabase(): boolean {
  const file = resolve(__dirname, "../../../../../.env.oic.local");
  try {
    const values = new Map<string, string>();
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([^#=]+)=(.*)$/.exec(line);
      if (match) values.set(match[1]!, match[2]!.trim().replace(/^['"]|['"]$/g, ""));
    }
    const url = process.env.OIC_TEST_DATABASE_URL ?? values.get("OIC_MIGRATION_DATABASE_URL");
    if (!url) return false;
    const parsed = new URL(url);
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(decodeURIComponent(parsed.pathname.slice(1)))) throw new Error("Provider runtime E2E requires the local OIC migration-test database");
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function requestObject() {
  const request = new EventEmitter() as EventEmitter & { headers: Record<string, string>; requestId: string };
  request.headers = {};
  request.requestId = randomUUID();
  return request;
}
function responseObject() {
  const response = new EventEmitter() as EventEmitter & { chunks: string[]; headers: Map<string, string>; statusCode: number; writableEnded: boolean; headersSent: boolean; setHeader(name: string, value: string): void; flushHeaders(): void; write(value: string): boolean; end(): void };
  response.chunks = [];
  response.headers = new Map();
  response.statusCode = 0;
  response.writableEnded = false;
  response.headersSent = false;
  response.setHeader = (name, value) => { response.headers.set(name, value); };
  response.flushHeaders = () => { response.headersSent = true; };
  response.write = (value) => { response.headersSent = true; response.chunks.push(value); return true; };
  response.end = () => { response.writableEnded = true; };
  return response;
}

type AcceptanceMetricValue = number | "UNKNOWN";
type AcceptanceMetrics = { providerCalls: AcceptanceMetricValue; retrievalRounds: AcceptanceMetricValue; memoryReads: AcceptanceMetricValue; memoryWrites: AcceptanceMetricValue; toolCalls: AcceptanceMetricValue; candidateCount: AcceptanceMetricValue; searchNodes: AcceptanceMetricValue; verificationRounds: AcceptanceMetricValue; repairRounds: AcceptanceMetricValue; backtracks: AcceptanceMetricValue; cacheHits: AcceptanceMetricValue; cacheMisses: AcceptanceMetricValue; stopReason: string };
const baselineMetrics = (): AcceptanceMetrics => ({ providerCalls: 1, retrievalRounds: "UNKNOWN", memoryReads: "UNKNOWN", memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: "UNKNOWN", searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: "DIRECT_BASELINE" });
function measuredAcceptanceMetrics(trace: { providerCallCount: number; retrievalQueryCount: number; memoryLookupCount: number; summary: unknown }): AcceptanceMetrics {
  const summary = trace.summary as { toolCalls?: number; candidateCount?: number; revisions?: number; cacheHits?: number; cacheMisses?: number; verificationPasses?: number; stopReason?: string; cognitiveKernel?: { budget?: { used?: { toolCalls?: number } }; stopReason?: string }; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number }; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } } };
  return { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: summary.toolCalls ?? summary.cognitiveKernel?.budget?.used?.toolCalls ?? "UNKNOWN", candidateCount: summary.candidateCount ?? summary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: summary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: summary.cognitiveSignature?.verificationRounds ?? summary.verificationPasses ?? "UNKNOWN", repairRounds: summary.revisions ?? "UNKNOWN", backtracks: summary.cognitiveSearch?.usage?.backtracks ?? summary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: summary.cacheHits ?? "UNKNOWN", cacheMisses: summary.cacheMisses ?? "UNKNOWN", stopReason: summary.stopReason ?? summary.cognitiveKernel?.stopReason ?? "UNKNOWN" };
}
const acceptanceLedger = new Oic5AcceptanceLedger();
type Oic5AcceptanceCaseId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P";
const casePurpose: Record<Oic5AcceptanceCaseId, string> = { A: "Shallow MAX trivial execution", B: "Structured multi-constraint Workbench repair", C: "Scoped Memory baseline uplift", D: "Scoped evidence-gap retrieval uplift", E: "Deterministic calculator tool execution", F: "Dependency-ordered subproblem execution", G: "Verifier-triggered structured repair", H: "Conflicting evidence retains uncertainty", I: "Context pressure and evidence preservation", J: "Resolvable high-depth bounded search", K: "Competing hypotheses updated by shared evidence", L: "Live multi-candidate disagreement and merge", M: "Adversarial critic and candidate acceptance", N: "Deterministic tool failure and bounded replan", O: "Scoped deterministic cache miss then hit", P: "Knowledge and Memory dependency invalidation" };
function emitAcceptanceRecord(input: { id: Oic5AcceptanceCaseId; model: string; baselineSummary: string; baselineAssertions: Record<string, boolean>; baseline: AcceptanceMetrics; baselineRequestId: string; profile: string; oicSummary: string; oicAssertions: Record<string, boolean>; oic: AcceptanceMetrics; traceId: string; requestId: string; additionalTraceIds?: string[]; strategyTransitions?: Array<{ from: string; to: string; action: string; reason: string }> }): void {
  const passed = Object.values(input.oicAssertions).every(Boolean);
  const record = {
    id: input.id, status: passed ? "PASS" as const : "FAIL" as const, purpose: casePurpose[input.id], providerModel: input.model,
    baseline: { executed: true, resultSummary: input.baselineSummary, objectiveAssertions: input.baselineAssertions, metrics: input.baseline },
    oic: { executed: true, profile: input.profile, resultSummary: input.oicSummary, objectiveAssertions: input.oicAssertions, metrics: input.oic },
    traceOrRequestReference: { baselineRequestId: input.baselineRequestId, oicTraceId: input.traceId, oicRequestId: input.requestId, ...(input.additionalTraceIds ? { additionalTraceIds: input.additionalTraceIds } : {}), ...(input.strategyTransitions ? { strategyTransitions: input.strategyTransitions } : {}) }
  };
  assert.ok(passed, `OIC-5 ${input.id} acceptance failed: ${Object.entries(input.oicAssertions).filter(([, value]) => !value).map(([key]) => key).join(", ")}`);
  acceptanceLedger.add(record);
  if (process.env.OIC_ACCEPTANCE_METRICS === "1") console.log(JSON.stringify(record));
}

const enabled = useDedicatedDatabase();
void test("Native Runtime and compatibility execute through the DB resolver, provider executor and counted HTTP fixture", { skip: !enabled }, async (t) => {
  const fixture = new LocalProviderHttpFixture();
  const endpointUrl = await fixture.start();
  const priorKey = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const db = new OicDatabaseService();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 15).toUpperCase();
  let appId: string | undefined;
  let foreignApplicationId: string | undefined;
  let backtrackApplicationId: string | undefined;
  let backtrackPrincipalId: string | undefined;
  let backtrackConnectionId: string | undefined;
  let backtrackUpstreamId: string | undefined;
  let backtrackVariantId: string | undefined;
  let backtrackBindingId: string | undefined;
  let principalId: string | undefined;
  let connectionId: string | undefined;
  let upstreamId: string | undefined;
  let familyId: string | undefined;
  let editionId: string | undefined;
  let revisionId: string | undefined;
  let profileId: string | undefined;
  let profileRevisionId: string | undefined;
  let tenantAId: string | undefined;
  let tenantBId: string | undefined;
  let variantId: string | undefined;
  let bindingId: string | undefined;
  let knowledgeInvalidationPassed = false;
  let knowledgeInvalidationTraceIds: string[] = [];
  try {
    await db.$connect();
    const app = await db.oicApplication.create({ data: { key: `E2${suffix}`, displayName: "Provider Runtime E2E" } });
    appId = app.id;
    const principal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `e2e-${suffix.toLowerCase()}`, displayName: "Runtime E2E principal" } });
    principalId = principal.id;
    const scopes = ["oic:runtime:invoke", "oic:runtime:models:read"];
    await db.oicPrincipalScopeGrant.createMany({ data: scopes.map((scope) => ({ applicationId: app.id, principalId: principal.id, scope })) });
    const actor: AuthenticatedPrincipal = { id: principal.id, applicationId: app.id, scopes, tenantIds: [] };
    const definition = await db.oicProviderDefinition.findUniqueOrThrow({ where: { key: "openai" } });
    const connection = await db.oicProviderConnection.create({ data: { providerDefinitionId: definition.id, scope: "APPLICATION", applicationId: app.id, displayName: "E2E local fixture", endpointUrl, transportProfile: "openai-chat-completions-v1", status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: new Date() } });
    connectionId = connection.id;
    const encrypted = encryptProviderCredential("e2e-only-secret", connection.id, 1);
    await db.oicProviderCredential.create({ data: { connectionId: connection.id, version: 1, ...encrypted } });
    const upstream = await db.oicUpstreamModel.create({ data: { providerDefinitionId: definition.id, connectionId: connection.id, upstreamModelId: "fixture-private-upstream", displayName: "Fixture upstream", source: "MANUAL" } });
    upstreamId = upstream.id;
    await db.oicUpstreamCapabilityEvidence.createMany({ data: ["text.generate", "text.stream"].map((capability) => ({ upstreamModelId: upstream.id, capability, status: "SUPPORTED", source: "PLATFORM_CURATED" })) });
    const family = await db.oicModelFamily.create({ data: { familyKey: `e2e-${suffix.toLowerCase()}`, displayName: "E2E Oi Family", lifecycle: "PRODUCTION" } });
    familyId = family.id;
    const publicId = `oi-e2e-${suffix.toLowerCase()}`;
    const edition = await db.oicModelEdition.create({ data: { familyId: family.id, publicId, editionKey: "default", displayName: "E2E Oi Model", lifecycle: "PRODUCTION" } });
    editionId = edition.id;
    const revision = await db.oicModelRevision.create({ data: { editionId: edition.id, revision: 1, instructions: "acceptance" } });
    revisionId = revision.id;
    const variant = await db.oicModelVariant.create({ data: { revisionId: revision.id, variantKey: "primary", kind: "EXTERNAL_PROVIDER", providerDefinitionId: definition.id, upstreamModelId: upstream.id, transportProfile: "openai-chat-completions-v1" } });
    variantId = variant.id;
    const binding = await db.oicRuntimeBinding.create({ data: { editionId: edition.id, variantId: variant.id, connectionId: connection.id, scope: "APPLICATION", applicationId: app.id, status: "ACTIVE", environment: "production" } });
    bindingId = binding.id;
    await db.oicApplicationModelVisibility.create({ data: { applicationId: app.id, editionId: edition.id } });

    const resolver = new DatabaseOicModelResolver(db);
    const network = {
      timeoutMs: 500,
      resolveEndpoint(input: string) {
        const url = new URL(input);
        if (url.hostname !== "provider-fixture.test" || url.protocol !== "http:") throw new Error("non-fixture network path");
        return Promise.resolve({ url, hostname: url.hostname, addresses: [{ address: "127.0.0.1", family: 4 as const }] });
      },
      request(url: URL, headers: Record<string, string>, body: Buffer, signal: AbortSignal | undefined, timeoutMs: number) {
        return new Promise<IncomingMessage>((resolveResponse, reject) => {
          let incoming: IncomingMessage | undefined;
          const outgoing = httpRequest(url, { method: "POST", headers, signal, timeout: timeoutMs, lookup: (_host, options, callback) => options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) }, (response) => { incoming = response; resolveResponse(response); });
          outgoing.on("timeout", () => { const error = new Error("fixture timeout"); incoming?.destroy(error); outgoing.destroy(error); });
          outgoing.on("error", reject);
          outgoing.end(body);
        });
      }
    };
    const executor = ProviderRuntimeExecutor.forTest(db, network);
    const contextResolver = new RuntimeContextResolver(db);
    const runtime = new OicRuntimeService(db, contextResolver, resolver, executor, new BoundedRuntimePolicy());
    const model = publicId as `oi-${string}`;
    const body = { model, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "hello from Native Runtime" }] }] };
    const identity = { requestId: `e2e-${suffix}`, traceId: `trace-${suffix}` };

    await t.test("Native Runtime uses actual provider fixture and idempotency replays one upstream call", async () => {
      fixture.mode = "success";
      const before = fixture.captured.length;
      const [first, replay] = await Promise.all([runtime.invoke(actor, body, identity, `e2e-${suffix}`), runtime.invoke(actor, body, identity, `e2e-${suffix}`)]);
      assert.deepEqual(first, replay);
      assert.equal(first.output[0]?.content[0]?.text, "fixture answer");
      assert.deepEqual(first.usage, { inputTokens: 11, cachedInputTokens: 2, outputTokens: 4, reasoningTokens: 1 });
      assert.equal(fixture.captured.length - before, 1);
      assert.equal(JSON.stringify(first).includes("fixture-private-upstream"), false);
      assert.equal(JSON.stringify(first).includes("e2e-only-secret"), false);
      const models = await runtime.listVisibleModels(actor, undefined, identity);
      assert.deepEqual(models.models.map((item) => item.id), [model]);
      assert.equal(JSON.stringify(models).includes("fixture-private-upstream"), false);
    });

    await t.test("MAX profile remains shallow for a trivial task through the real intelligence runtime", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["Hello."];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Say hello." }] }] };
      const identity = { requestId: `max-trivial-${suffix}`, traceId: `max-trivial-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `max-trivial-baseline-${suffix}`, traceId: `max-trivial-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ["Hello."];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["Hello."];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 100, retrievalIntensity: 100, reasoningIntensity: 100, verificationIntensity: 100, maxCandidates: 4, maxProviderCalls: 8, maxStages: 20, maxRetrievalQueries: 8, maxMemoryItems: 20 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const output = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { select: { stageType: true } } } });
      const summary = trace.summary as { durationMs?: number; cognitiveKernel?: { depth: number; actions: Array<{ action: string }> }; cognitiveSignature?: { candidateCount: number; retrievalMode: string }; cognitiveSearch?: { usage?: { nodes: number } }; toolCalls?: number; cacheHits?: number; cacheMisses?: number; revisions?: number };
      if (process.env.OIC_ACCEPTANCE_METRICS === "1") console.log(JSON.stringify({ acceptanceMetrics: "MAX_TRIVIAL", latencyMs: summary.durationMs ?? null, ...measuredAcceptanceMetrics(trace) }));
      assert.equal(trace.providerCallCount, 1);
      assert.equal(summary.cognitiveKernel?.depth, 0);
      assert.equal(summary.cognitiveSignature?.candidateCount, 1);
      assert.equal(summary.cognitiveSignature?.retrievalMode, "OFF");
      assert.equal(trace.stages.some((stage) => ["MEMORY_SELECTION", "RETRIEVAL", "CRITIC", "CANDIDATE_GENERATION"].includes(stage.stageType)), false);
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "STOP"));
      emitAcceptanceRecord({ id: "A", model, baselineSummary: baseline.outputText, baselineAssertions: { directCompletion: baseline.outputText === "Hello." }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: output.outputText, oicAssertions: { objectiveCompletion: output.outputText === "Hello.", singleProviderCall: trace.providerCallCount === 1, shallowDepth: summary.cognitiveKernel?.depth === 0, expensiveStagesSkipped: !trace.stages.some((stage) => ["MEMORY_SELECTION", "RETRIEVAL", "CRITIC", "CANDIDATE_GENERATION"].includes(stage.stageType)) }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: summary.toolCalls ?? "UNKNOWN", candidateCount: summary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: summary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: summary.revisions ?? "UNKNOWN", backtracks: "UNKNOWN", cacheHits: summary.cacheHits ?? "UNKNOWN", cacheMisses: summary.cacheMisses ?? "UNKNOWN", stopReason: (summary as { stopReason?: string }).stopReason ?? "UNKNOWN" } });
      const repeatedLatency: number[] = [];
      for (let index = 1; index <= 10; index++) {
        const sampleIdentity = { requestId: `max-trivial-repeat-${index}-${suffix}`, traceId: `max-trivial-repeat-${index}-trace-${suffix}` };
        const sampleContext = await contextResolver.resolve(actor, request, sampleIdentity);
        await engine.execute(profiled, request, sampleContext, AbortSignal.timeout(10_000));
        const sampleTrace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: sampleIdentity.traceId }, select: { providerCallCount: true, summary: true } });
        const sampleSummary = sampleTrace.summary as { durationMs?: number; cognitiveKernel?: { depth: number }; cognitiveSignature?: { retrievalMode: string } };
        assert.equal(sampleTrace.providerCallCount, 1);
        assert.equal(sampleSummary.cognitiveKernel?.depth, 0);
        assert.equal(sampleSummary.cognitiveSignature?.retrievalMode, "OFF");
        if (sampleSummary.durationMs !== undefined) repeatedLatency.push(sampleSummary.durationMs);
      }
      repeatedLatency.sort((left, right) => left - right);
      const latencyP50 = repeatedLatency.length % 2 ? repeatedLatency[(repeatedLatency.length - 1) / 2]! : (repeatedLatency[repeatedLatency.length / 2 - 1]! + repeatedLatency[repeatedLatency.length / 2]!) / 2;
      const latencyP95 = repeatedLatency[Math.max(0, Math.ceil(repeatedLatency.length * 0.95) - 1)] ?? null;
      if (process.env.OIC_ACCEPTANCE_METRICS === "1") console.log(JSON.stringify({ acceptanceMetrics: "REPEATED_MAX_TRIVIAL", samples: repeatedLatency.length, latencyP50Ms: latencyP50 ?? null, latencyP95Ms: latencyP95, providerCalls: 1, retrievalRounds: 0, memoryReads: 0, candidates: 1, note: "ten warm local-fixture executions; OIC engine overhead, not external provider latency" }));
      assert.equal(repeatedLatency.length, 10);
    });

    await t.test("MAX live runtime generates distinct candidates, detects disagreement, and records an explicit merge", async () => {
      fixture.mode = "success";
      fixture.responseTexts = [
        '{"recommendation":"rollout","basis":["ordered-approval","rollback"]}',
        '{"recommendation":"rollback","basis":["failure-isolation","recovery"]}',
        '{"recommendation":"rollout","basis":["constraints","owner-readiness"]}',
        '{"recommendation":"rollout","resolution":"merged constraints with recovery path"}'
      ];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Compare the rollout strategy with the rollback strategy; analyze dependencies and operational risks; distinguish the competing approaches; evaluate resource limits, deadlines, maintainability, and failure handling; recommend the option that best satisfies all stated constraints." }] }] };
      const identity = { requestId: `max-candidates-${suffix}`, traceId: `max-candidates-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `max-candidates-baseline-${suffix}`, traceId: `max-candidates-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ['{"recommendation":"rollout","basis":["ordered-approval","rollback"]}'];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = [
        '{"recommendation":"rollout","basis":["ordered-approval","rollback"]}',
        '{"recommendation":"rollback","basis":["failure-isolation","recovery"]}',
        '{"recommendation":"rollout","basis":["constraints","owner-readiness"]}',
        '{"recommendation":"rollout","resolution":"merged constraints with recovery path"}'
      ];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, contextIntensity: 90, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 100, verificationIntensity: 60, synthesisIntensity: 80, efficiencyIntensity: 40, maxCandidates: 3, maxProviderCalls: 8, maxStages: 18, maxRetrievalQueries: 0, maxMemoryItems: 0, maxVerificationRounds: 1, allowRevision: false } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true } });
      const summary = trace.summary as { cognitiveSignature?: { effectiveDepth: number; candidateCount: number }; candidateDiversity?: { planned: number; evaluated: number; structuralFingerprints: Array<{ fingerprint: string }> }; candidateComparison?: { disagreement: boolean; decision: string; selectedIds: string[] } };
      assert.match(result.outputText, /merged constraints with recovery path/);
      assert.equal(summary.cognitiveSignature?.effectiveDepth, 4);
      assert.equal(summary.cognitiveSignature?.candidateCount, 3);
      assert.equal(summary.candidateDiversity?.planned, 3);
      assert.equal(summary.candidateDiversity?.evaluated, 3);
      assert.equal(new Set(summary.candidateDiversity?.structuralFingerprints.map((item) => item.fingerprint)).size, 3);
      assert.equal(summary.candidateComparison?.disagreement, true);
      assert.equal(summary.candidateComparison?.decision, "MERGE");
      assert.equal(summary.candidateComparison?.selectedIds.length, 3);
      assert.equal(trace.providerCallCount, 4);
      emitAcceptanceRecord({ id: "L", model, baselineSummary: baseline.outputText, baselineAssertions: { oneDirectProviderExecution: baseline.outputText.length > 0 }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: result.outputText, oicAssertions: { threeDistinctCandidates: summary.candidateDiversity?.evaluated === 3 && new Set(summary.candidateDiversity.structuralFingerprints.map((item) => item.fingerprint)).size === 3, disagreementDetected: summary.candidateComparison?.disagreement === true, mergedResultReturned: result.outputText.includes("merged constraints with recovery path"), boundedProviderCalls: trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: summary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: "UNKNOWN" } });
    });

    await t.test("MAX context-pressure runtime preserves hard constraints and critical evidence within its configured budget", async () => {
      fixture.mode = "success";
      const approved = await db.oicIntelligenceKnowledge.create({ data: { applicationId: app.id, sourceKey: `pressure-${suffix}`, sourceRef: `approved-${suffix}`, title: "OIC pressure fixture approved launch status", content: "CRITICAL_EVIDENCE=green. The approved launch status is green.", authority: 98, sourcePriority: 100 } });
      await db.oicIntelligenceKnowledge.createMany({ data: [
        { applicationId: app.id, sourceKey: `pressure-${suffix}`, sourceRef: `duplicate-${suffix}`, title: "OIC pressure fixture approved launch status", content: "CRITICAL_EVIDENCE=green. The approved launch status is green.", authority: 90, sourcePriority: 90 },
        { applicationId: app.id, sourceKey: `pressure-${suffix}`, sourceRef: `noise-${suffix}`, title: "Warehouse toner inventory", content: "Printer toner warehouse invoice shipping cabinet inventory. ".repeat(100), authority: 5, sourcePriority: 1 }
      ] });
      const userText = "Return JSON with required fields status and source. Preserve the hard constraint that status must equal green. Cite the approved source. Review the approved release note alongside its duplicate; analyze the release dependency; identify the critical fact; exclude unrelated material; provide the objective result.";
      const request = { model, sessionId: undefined, input: [
        { speaker: "user" as const, content: [{ type: "text" as const, text: userText }] },
        { speaker: "context" as const, content: [{ type: "text" as const, text: `LOW PRIORITY CONVERSATION NOISE ${"filler material ".repeat(900)} EXCLUDED_NOISE_SENTINEL` }] }
      ] };
      const identity = { requestId: `context-pressure-${suffix}`, traceId: `context-pressure-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const expected = `{"status":"green","source":"approved-runbook [EVIDENCE ${approved.id}]"}`;
      fixture.responseTexts = ["status constrained to green", "approved source identified", "duplicate note confirmed", "dependency checked", "critical fact retained", "noise excluded; objective met", expected];
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, contextIntensity: 100, memoryIntensity: 0, retrievalIntensity: 100, reasoningIntensity: 100, toolsIntensity: 0, verificationIntensity: 80, synthesisIntensity: 80, efficiencyIntensity: 50, maxContextTokens: 512, maxCandidates: 1, maxProviderCalls: 7, maxStages: 18, maxRetrievalQueries: 5, maxMemoryItems: 0, maxVerificationRounds: 1, allowRevision: false, requireEvidence: true } };
      const baselineIdentity = { requestId: `context-pressure-baseline-${suffix}`, traceId: `context-pressure-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts.unshift('{"status":"unknown","source":"none"}');
      const baseline = await executor.execute(resolved, request, baselineContext);
      const firstCaptured = fixture.captured.length;
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, verificationStatus: true, summary: true, stages: { select: { stageType: true, metadata: true } } } });
      const summary = trace.summary as { stopReason: string; revisions: number; cacheHits: number; cacheMisses: number; cognitiveKernel?: { budget: { used: { candidates: number; toolCalls: number; backtracks: number } } }; cognitiveSignature?: { candidateCount: number; verificationRounds: number; backtracks: number }; cognitiveSearch?: { usage?: { nodes: number } } };
      const contextMetadata = trace.stages.find((stage) => stage.stageType === "CONTEXT_COMPILATION")?.metadata as { originalTokenEstimate: number; tokenEstimate: number; compression: { duplicateEvidenceRemoved: number; irrelevantEvidenceExcluded: number; budgetTruncatedItems: number } } | undefined;
      const calls = fixture.captured.slice(firstCaptured).map((item) => item.body);
      const assertions = {
        hardConstraintPreserved: result.outputText.includes('"status":"green"'),
        criticalEvidencePreserved: calls.some((body) => body.includes("CRITICAL_EVIDENCE=green")),
        duplicateReduction: (contextMetadata?.compression.duplicateEvidenceRemoved ?? 0) > 0,
        irrelevantNoiseExcluded: calls.every((body) => !body.includes("EXCLUDED_NOISE_SENTINEL") && !body.includes("Warehouse toner inventory")),
        budgetExceeded: (contextMetadata?.tokenEstimate ?? Number.POSITIVE_INFINITY) <= 512,
        objectiveResult: result.outputText === expected && ["PASS", "PASS_WITH_WARNINGS"].includes(trace.verificationStatus) && ["SUCCESS", "ENOUGH_EVIDENCE"].includes(summary.stopReason)
      };
      emitAcceptanceRecord({ id: "I", model, baselineSummary: baseline.outputText.includes("unknown") ? "unknown" : "non-unknown", baselineAssertions: { objectiveResult: false }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: "green with approved source", oicAssertions: assertions, traceId: identity.traceId, requestId: identity.requestId, oic: measuredAcceptanceMetrics(trace) });
      assert.ok(Object.values(assertions).every(Boolean), JSON.stringify({ assertions, context: contextMetadata, verificationStatus: trace.verificationStatus, providerCalls: trace.providerCallCount, stopReason: summary.stopReason, stageTypes: trace.stages.map((stage) => stage.stageType) }));
      assert.ok((contextMetadata?.originalTokenEstimate ?? 0) > (contextMetadata?.tokenEstimate ?? 0));
      assert.ok((contextMetadata?.compression.budgetTruncatedItems ?? 0) > 0);
      assert.ok(trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls);
      assert.notEqual(baseline.outputText, result.outputText);
      assert.equal(trace.retrievalQueryCount > 0, true);
      assert.equal(approved.lifecycle, "ACTIVE");
    });

    await t.test("MAX high-depth search resolves a separate authoritative chronology case", async () => {
      fixture.mode = "success";
      const record = await db.oicIntelligenceKnowledge.create({ data: { applicationId: app.id, sourceKey: `high-depth-${suffix}`, sourceRef: `aurora-chronology-${suffix}`, title: "Aurora 2028 approval rollout chronology", content: "For Aurora's 2028 release, security approval completed on May 1. Production rollout began on May 3. The authoritative sequence is security approval before production rollout.", authority: 99, sourcePriority: 100 } });
      const userText = "Determine whether Aurora's 2028 release had security approval before production rollout or production rollout before security approval using the authoritative chronology record, recorded approval date, recorded rollout date, required dependency ordering, evidence provenance, publication authority, record freshness, key operational constraint, release decision requirements, event sequence, current status, source reliability, direct support, possible counter-evidence, bounded conclusion, return JSON containing keys result and source, state whether the chronology remains uncertain, and cite the evidence";
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: userText }] }] };
      const identity = { requestId: `high-depth-${suffix}`, traceId: `high-depth-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const expected = `{"result":"Aurora 2028 approval completed on May 1 before rollout began on May 3","source":"[EVIDENCE ${record.id}]"}`;
      fixture.responseTexts = ["unknown without evidence"];
      const baselineIdentity = { requestId: `high-depth-baseline-${suffix}`, traceId: `high-depth-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      const baseline = await executor.execute(resolved, request, baselineContext);
      fixture.responseTexts = [expected];
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, contextIntensity: 90, memoryIntensity: 0, retrievalIntensity: 100, reasoningIntensity: 100, toolsIntensity: 0, verificationIntensity: 85, synthesisIntensity: 75, efficiencyIntensity: 40, maxCandidates: 1, maxProviderCalls: 8, maxStages: 20, maxRetrievalQueries: 8, maxMemoryItems: 0, maxVerificationRounds: 1, allowRevision: false, requireEvidence: true } };
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, verificationStatus: true, summary: true } });
      const summary = trace.summary as { stopReason: string; revisions: number; cacheHits: number; cacheMisses: number; cognitiveSignature?: { effectiveDepth: number; candidateCount: number; verificationRounds: number; stopReason: string }; cognitiveSearch?: { stopReason: string; usage: { nodes: number; providerCalls: number; backtracks: number }; limits: { maxTotalNodes: number; maxProviderCalls: number; maxBacktracks: number } }; evidenceGraph?: { summary: { conflictCount: number } }; cognitiveKernel?: { budget: { limits: { providerCalls: number; retrievalRounds: number; stages: number }; used: { providerCalls: number; retrievalRounds: number; stages: number } } }; hypotheses?: Array<{ assessment: string }> };
      const assertions = {
        baselineDidNotResolve: baseline.outputText !== expected,
        highDepthEnabled: summary.cognitiveSignature?.effectiveDepth === 4,
        boundedSearchUsed: (summary.cognitiveSearch?.usage.nodes ?? 0) > 1,
        searchWithinLimits: (summary.cognitiveSearch?.usage.nodes ?? Number.POSITIVE_INFINITY) <= (summary.cognitiveSearch?.limits.maxTotalNodes ?? 0) && (summary.cognitiveSearch?.usage.providerCalls ?? Number.POSITIVE_INFINITY) <= (summary.cognitiveSearch?.limits.maxProviderCalls ?? 0) && (summary.cognitiveSearch?.usage.backtracks ?? Number.POSITIVE_INFINITY) <= (summary.cognitiveSearch?.limits.maxBacktracks ?? 0),
        noConflictingEvidence: summary.evidenceGraph?.summary.conflictCount === 0,
        objectiveCompletion: result.outputText === expected && ["PASS", "PASS_WITH_WARNINGS"].includes(trace.verificationStatus) && ["SUCCESS", "ENOUGH_EVIDENCE"].includes(summary.stopReason)
      };
      emitAcceptanceRecord({ id: "J", model, baselineSummary: "unknown without retrieved chronology", baselineAssertions: { objectiveResult: false }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: "authoritative chronology resolved", oicAssertions: assertions, traceId: identity.traceId, requestId: identity.requestId, oic: measuredAcceptanceMetrics(trace) });
      assert.ok(Object.values(assertions).every(Boolean), JSON.stringify({ assertions, search: summary.cognitiveSearch, depth: summary.cognitiveSignature?.effectiveDepth, stop: summary.stopReason, verificationStatus: trace.verificationStatus, resultMatches: result.outputText === expected, hypotheses: summary.hypotheses }));
      assert.ok(trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls);
    });

    await t.test("same provider and model produce bounded LIGHT, ADVANCED, and MAX behavior on one complex task", async () => {
      fixture.mode = "success";
      const sessionId = `tier-session-${suffix}`;
      await db.oicIntelligenceMemory.create({ data: {
        applicationId: app.id, actorPrincipalId: actor.id, sessionId, kind: "SESSION", lifecycle: "ACTIVE", sensitivity: "INTERNAL",
        title: "Earlier session release plan", content: "Earlier session note: rollout plan Gamma requires security sign-off before deployment.", sourceType: `tier-${suffix}`, sourceRef: `session-${suffix}`,
        confidence: 85, salience: 85, validUntil: new Date(Date.now() + 60_000)
      } });
      await db.oicIntelligenceKnowledge.createMany({ data: [
        { applicationId: app.id, tenantId: null, sourceKey: `tier-${suffix}`, sourceRef: `release-current-${suffix}`, title: "Release dependency acceptance", content: "Security approval is required before production rollout.", authority: 95, sourcePriority: 95 },
        { applicationId: app.id, tenantId: null, sourceKey: `tier-${suffix}`, sourceRef: `release-old-${suffix}`, title: "Release dependency acceptance", content: "Security approval is not required before production rollout.", authority: 55, sourcePriority: 55 }
      ] });
      const request = { model, sessionId, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Using the earlier session note, compare the two release strategies. Analyze their operational risks. Identify the dependency between approval and rollout. Cite supporting evidence and state any remaining uncertainty." }] }] };
      const resolvedByTier = async (tier: "LIGHT" | "ADVANCED" | "MAX", sample = "primary") => {
        const identity = { requestId: `tier-${tier.toLowerCase()}-${sample}-${suffix}`, traceId: `tier-${tier.toLowerCase()}-${sample}-trace-${suffix}` };
        const context = await contextResolver.resolve(actor, request, identity);
        const resolved = await resolver.resolve(model, context); assert.ok(resolved);
        const intensities = tier === "LIGHT"
          ? { contextIntensity: 25, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 25, toolsIntensity: 0, verificationIntensity: 0, synthesisIntensity: 0, efficiencyIntensity: 85, maxCandidates: 1, maxProviderCalls: 2, maxStages: 6, maxRetrievalQueries: 0, maxMemoryItems: 0 }
          : tier === "ADVANCED"
            ? { contextIntensity: 65, memoryIntensity: 65, retrievalIntensity: 60, reasoningIntensity: 70, toolsIntensity: 40, verificationIntensity: 65, synthesisIntensity: 50, efficiencyIntensity: 55, maxCandidates: 2, maxProviderCalls: 5, maxStages: 12, maxRetrievalQueries: 3, maxMemoryItems: 4 }
            : { contextIntensity: 90, memoryIntensity: 95, retrievalIntensity: 100, reasoningIntensity: 100, toolsIntensity: 80, verificationIntensity: 90, synthesisIntensity: 80, efficiencyIntensity: 70, maxCandidates: 3, maxProviderCalls: 8, maxStages: 22, maxRetrievalQueries: 6, maxMemoryItems: 8 };
        const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, ...intensities, allowRevision: tier !== "LIGHT", maxVerificationRounds: tier === "MAX" ? 2 : 1, requireEvidence: tier !== "LIGHT" } };
        fixture.responseTexts = Array.from({ length: 8 }, (_, index) => `Tier ${tier} deterministic response ${index + 1}.`);
        const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
        const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
        const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { modelRevisionId: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true } });
        return { result, trace, configured: profiled.intelligenceProfile };
      };
      const light = await resolvedByTier("LIGHT");
      const advanced = await resolvedByTier("ADVANCED");
      const max = await resolvedByTier("MAX");
      fixture.responseTexts = [];
      const behavior = (entry: typeof light) => {
        const summary = entry.trace.summary as { durationMs?: number; cognitiveSignature?: { effectiveDepth: number; candidateCount: number; retrievalMode: string; verificationRounds: number; backtracks: number }; cognitiveKernel?: { strategy: string; strategyTransitions?: Array<{ from: string; to: string; reason: string }>; budget: { used: { providerCalls: number; candidates: number; toolCalls: number; backtracks: number } } }; memorySelection?: Array<{ id: string }>; cognitiveSearch?: { usage?: { nodes: number } }; revisions?: number; cacheHits?: number; cacheMisses?: number };
        return { summary, strategy: summary.cognitiveKernel?.strategy, providerCalls: entry.trace.providerCallCount, retrievalQueries: entry.trace.retrievalQueryCount, memoryReads: entry.trace.memoryLookupCount };
      };
      const l = behavior(light); const a = behavior(advanced); const m = behavior(max);
      if (process.env.OIC_ACCEPTANCE_METRICS === "1") console.log(JSON.stringify({ acceptanceMetrics: "SAME_PROVIDER_COMPLEX_TIERS", metrics: ["LIGHT", "ADVANCED", "MAX"].map((tier, index) => { const entry = [light, advanced, max][index]!; const value = behavior(entry); return { tier, latencyMs: value.summary.durationMs ?? null, ...measuredAcceptanceMetrics(entry.trace) }; }) }));
      assert.equal(light.trace.modelRevisionId, advanced.trace.modelRevisionId);
      assert.equal(advanced.trace.modelRevisionId, max.trace.modelRevisionId);
      assert.equal(light.result.executorVersion, "openai-chat-completions-v1");
      assert.equal(advanced.result.executorVersion, "openai-chat-completions-v1");
      assert.equal(max.result.executorVersion, "openai-chat-completions-v1");
      assert.equal(l.summary.cognitiveSignature?.candidateCount, 1);
      assert.equal(m.summary.cognitiveSignature?.candidateCount, 3);
      assert.equal(l.summary.cognitiveSignature?.retrievalMode, "OFF");
      assert.equal(a.summary.cognitiveSignature?.retrievalMode, "BALANCED");
      assert.equal(m.summary.cognitiveSignature?.retrievalMode, "MAX");
      assert.ok(l.summary.cognitiveSignature.effectiveDepth < m.summary.cognitiveSignature.effectiveDepth);
      assert.notEqual(l.strategy, m.strategy);
      assert.ok(l.providerCalls <= light.configured.maxProviderCalls);
      assert.ok(a.providerCalls <= advanced.configured.maxProviderCalls);
      assert.ok(m.providerCalls <= max.configured.maxProviderCalls);
      assert.ok(a.retrievalQueries > 0);
      assert.ok(m.retrievalQueries >= a.retrievalQueries);
      assert.equal(l.memoryReads, 0);
      assert.ok(a.memoryReads > 0 && m.memoryReads > 0);
      assert.ok(m.summary.cognitiveKernel?.budget.used.candidates === 3);
      assert.ok(m.summary.cognitiveKernel?.strategyTransitions?.some((item) => item.to === "MULTI_CANDIDATE"));
      assert.ok(m.summary.cognitiveSignature.verificationRounds >= l.summary.cognitiveSignature.verificationRounds);

      const repeatTier = async (tier: "LIGHT" | "ADVANCED" | "MAX") => {
        const entries: Awaited<ReturnType<typeof resolvedByTier>>[] = [];
        for (let index = 1; index <= 10; index++) entries.push(await resolvedByTier(tier, `repeat-${index}`));
        return entries;
      };
      const repeated = { LIGHT: await repeatTier("LIGHT"), ADVANCED: await repeatTier("ADVANCED"), MAX: await repeatTier("MAX") };
      const percentile = (values: number[], fraction: number) => {
        const sorted = [...values].sort((left, right) => left - right);
        if (fraction === 0.5 && sorted.length % 2 === 0) return (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
        return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
      };
      const repeatedMetric = (entries: typeof repeated.LIGHT) => {
        const observations = entries.map((entry) => {
          const summary = entry.trace.summary as { durationMs?: number; cognitiveSignature?: { candidateCount: number; verificationRounds: number; backtracks: number }; cognitiveSearch?: { usage?: { nodes: number } }; cognitiveKernel?: { budget?: { used?: { toolCalls: number } } }; revisions?: number; cacheHits?: number; cacheMisses?: number };
          return { latencyMs: summary.durationMs ?? null, metrics: measuredAcceptanceMetrics(entry.trace) };
        });
        const latencies = observations.flatMap((item) => item.latencyMs === null ? [] : [item.latencyMs]);
        const measuredKeys = ["providerCalls", "retrievalRounds", "memoryReads", "memoryWrites", "toolCalls", "candidateCount", "searchNodes", "verificationRounds", "repairRounds", "backtracks", "cacheHits", "cacheMisses"] as const;
        const resourceRange = Object.fromEntries(measuredKeys.map((key) => { const values = observations.map((item) => item.metrics[key]); const numbers = values.filter((value): value is number => typeof value === "number"); return [key, numbers.length === values.length ? { min: Math.min(...numbers), max: Math.max(...numbers) } : "UNKNOWN"]; }));
        return { samples: observations.length, latencyP50Ms: latencies.length ? percentile(latencies, 0.5) : null, latencyP95Ms: latencies.length ? percentile(latencies, 0.95) : null, resourceRange };
      };
      if (process.env.OIC_ACCEPTANCE_METRICS === "1") console.log(JSON.stringify({ acceptanceMetrics: "REPEATED_SAME_PROVIDER_COMPLEX_TIERS", measurements: Object.fromEntries(Object.entries(repeated).map(([tier, entries]) => [tier, repeatedMetric(entries)])), note: "ten warm local-fixture executions per tier; OIC engine overhead, not external provider latency" }));
      assert.equal(repeated.LIGHT.length, 10);
      assert.equal(repeated.ADVANCED.length, 10);
      assert.equal(repeated.MAX.length, 10);
      assert.ok(repeated.MAX.every((entry) => entry.trace.providerCallCount <= entry.configured.maxProviderCalls));
      fixture.responseTexts = [];
    });

    await t.test("OIC intelligence execution sends a session-scoped memory selection through the local provider fixture", async () => {
      fixture.mode = "success"; fixture.responseTexts = [];
      const sessionId = `session-${suffix}`;
      const tenantA = await db.oicTenant.create({ data: { applicationId: app.id, key: `mem-a-${suffix}`, displayName: "Memory Tenant A" } }); tenantAId = tenantA.id;
      const tenantB = await db.oicTenant.create({ data: { applicationId: app.id, key: `mem-b-${suffix}`, displayName: "Memory Tenant B" } }); tenantBId = tenantB.id;
      const actorA = { ...actor, tenantIds: [tenantA.id] };
      const selectedMemory = await db.oicIntelligenceMemory.create({ data: { applicationId: app.id, tenantId: tenantA.id, actorPrincipalId: actor.id, sessionId, kind: "SESSION", lifecycle: "ACTIVE", sensitivity: "INTERNAL", title: `Project codename ${suffix}`, content: `The project codename is orchid-${suffix}.`, sourceType: `acceptance-${suffix}`, sourceRef: `current-${suffix}`, confidence: 90, salience: 90, validUntil: new Date(Date.now() + 60_000) } });
      await db.oicIntelligenceMemory.create({ data: { applicationId: app.id, tenantId: tenantA.id, actorPrincipalId: actor.id, sessionId: `other-${sessionId}`, kind: "SESSION", lifecycle: "ACTIVE", sensitivity: "INTERNAL", title: `Project codename other ${suffix}`, content: `The project codename is cedar-${suffix}.`, sourceType: `acceptance-${suffix}`, sourceRef: `other-session-${suffix}`, confidence: 95, salience: 95, validUntil: new Date(Date.now() + 60_000) } });
      await db.oicIntelligenceMemory.create({ data: { applicationId: app.id, tenantId: tenantB.id, actorPrincipalId: actor.id, sessionId, kind: "SESSION", lifecycle: "ACTIVE", sensitivity: "INTERNAL", title: `Project codename private ${suffix}`, content: `The project codename is redwood-${suffix}.`, sourceType: `acceptance-${suffix}`, sourceRef: `other-tenant-${suffix}`, confidence: 99, salience: 99, validUntil: new Date(Date.now() + 60_000) } });
      const otherPrincipal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `session-actor-${suffix.toLowerCase()}`, displayName: "Other session-memory actor" } });
      const otherActorMemory = await db.oicIntelligenceMemory.create({ data: { applicationId: app.id, tenantId: tenantA.id, actorPrincipalId: otherPrincipal.id, sessionId, kind: "SESSION", lifecycle: "ACTIVE", sensitivity: "INTERNAL", title: `Project codename actor-private ${suffix}`, content: `The project codename is maple-${suffix}.`, sourceType: `acceptance-${suffix}`, sourceRef: `other-actor-${suffix}`, confidence: 98, salience: 98, validUntil: new Date(Date.now() + 60_000) } });
      const request = { model, tenant: { kind: "id" as const, tenantId: tenantA.id }, sessionId, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "What is the project codename?" }] }] };
      const identity = { requestId: `intelligence-${suffix}`, traceId: `intelligence-trace-${suffix}` };
      const context = await contextResolver.resolve(actorA, request, identity);
      const resolved = await resolver.resolve(model, context);
      assert.ok(resolved);
      const baselineIdentity = { requestId: `memory-baseline-${suffix}`, traceId: `memory-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actorA, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_CODENAME_RESULT=unknown"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = [`The project codename is orchid-${suffix}.`];
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const profiledModel = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 60, contextIntensity: 60, maxMemoryItems: 4 } };
      const output = await engine.execute(profiledModel, request, context, AbortSignal.timeout(10_000));
      assert.equal(output.outputText, `The project codename is orchid-${suffix}.`);
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { status: true, taskType: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, inputTokens: true, outputTokens: true, stages: { orderBy: { stageIndex: "asc" }, select: { stageType: true, metadata: true } } } });
      const summary = trace.summary as { memorySelection?: Array<{ id: string }>; memoryPlan?: { kinds: string[]; reasons: string[] } };
      assert.equal(trace.status, "SUCCEEDED");
      assert.ok(trace.stages.some((stage) => stage.stageType === "MEMORY_SELECTION"));
      const memoryMetadata = trace.stages.find((stage) => stage.stageType === "MEMORY_SELECTION")?.metadata as { intensity: number; typesConsidered: string[]; candidateCount: number; selectedCount: number; conflictChecks: number };
      assert.equal(memoryMetadata.intensity, 60);
      assert.deepEqual(memoryMetadata.typesConsidered, ["SESSION"]);
      assert.equal(memoryMetadata.candidateCount, 1);
      assert.equal(memoryMetadata.selectedCount, 1);
      assert.equal(memoryMetadata.conflictChecks, 0);
      assert.deepEqual(summary.memoryPlan?.kinds, ["SESSION"]);
      assert.ok(summary.memorySelection?.some((item) => item.id === selectedMemory.id));
      assert.equal(summary.memorySelection?.some((item) => item.id !== selectedMemory.id), false);
      assert.equal(fixture.captured.at(-1)?.body.includes(`orchid-${suffix}`), true);
      assert.equal(fixture.captured.at(-1)?.body.includes(`cedar-${suffix}`), false);
      assert.equal(fixture.captured.at(-1)?.body.includes(`redwood-${suffix}`), false);
      const otherActorContext = await contextResolver.resolve({ ...actorA, id: otherPrincipal.id }, request, { requestId: `memory-other-actor-${suffix}`, traceId: `memory-other-actor-trace-${suffix}` });
      const otherActorSelection = await new OicMemoryRepository(db).retrieve(request, otherActorContext, profiledModel.intelligenceProfile, ["SESSION"]);
      assert.deepEqual(otherActorSelection.selected.map((item) => item.id), [otherActorMemory.id]);
      assert.equal(otherActorSelection.evidence.some((item) => item.content.includes(`maple-${suffix}`)), true);
      assert.equal(otherActorSelection.evidence.some((item) => item.content.includes(`orchid-${suffix}`)), false);
      assert.equal(trace.inputTokens, 11);
      assert.equal(trace.outputTokens, 4);
      assert.equal((summary as { effectiveProfile?: { resolvedRevisionId?: string } }).effectiveProfile?.resolvedRevisionId, "builtin-fast-unassigned");
      emitAcceptanceRecord({ id: "C", model, baselineSummary: baseline.outputText, baselineAssertions: { baselineLacksScopedCodename: baseline.outputText.includes("unknown") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "FAST_WITH_SCOPED_SESSION_MEMORY", oicSummary: output.outputText, oicAssertions: { selectedCorrectSessionMemory: summary.memorySelection?.some((item) => item.id === selectedMemory.id) === true, otherSessionAndTenantExcluded: !fixture.captured.at(-1)?.body.includes(`cedar-${suffix}`) && !fixture.captured.at(-1)?.body.includes(`redwood-${suffix}`), providerSawScopedFact: fixture.captured.at(-1)?.body.includes(`orchid-${suffix}`) === true }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: "UNKNOWN", searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: "UNKNOWN" } });
    });

    await t.test("explicit remember intent passes the runtime write gate and records its decision", async () => {
      fixture.mode = "success";
      const sessionId = `remember-${suffix}`;
      const request = { model, sessionId, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Remember that the warehouse closes at 18:00." }] }] };
      const identity = { requestId: `memory-write-${suffix}`, traceId: `memory-write-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, allowMemoryWrites: true, maxStages: 8 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const saved = await db.oicIntelligenceMemory.findFirstOrThrow({ where: { applicationId: app.id, actorPrincipalId: actor.id, sessionId, kind: "SESSION", sourceRef: identity.traceId } });
      assert.equal(saved.lifecycle, "ACTIVE");
      assert.equal(saved.content, "the warehouse closes at 18:00.");
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { stages: { where: { stageType: "MEMORY_WRITE_DECISION" }, select: { metadata: true } } } });
      assert.deepEqual(trace.stages[0]?.metadata, { selectedMemoryIds: [], decision: "SESSION", kind: "SESSION" });
    });

    await t.test("approved deep profile stores a structured episodic outcome without prompt or answer text", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["A bounded incident summary."];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Analyze the operational incident, then compare the network timeline, then evaluate recovery options, then recommend next actions with uncertainty." }] }] };
      const identity = { requestId: `episode-${suffix}`, traceId: `episode-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 70, reasoningIntensity: 0, retrievalIntensity: 0, verificationIntensity: 0, allowMemoryWrites: true, maxStages: 8 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const episode = await db.oicIntelligenceMemory.findFirstOrThrow({ where: { applicationId: app.id, actorPrincipalId: actor.id, kind: "EPISODIC", sourceRef: identity.traceId } });
      const metadata = JSON.parse(episode.content) as { taskType: string; outcome: string; providerCalls: number; stageTypes: string[] };
      assert.equal(episode.lifecycle, "ACTIVE");
      assert.equal(metadata.outcome, "SUCCEEDED");
      assert.equal(metadata.providerCalls, 1);
      assert.ok(metadata.stageTypes.includes("TASK_ANALYSIS"));
      assert.equal(episode.content.includes("Analyze the operational incident"), false);
      assert.equal(episode.content.includes("A bounded incident summary"), false);
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { summary: true } });
      assert.equal(((trace.summary as { workingMemory: { scope: string } }).workingMemory).scope, "EXECUTION_ONLY");
    });

    await t.test("reusable strategy detection stores only an unapproved procedural candidate", async () => {
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Analyze a complex incident and compare the recovery options." }] }] };
      const identity = { requestId: `procedure-${suffix}`, traceId: `procedure-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const profile = { ...resolved.intelligenceProfile!, memoryIntensity: 80, allowMemoryWrites: true };
      const repository = new OicMemoryRepository(db);
      const task = { taskType: "REASONING" as const, complexity: 80, uncertainty: "LOW_UNCERTAINTY" as const, evidenceRequired: false, structuredOutput: false, subtaskCount: 2, reasons: [] };
      const result = await repository.writeProceduralCandidate({ context, profile, traceId: identity.traceId, task, strategy: "STRUCTURED_DECOMPOSITION", verificationStatus: "PASS", uncertainty: "LOW_UNCERTAINTY" });
      assert.deepEqual(result, { decision: "PROCEDURAL_CANDIDATE", kind: "PROCEDURAL" });
      const candidate = await db.oicIntelligenceMemory.findFirstOrThrow({ where: { applicationId: app.id, tenantId: context.tenantId, kind: "PROCEDURAL", sourceRef: identity.traceId } });
      assert.equal(candidate.lifecycle, "UNVERIFIED");
      const metadata = JSON.parse(candidate.content) as { strategy: string; approval: string; conditions: { profilePermissionRequired: boolean } };
      assert.equal(metadata.strategy, "STRUCTURED_DECOMPOSITION");
      assert.equal(metadata.approval, "UNAPPROVED");
      assert.equal(metadata.conditions.profilePermissionRequired, true);
      assert.equal(candidate.content.includes(request.input[0]!.content[0]!.text), false);
      const retrieved = await repository.retrieve(request, context, { ...profile, maxMemoryItems: 8 });
      assert.equal(retrieved.evidence.some((item) => item.id === candidate.id), false);
    });

    await t.test("deep retrieval ranks selected-tenant evidence, surfaces conflict, and excludes another tenant", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["The records conflict; the launch date is uncertain."];
      const tenantA = await db.oicTenant.findUniqueOrThrow({ where: { id: tenantAId! } });
      const tenantB = await db.oicTenant.findUniqueOrThrow({ where: { id: tenantBId! } });
      const actorA = { ...actor, tenantIds: [tenantA.id] };
      await db.oicIntelligenceKnowledge.createMany({ data: [
        { applicationId: app.id, tenantId: tenantA.id, sourceKey: `acceptance-${suffix}`, sourceRef: `a-good-${suffix}`, title: "Aurora launch date", content: "Aurora's approved launch date is 2028.", authority: 90, sourcePriority: 90 },
        { applicationId: app.id, tenantId: tenantA.id, sourceKey: `acceptance-${suffix}`, sourceRef: `a-conflict-${suffix}`, title: "Aurora launch date", content: "Aurora's approved launch date is not 2028.", authority: 80, sourcePriority: 80 },
        { applicationId: app.id, tenantId: tenantA.id, sourceKey: `acceptance-${suffix}`, sourceRef: `a-noise-${suffix}`, title: "Router maintenance", content: "Restart the gateway after updating DNS.", authority: 70, sourcePriority: 10 },
        { applicationId: app.id, tenantId: tenantB.id, sourceKey: `acceptance-${suffix}`, sourceRef: `b-private-${suffix}`, title: "Aurora launch date", content: `Aurora secret launch code TENANTB-${suffix} is 2044.`, authority: 100, sourcePriority: 100 }
      ] });
      const request = { model, tenant: { kind: "id" as const, tenantId: tenantA.id }, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "According to the source, determine whether Aurora launched in 2028 or Aurora did not launch in 2028. Cite evidence." }] }] };
      const identity = { requestId: `retrieval-${suffix}`, traceId: `retrieval-trace-${suffix}` };
      const context = await contextResolver.resolve(actorA, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `hypothesis-baseline-${suffix}`, traceId: `hypothesis-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actorA, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_AURORA_RESULT=conflict-unresolved"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["The records conflict; the launch date is uncertain."];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 90, reasoningIntensity: 80, verificationIntensity: 70, synthesisIntensity: 60, maxRetrievalQueries: 5, maxProviderCalls: 3, maxStages: 12, maxContextTokens: 12_000, allowRevision: false } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { uncertainty: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, verificationStatus: true, summary: true, stages: { select: { stageType: true, metadata: true } } } });
      const retrieval = trace.stages.find((stage) => stage.stageType === "RETRIEVAL");
      const metadata = retrieval?.metadata as { contradictionCount?: number; candidateCount?: number; tier?: string; contradictionSearch?: boolean; queryTypes?: string[] } | undefined;
      const sent = fixture.captured.at(-1)?.body ?? "";
      assert.ok(trace.retrievalQueryCount > 0);
      assert.ok((metadata?.candidateCount ?? 0) >= 3);
      assert.ok((metadata?.contradictionCount ?? 0) > 0);
      assert.equal(metadata?.tier, "MAX");
      assert.equal(metadata?.contradictionSearch, true);
      assert.ok(metadata?.queryTypes?.some((type) => ["HYPOTHESIS_COUNTER", "DISCRIMINATING_EVIDENCE"].includes(type)));
      assert.equal(trace.uncertainty, "HIGH_UNCERTAINTY");
      const runSummary = trace.summary as { stopReason?: string; toolCalls?: number; candidateCount?: number; revisions?: number; cacheHits?: number; cacheMisses?: number; cognitiveKernel?: { depth: number; actions: Array<{ action: string; reason: string; strategy: string }>; budget?: { used?: { toolCalls?: number } } }; evidenceGraph?: { version: string; summary: { nodeCount: number; conflictCount: number }; conflicts: Array<{ evidenceIds: string[]; unresolved: boolean }> }; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } }; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number } };
      const graph = runSummary.evidenceGraph;
      assert.equal(graph?.version, "evidence-graph-v1");
      assert.ok((graph?.summary.nodeCount ?? 0) >= 2);
      assert.ok((graph?.summary.conflictCount ?? 0) > 0);
      assert.ok(graph?.conflicts.every((conflict) => conflict.unresolved && conflict.evidenceIds.length === 2));
      assert.equal(runSummary.cognitiveKernel?.depth, 4);
      assert.ok(runSummary.cognitiveKernel?.actions.some((item) => item.action === "RETRIEVE_COUNTER_EVIDENCE"));
      assert.ok(runSummary.cognitiveKernel?.actions.some((item) => item.action === "EXPAND_HYPOTHESES"));
      const hypotheses = (trace.summary as { hypotheses?: Array<{ id: string; assessment: string; transitions: string[]; supportingEvidenceIds: string[]; contradictingEvidenceIds: string[] }> }).hypotheses;
      assert.equal(hypotheses?.length, 2);
      assert.ok(hypotheses?.every((item) => item.assessment === "WEAKLY_SUPPORTED" && item.supportingEvidenceIds.length > 0 && item.contradictingEvidenceIds.length > 0));
      assert.ok(hypotheses?.every((item) => item.transitions.includes("PROPOSED") && item.transitions.includes("UNDER_TEST") && item.transitions.includes(item.assessment)));
      assert.ok(trace.stages.some((stage) => stage.stageType === "HYPOTHESIS_ASSESSMENT"));
      assert.ok(sent.includes("approved launch date is 2028"));
      assert.ok(sent.includes("approved launch date is not 2028"));
      assert.equal(sent.includes(`TENANTB-${suffix}`), false);
      assert.equal(sent.includes("Restart the gateway"), false);
      const assertions = { baselineLeavesCompetingExplanationsUnassessed: baseline.outputText.includes("conflict-unresolved"), competingHypothesesTested: hypotheses?.length === 2 && hypotheses.every((item) => item.transitions.includes("UNDER_TEST")), supportAndCounterEvidenceUsed: hypotheses?.every((item) => item.supportingEvidenceIds.length > 0 && item.contradictingEvidenceIds.length > 0) === true, discriminatingRetrievalUsed: metadata?.queryTypes?.includes("DISCRIMINATING_EVIDENCE") === true || metadata?.queryTypes?.includes("HYPOTHESIS_COUNTER") === true, uncertaintyRetainedForRealConflict: trace.uncertainty === "HIGH_UNCERTAINTY" };
      emitAcceptanceRecord({ id: "K", model, baselineSummary: baseline.outputText, baselineAssertions: { objectiveResultUnresolvedAsExpected: baseline.outputText.includes("conflict-unresolved") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: result.outputText, oicAssertions: assertions, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: runSummary.toolCalls ?? runSummary.cognitiveKernel?.budget?.used?.toolCalls ?? "UNKNOWN", candidateCount: runSummary.candidateCount ?? runSummary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: runSummary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: runSummary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: runSummary.revisions ?? "UNKNOWN", backtracks: runSummary.cognitiveSearch?.usage?.backtracks ?? runSummary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: runSummary.cacheHits ?? "UNKNOWN", cacheMisses: runSummary.cacheMisses ?? "UNKNOWN", stopReason: runSummary.stopReason ?? "UNKNOWN" } });
      emitAcceptanceRecord({ id: "H", model, baselineSummary: baseline.outputText, baselineAssertions: { baselineConflictNotEvaluated: baseline.outputText.includes("conflict-unresolved") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: result.outputText, oicAssertions: { conflictPresentInGraph: (graph?.summary.conflictCount ?? 0) > 0, conflictRemainsUnresolved: graph?.conflicts.every((conflict) => conflict.unresolved) === true, highUncertaintyRetained: trace.uncertainty === "HIGH_UNCERTAINTY" }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: runSummary.toolCalls ?? "UNKNOWN", candidateCount: runSummary.candidateCount ?? runSummary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: runSummary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: runSummary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: runSummary.revisions ?? "UNKNOWN", backtracks: runSummary.cognitiveSearch?.usage?.backtracks ?? runSummary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: runSummary.cacheHits ?? "UNKNOWN", cacheMisses: runSummary.cacheMisses ?? "UNKNOWN", stopReason: runSummary.stopReason ?? "UNKNOWN" } });
    });

    await t.test("current retrieved evidence supersedes a selected stale memory through verification", async () => {
      fixture.mode = "success";
      const tenant = await db.oicTenant.findUniqueOrThrow({ where: { id: tenantAId! } });
      const actorA = { ...actor, tenantIds: [tenant.id] };
      const memory = await db.oicIntelligenceMemory.create({ data: {
        applicationId: app.id, tenantId: tenant.id, actorPrincipalId: actor.id, kind: "SEMANTIC", lifecycle: "ACTIVE", sensitivity: "INTERNAL",
        title: "Deployment configuration", content: "Configuration A is active.", sourceType: `supersession-${suffix}`, sourceRef: `memory-${suffix}`,
        confidence: 70, salience: 75, updatedAt: new Date(Date.now() - 60_000), lastConfirmedAt: new Date(Date.now() - 60_000)
      } });
      const current = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: tenant.id, sourceKey: `supersession-${suffix}`, sourceRef: `runbook-${suffix}`,
        title: "Deployment configuration", content: "Configuration B is active, replacing A.", authority: 95, sourcePriority: 95,
        publishedAt: new Date(Date.now() + 5_000)
      } });
      const request = { model, tenant: { kind: "id" as const, tenantId: tenant.id }, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Using the stored fact and current runbook, determine whether configuration A is active or configuration B is active; check for conflicting or superseded evidence and cite the source." }] }] };
      fixture.responseTexts = [`Configuration B is active according to the current runbook [EVIDENCE ${current.id}].`];
      const identity = { requestId: `supersession-${suffix}`, traceId: `supersession-trace-${suffix}` };
      const context = await contextResolver.resolve(actorA, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 90, retrievalIntensity: 100, reasoningIntensity: 100, verificationIntensity: 90, synthesisIntensity: 80, maxMemoryItems: 8, maxRetrievalQueries: 8, maxProviderCalls: 8, maxStages: 20, maxCandidates: 3, maxVerificationRounds: 1, allowRevision: false } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { verificationStatus: true, uncertainty: true, summary: true, stages: { select: { stageType: true, metadata: true } } } });
      const summary = trace.summary as { evidenceGraph?: { edges: Array<{ from: string; to: string; relation: string }>; conflicts: Array<{ evidenceIds: string[]; unresolved: boolean }> }; epistemicState?: { facts: Array<{ evidenceId: string; status: string }> }; hypotheses?: Array<{ assessment: string }>; memorySelection?: Array<{ id: string }>; memoryUtility?: Array<{ memoryId: string; signals: string[]; evidenceRefs: string[] }>; cognitiveKernel?: { stopReason: string } };
      assert.ok(summary.memorySelection?.some((item) => item.id === memory.id));
      assert.ok(trace.stages.some((stage) => stage.stageType === "RETRIEVAL"));
      assert.ok(summary.evidenceGraph?.edges.some((edge) => edge.from === current.id && edge.to === memory.id && edge.relation === "SUPERSEDES"));
      assert.ok(summary.evidenceGraph?.conflicts.some((conflict) => conflict.evidenceIds.includes(memory.id) && conflict.unresolved === false));
      assert.equal(summary.epistemicState?.facts.find((fact) => fact.evidenceId === memory.id)?.status, "SUPERSEDED");
      assert.equal(summary.epistemicState?.facts.find((fact) => fact.evidenceId === current.id)?.status, "SUPPORTED");
      assert.ok(summary.hypotheses?.some((item) => item.assessment === "SUPPORTED"));
      assert.ok(summary.hypotheses?.some((item) => item.assessment === "CONTRADICTED"));
      assert.ok(summary.memoryUtility?.find((item) => item.memoryId === memory.id)?.signals.includes("CONFLICTED_WITH_EVIDENCE"));
      assert.ok(summary.memoryUtility?.find((item) => item.memoryId === memory.id)?.evidenceRefs.includes(current.id));
      assert.ok(["PASS", "PASS_WITH_WARNINGS"].includes(trace.verificationStatus));
      assert.notEqual(summary.cognitiveKernel?.stopReason, "UNRESOLVED_UNCERTAINTY");
    });

    await t.test("active research resolves a production-release dependency gap and stops after verification", async () => {
      fixture.mode = "success";
      const tenant = await db.oicTenant.findUniqueOrThrow({ where: { id: tenantAId! } });
      const runbook = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: tenant.id, sourceKey: `dependency-${suffix}`, sourceRef: `release-runbook-${suffix}`,
        title: "Production release dependency", content: "A completed security approval is required before any production release.", authority: 98, sourcePriority: 98,
        publishedAt: new Date(Date.now() + 10_000)
      } });
      const request = { model, tenant: { kind: "id" as const, tenantId: tenant.id }, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Determine whether production release can occur before security approval. Identify the dependency and cite the current runbook." }] }] };
      const expected = `Production release must wait for completed security approval [EVIDENCE ${runbook.id}].`;
      fixture.responseTexts = [expected, expected, expected, expected];
      const identity = { requestId: `dependency-gap-${suffix}`, traceId: `dependency-gap-trace-${suffix}` };
      const context = await contextResolver.resolve({ ...actor, tenantIds: [tenant.id] }, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `dependency-gap-baseline-${suffix}`, traceId: `dependency-gap-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve({ ...actor, tenantIds: [tenant.id] }, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_RELEASE_RESULT=unknown"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = [expected, expected, expected, expected];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 100, reasoningIntensity: 100, verificationIntensity: 90, synthesisIntensity: 70, maxRetrievalQueries: 6, maxProviderCalls: 4, maxStages: 14, maxCandidates: 1, maxContextTokens: 12_000, requireEvidence: true, allowRevision: false } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { verificationStatus: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { select: { stageType: true } } } });
      const summary = trace.summary as { evidenceCoverage?: { summary?: { overall?: string }; items?: Array<{ status: string; evidenceIds: string[] }> }; claimEvidence?: { claims: Array<{ status: string; evidenceIds: string[] }> }; cognitiveKernel?: { actions: Array<{ action: string }>; stopReason: string } };
      assert.equal(result.outputText, expected);
      assert.ok(trace.retrievalQueryCount > 0);
      assert.ok(trace.stages.some((stage) => stage.stageType === "RETRIEVAL"));
      assert.ok(summary.claimEvidence?.claims.some((claim) => claim.status === "SUPPORTED" && claim.evidenceIds.includes(runbook.id)));
      assert.ok(summary.evidenceCoverage?.items?.some((item) => item.evidenceIds.includes(runbook.id)));
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "RETRIEVE"));
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "STOP"));
      assert.ok(["PASS", "PASS_WITH_WARNINGS"].includes(trace.verificationStatus));
      assert.ok(trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls);
      assert.notEqual(summary.cognitiveKernel?.stopReason, "UNRESOLVED_UNCERTAINTY");
      emitAcceptanceRecord({ id: "D", model, baselineSummary: baseline.outputText, baselineAssertions: { directBaselineUnknown: baseline.outputText.includes("unknown") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "ADVANCED", oicSummary: result.outputText, oicAssertions: { retrievalFoundScopedRunbook: summary.claimEvidence?.claims.some((claim) => claim.status === "SUPPORTED" && claim.evidenceIds.includes(runbook.id)) === true, evidenceCoverageIncludesRunbook: summary.evidenceCoverage?.items?.some((item) => item.evidenceIds.includes(runbook.id)) === true, verificationPassed: ["PASS", "PASS_WITH_WARNINGS"].includes(trace.verificationStatus), objectiveCompletion: result.outputText === expected && summary.cognitiveKernel?.stopReason !== "UNRESOLVED_UNCERTAINTY" }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: "UNKNOWN", searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: summary.cognitiveKernel?.stopReason ?? "UNKNOWN" } });
    });

    await t.test("knowledge and memory CRUD preserve scope, hide sensitive content, and audit lifecycle changes", async () => {
      const data = new IntelligenceDataService(db);
      const operator = { ...actor, scopes: [...actor.scopes, "oic:models:read", "oic:models:manage"], tenantIds: [tenantAId!] };
      const audit = { requestId: `data-${suffix}`, traceId: `data-trace-${suffix}` };
      await assert.rejects(data.createKnowledge(operator, { tenantId: tenantBId!, sourceKey: `crud-${suffix.toLowerCase()}`, sourceRef: `cross-${suffix}`, title: "Cross tenant", content: "Should be refused.", authority: 50, sourcePriority: 50 }, audit));
      const knowledge = await data.createKnowledge(operator, { tenantId: tenantAId!, sourceKey: `crud-${suffix.toLowerCase()}`, sourceRef: `item-${suffix}`, title: "Scoped knowledge", content: "Knowledge content is inspected only when requested.", authority: 70, sourcePriority: 60 }, audit);
      assert.equal("content" in (await data.listKnowledge(operator, { tenantId: tenantAId! }))[0]!, false);
      assert.equal((await data.inspectKnowledge(operator, knowledge.id)).content, "Knowledge content is inspected only when requested.");
      const foreignApplication = await db.oicApplication.create({ data: { key: `XF${suffix}`, displayName: "Foreign Knowledge Isolation" } });
      foreignApplicationId = foreignApplication.id;
      const foreignKnowledge = await db.oicIntelligenceKnowledge.create({ data: { applicationId: foreignApplication.id, tenantId: null, sourceKey: `foreign-${suffix.toLowerCase()}`, sourceRef: `foreign-${suffix}`, title: "Foreign application knowledge", content: "This application-private evidence must remain inaccessible.", authority: 100, sourcePriority: 100 } });
      assert.equal((await data.listKnowledge(operator, { tenantId: tenantAId! })).some((item) => item.id === foreignKnowledge.id), false);
      await assert.rejects(data.inspectKnowledge(operator, foreignKnowledge.id));
      const dependentOnForeign = await data.createKnowledge(operator, { tenantId: tenantAId!, sourceKey: `dependent-${suffix.toLowerCase()}`, sourceRef: `dependent-${suffix}`, title: "Scoped dependent source", content: "This approved item references a prerequisite outside this application.", dependsOn: [{ sourceKey: foreignKnowledge.sourceKey, sourceRef: foreignKnowledge.sourceRef }], authority: 90, sourcePriority: 90 }, audit);
      fixture.mode = "success"; fixture.responseTexts = ["The in-scope dependency is not available."];
      const scopeRequest = { model, tenant: { kind: "id" as const, tenantId: tenantAId! }, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "According to the scoped dependent source, inspect the prerequisite and explain the current setting." }] }] };
      const scopeIdentity = { requestId: `cross-app-evidence-${suffix}`, traceId: `cross-app-evidence-trace-${suffix}` };
      const scopeContext = await contextResolver.resolve(operator, scopeRequest, scopeIdentity);
      const scopeModel = await resolver.resolve(model, scopeContext); assert.ok(scopeModel);
      const scopedRuntime = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      await scopedRuntime.execute({ ...scopeModel, intelligenceProfile: { ...scopeModel.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 90, reasoningIntensity: 70, verificationIntensity: 70, maxRetrievalQueries: 4, maxProviderCalls: 3, maxStages: 10 } }, scopeRequest, scopeContext, AbortSignal.timeout(10_000));
      const scopeTrace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: scopeIdentity.traceId }, select: { summary: true } });
      const scopeGraph = (scopeTrace.summary as { evidenceGraph?: { nodes: Array<{ id: string }>; edges: Array<{ from: string; to: string }> } }).evidenceGraph;
      assert.ok(scopeGraph);
      assert.equal(scopeGraph.nodes.some((node) => node.id === foreignKnowledge.id), false);
      assert.equal(scopeGraph.edges.some((edge) => edge.from === foreignKnowledge.id || edge.to === foreignKnowledge.id), false);
      assert.equal(fixture.captured.at(-1)?.body.includes("This application-private evidence must remain inaccessible."), false);
      assert.equal(dependentOnForeign.applicationId, app.id);
      await data.updateKnowledge(operator, knowledge.id, { lifecycle: "DISABLED" }, audit);
      const memory = await data.createMemory(operator, { tenantId: tenantAId!, kind: "SEMANTIC", sensitivity: "SENSITIVE", title: "Sensitive note", content: "Sensitive memory body remains hidden.", sourceType: `crud-${suffix.toLowerCase()}`, confidence: 70, salience: 70 }, audit);
      assert.equal(memory.content, "[content omitted from creation response]");
      assert.equal((await data.inspectMemory(operator, memory.id)).content, "[sensitive memory content is hidden]");
      const otherPrincipal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `actor-${suffix.toLowerCase()}`, displayName: "Other memory actor" } });
      const otherActor: AuthenticatedPrincipal = { ...operator, id: otherPrincipal.id };
      const actorAudit = { requestId: `actor-memory-${suffix}`, traceId: `actor-memory-trace-${suffix}` };
      await assert.rejects(data.createMemory(operator, { tenantId: tenantAId!, kind: "SESSION", sensitivity: "INTERNAL", title: "Actor scoped memory", content: "Visible only to its owning actor.", sourceType: `actor-${suffix.toLowerCase()}`, sessionId: `session-${suffix.toLowerCase()}`, confidence: 70, salience: 70 }, actorAudit));
      const actorMemory = await db.oicIntelligenceMemory.create({ data: { applicationId: app.id, tenantId: tenantAId!, actorPrincipalId: operator.id, sessionId: `session-${suffix.toLowerCase()}`, kind: "SESSION", lifecycle: "ACTIVE", sensitivity: "INTERNAL", title: "Actor scoped memory", content: "Visible only to its owning actor.", embedding: [], sourceType: `actor-${suffix.toLowerCase()}`, confidence: 70, salience: 70 } });
      await assert.rejects(data.createMemory(operator, { tenantId: tenantAId!, kind: "SEMANTIC", sensitivity: "INTERNAL", title: "Mis-tagged session memory", content: "A session identifier cannot broaden shared-memory visibility.", sourceType: `actor-${suffix.toLowerCase()}`, sessionId: `session-${suffix.toLowerCase()}`, confidence: 70, salience: 70 }, actorAudit));
      assert.equal((await data.listMemory(otherActor, { tenantId: tenantAId!, kind: "SESSION" })).some((row) => row.id === actorMemory.id), false);
      assert.equal((await data.listMemory(operator, { tenantId: tenantAId! })).some((row) => row.id === actorMemory.id), false);
      assert.equal((await data.listMemory(operator, { tenantId: tenantAId!, kind: "SESSION" })).some((row) => row.id === actorMemory.id), false);
      await assert.rejects(data.inspectMemory(operator, actorMemory.id));
      await assert.rejects(data.updateMemory(operator, actorMemory.id, { lifecycle: "ARCHIVED" }, actorAudit));
      await assert.rejects(data.inspectMemory(otherActor, actorMemory.id));
      await assert.rejects(data.updateMemory(otherActor, actorMemory.id, { lifecycle: "ARCHIVED" }, actorAudit));
      await db.oicIntelligenceMemory.update({ where: { id: actorMemory.id }, data: { lifecycle: "ARCHIVED", archivedAt: new Date() } });
      const sharedMemory = await data.createMemory(operator, { tenantId: tenantAId!, kind: "SEMANTIC", sensitivity: "INTERNAL", title: "Tenant shared memory", content: "Shared records are available within their authorized scope.", sourceType: `shared-${suffix.toLowerCase()}`, confidence: 70, salience: 70 }, actorAudit);
      assert.equal((await data.inspectMemory(otherActor, sharedMemory.id)).content, "Shared records are available within their authorized scope.");
      await data.updateMemory(otherActor, sharedMemory.id, { lifecycle: "STALE" }, actorAudit);
      await data.updateMemory(operator, sharedMemory.id, { lifecycle: "ARCHIVED" }, actorAudit);
      const bothTenantOperator: AuthenticatedPrincipal = { ...operator, tenantIds: [tenantAId!, tenantBId!] };
      const otherTenantMemory = await data.createMemory(bothTenantOperator, { tenantId: tenantBId!, kind: "SEMANTIC", sensitivity: "INTERNAL", title: "Other tenant memory", content: "Must not cross a tenant boundary.", sourceType: `tenant-${suffix.toLowerCase()}`, confidence: 70, salience: 70 }, actorAudit);
      await assert.rejects(data.inspectMemory(operator, otherTenantMemory.id));
      await assert.rejects(data.updateMemory(operator, otherTenantMemory.id, { lifecycle: "ARCHIVED" }, actorAudit));
      await data.updateMemory(bothTenantOperator, otherTenantMemory.id, { lifecycle: "ARCHIVED" }, actorAudit);
      const differentApplicationActor: AuthenticatedPrincipal = { ...operator, applicationId: randomUUID() };
      await assert.rejects(data.inspectMemory(differentApplicationActor, memory.id));
      await assert.rejects(data.updateMemory(differentApplicationActor, memory.id, { lifecycle: "ARCHIVED" }, actorAudit));
      await data.updateMemory(operator, memory.id, { lifecycle: "ARCHIVED" }, audit);
      const auditRows = await db.oicAuditEvent.findMany({ where: { applicationId: app.id, requestId: audit.requestId }, select: { action: true, targetId: true } });
      assert.deepEqual(auditRows.map((row) => row.action).sort(), ["intelligence.knowledge.created", "intelligence.knowledge.created", "intelligence.knowledge.updated", "intelligence.memory.created", "intelligence.memory.lifecycle.changed"].sort());
      assert.ok(auditRows.some((row) => row.targetId === knowledge.id));
      assert.ok(auditRows.some((row) => row.targetId === memory.id));
    });

    await t.test("production retrieval isolates normal, counter, discriminating, and information-gain expansion across tenant and application scope", async () => {
      fixture.mode = "success";
      const tenantA = await db.oicTenant.findUniqueOrThrow({ where: { id: tenantAId! } });
      const tenantB = await db.oicTenant.findUniqueOrThrow({ where: { id: tenantBId! } });
      const actorA = { ...actor, tenantIds: [tenantA.id] };
      const foreignApp = foreignApplicationId!;
      const queryModes = [
        { mode: "NORMAL" as const, text: (topic: string) => `According to the approved source, find the deployment strategy for ${topic}. Cite the evidence.` , expectedType: "NORMALIZED_QUERY" },
        { mode: "COUNTER_EVIDENCE" as const, text: (topic: string) => `Determine whether ${topic} uses cedar or ${topic} uses quartz; actively seek counter-evidence and cite approved records.`, expectedType: "HYPOTHESIS_COUNTER" },
        { mode: "DISCRIMINATING" as const, text: (topic: string) => `Determine whether ${topic} uses cedar or ${topic} uses quartz; identify the most discriminating evidence between them and cite approved records.`, expectedType: "DISCRIMINATING_EVIDENCE" },
        { mode: "INFORMATION_GAIN" as const, text: (topic: string) => `Determine whether ${topic} uses cedar or ${topic} uses quartz; select the evidence with highest information gain to reduce uncertainty and cite approved records.`, expectedType: "INFORMATION_GAIN" }
      ];
      const rows: Array<{ mode: string; boundary: string; status: string; testRef: string }> = [];
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      for (const scenario of queryModes) {
        const topic = `orion-${scenario.mode.toLocaleLowerCase()}-${suffix}`;
        const appSourceKey = `mode-${scenario.mode.toLocaleLowerCase()}-${suffix}`;
        const tenantSourceKey = `${appSourceKey}-tenant`;
        const appForeign = await db.oicIntelligenceKnowledge.create({ data: { applicationId: foreignApp, tenantId: null, sourceKey: appSourceKey, sourceRef: `${appSourceKey}-foreign-app`, title: `${topic} deployment strategy`, content: `APP_SCOPE_CANARY_${scenario.mode}_${suffix}: ${topic} uses quartz deployment strategy.`, authority: 100, sourcePriority: 100 } });
        const tenantForeign = await db.oicIntelligenceKnowledge.create({ data: { applicationId: app.id, tenantId: tenantB.id, sourceKey: tenantSourceKey, sourceRef: `${tenantSourceKey}-foreign-tenant`, title: `${topic} deployment strategy`, content: `TENANT_SCOPE_CANARY_${scenario.mode}_${suffix}: ${topic} uses quartz deployment strategy.`, dependsOn: [{ sourceKey: appSourceKey, sourceRef: `${appSourceKey}-foreign-app` }], authority: 100, sourcePriority: 100 } });
        const authorized = await db.oicIntelligenceKnowledge.create({ data: { applicationId: app.id, tenantId: tenantA.id, sourceKey: tenantSourceKey, sourceRef: `${tenantSourceKey}-authorized`, title: `${topic} deployment strategy`, content: `AUTHORIZED_SCOPE_${scenario.mode}_${suffix}: ${topic} uses quartz deployment strategy.`, dependsOn: [{ sourceKey: tenantSourceKey, sourceRef: `${tenantSourceKey}-foreign-tenant` }], authority: 80, sourcePriority: 80 } });
        const detail = scenario.mode === "NORMAL"
          ? "List the publication date; report the source name; identify the document title; state the approved setting; cite the evidence reference."
          : "Analyze provenance; compare publication freshness; evaluate conflicting interpretations and operational risk; explain what record would resolve uncertainty; verify the approved conclusion against the scoped source.";
        const request = { model, tenant: { kind: "id" as const, tenantId: tenantA.id }, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: `${scenario.text(topic)} ${detail}` }] }] };
        const identity = { requestId: `retrieval-isolation-${scenario.mode}-${suffix}`, traceId: `retrieval-isolation-trace-${scenario.mode}-${suffix}` };
        const context = await contextResolver.resolve(actorA, request, identity);
        const resolved = await resolver.resolve(model, context); assert.ok(resolved);
        const profile = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 100, reasoningIntensity: 100, verificationIntensity: 65, synthesisIntensity: 40, maxRetrievalQueries: 8, maxProviderCalls: 2, maxStages: 16, maxCandidates: 1, maxContextTokens: 12_000, allowRevision: false, requireEvidence: true } };
        fixture.responseTexts = ["scope-checked completion", "scope-checked completion"];
        const capturedStart = fixture.captured.length;
        await engine.execute(profile, request, context, AbortSignal.timeout(10_000));
        const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { summary: true, stages: { select: { stageType: true, metadata: true } } } });
        const summary = trace.summary as { evidenceGraph?: { nodes: Array<{ id: string }> } };
        const retrieval = trace.stages.find((stage) => stage.stageType === "RETRIEVAL");
        const metadata = retrieval?.metadata as { queryTypes?: string[]; candidateCount?: number; dependencyEvidenceCount?: number } | undefined;
        const sent = fixture.captured.slice(capturedStart).map((item) => item.body).join("\n");
        const evidenceIds = new Set(summary.evidenceGraph?.nodes.map((node) => node.id) ?? []);
        assert.ok(metadata?.queryTypes?.includes(scenario.expectedType), `${scenario.mode} query intent must execute in the production runtime retriever: ${JSON.stringify({ metadata, stages: trace.stages.map((item) => item.stageType) })}`);
        assert.ok(evidenceIds.has(authorized.id), `${scenario.mode} must retrieve the authorized same-app/same-tenant evidence`);
        assert.equal(evidenceIds.has(tenantForeign.id), false, `${scenario.mode} must exclude another tenant, including a referenced dependency`);
        assert.equal(evidenceIds.has(appForeign.id), false, `${scenario.mode} must exclude another application, including a transitive dependency`);
        assert.ok(sent.includes(`AUTHORIZED_SCOPE_${scenario.mode}_${suffix}`));
        assert.equal(sent.includes(`TENANT_SCOPE_CANARY_${scenario.mode}_${suffix}`), false);
        assert.equal(sent.includes(`APP_SCOPE_CANARY_${scenario.mode}_${suffix}`), false);
        rows.push({ mode: scenario.mode, boundary: "same app/same tenant", status: "PASS: authorized evidence selected", testRef: "provider-runtime.e2e.acceptance.test.ts production IntelligenceRuntimeExecutor" });
        rows.push({ mode: scenario.mode, boundary: "different tenant", status: "PASS: foreign evidence and dependency excluded", testRef: "provider-runtime.e2e.acceptance.test.ts production IntelligenceRuntimeExecutor" });
        rows.push({ mode: scenario.mode, boundary: "different application", status: "PASS: foreign evidence and transitive dependency excluded", testRef: "provider-runtime.e2e.acceptance.test.ts production IntelligenceRuntimeExecutor" });
      }
      assert.equal(rows.length, 12);
      if (process.env.OIC_ACCEPTANCE_CLOSURE === "1") console.log(JSON.stringify({ acceptance: "OIC5_RETRIEVAL_ISOLATION", rows }));
    });

    await t.test("OIC local calculator is permission-gated, invoked, and reintegrated into model context", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["76"];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Calculate 19 * 4." }] }] };
      const identity = { requestId: `tool-${suffix}`, traceId: `tool-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `tool-baseline-${suffix}`, traceId: `tool-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_CALCULATION_RESULT=unverified"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["76"];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, toolsIntensity: 80, maxToolCalls: 1, verificationIntensity: 80, maxStages: 8 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { select: { stageType: true } } } });
      assert.equal(result.outputText, "76");
      assert.ok(trace.stages.some((stage) => stage.stageType === "TOOL_EXECUTION"));
      assert.ok(trace.stages.some((stage) => stage.stageType === "VERIFICATION"));
      assert.equal((trace.summary as { toolCalls: number }).toolCalls, 1);
      assert.equal((trace.summary as { stopReason: string }).stopReason, "SUCCESS");
      assert.ok(fixture.captured.at(-1)?.body.includes("19*4 = 76"));
      const summary = trace.summary as { toolCalls: number; candidateCount?: number; revisions?: number; cacheHits?: number; cacheMisses?: number; stopReason: string; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number }; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } } };
      emitAcceptanceRecord({ id: "E", model, baselineSummary: baseline.outputText, baselineAssertions: { directBaselineUnverified: baseline.outputText.includes("unverified") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "ADVANCED", oicSummary: result.outputText, oicAssertions: { registeredCalculatorUsed: fixture.captured.at(-1)?.body.includes("19*4 = 76") === true, deterministicAnswer: result.outputText === "76", verifierPassed: trace.stages.some((stage) => stage.stageType === "VERIFICATION") && summary.stopReason === "SUCCESS" }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: summary.toolCalls, candidateCount: summary.candidateCount ?? summary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: summary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: summary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: summary.revisions ?? "UNKNOWN", backtracks: summary.cognitiveSearch?.usage?.backtracks ?? summary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: summary.cacheHits ?? "UNKNOWN", cacheMisses: summary.cacheMisses ?? "UNKNOWN", stopReason: summary.stopReason } });
    });

    await t.test("failed deterministic tool use replans, returns safely, and preserves uncertainty", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["The calculation tool failed, so the result remains unverified."];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Calculate 9 / 0." }] }] };
      const identity = { requestId: `tool-failure-${suffix}`, traceId: `tool-failure-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `tool-failure-baseline-${suffix}`, traceId: `tool-failure-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_TOOL_RESULT=unverified"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["The calculation tool failed, so the result remains unverified."];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 60, toolsIntensity: 80, verificationIntensity: 60, maxToolCalls: 1, maxProviderCalls: 2, maxStages: 10, maxRetrievalQueries: 0, maxMemoryItems: 0 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { uncertainty: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { select: { stageType: true, metadata: true } } } });
      const summary = trace.summary as { toolCalls: number; stopReason?: string; cacheHits?: number; cacheMisses?: number; revisions?: number; cognitiveKernel?: { actions: Array<{ action: string; strategy?: string; reason?: string; fromStrategy?: string }>; controllerTransitions?: Array<{ from: string; to: string; action: string; reason: string }> }; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } }; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number } };
      const failedTool = trace.stages.find((stage) => stage.stageType === "TOOL_EXECUTION");
      const metadata = failedTool?.metadata as { outcome?: string; failureCode?: string } | undefined;
      assert.equal(result.outputText, "The calculation tool failed, so the result remains unverified.");
      assert.equal(metadata?.outcome, "FAILED");
      assert.equal(metadata?.failureCode, "calculator_division_by_zero");
      assert.equal(summary.toolCalls, 1);
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "REPLAN"));
      assert.equal(trace.uncertainty, "HIGH_UNCERTAINTY");
      assert.ok(trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls);
      const replan = summary.cognitiveKernel?.controllerTransitions?.find((item) => item.action === "REPLAN");
      const assertions = { baselineDoesNotUseToolController: baseline.outputText.includes("BASELINE_TOOL_RESULT=unverified"), deterministicToolFailureObserved: metadata?.outcome === "FAILED" && metadata.failureCode === "calculator_division_by_zero", controllerReplanned: Boolean(replan?.from && replan.to && replan.reason), uncertaintyPreserved: trace.uncertainty === "HIGH_UNCERTAINTY", boundedResourceCost: trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls && summary.toolCalls <= profiled.intelligenceProfile.maxToolCalls };
      emitAcceptanceRecord({ id: "N", model, baselineSummary: baseline.outputText, baselineAssertions: { directBaselineExecuted: baseline.outputText.includes("BASELINE_TOOL_RESULT=unverified") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "ADVANCED", oicSummary: result.outputText, oicAssertions: assertions, traceId: identity.traceId, requestId: identity.requestId, strategyTransitions: replan ? [{ from: replan.from, to: replan.to, action: replan.action, reason: replan.reason }] : [], oic: { providerCalls: trace.providerCallCount, retrievalRounds: "UNKNOWN", memoryReads: "UNKNOWN", memoryWrites: "UNKNOWN", toolCalls: summary.toolCalls, candidateCount: summary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: summary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: summary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: summary.revisions ?? "UNKNOWN", backtracks: summary.cognitiveSearch?.usage?.backtracks ?? summary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: summary.cacheHits ?? "UNKNOWN", cacheMisses: summary.cacheMisses ?? "UNKNOWN", stopReason: summary.stopReason ?? "UNKNOWN" } });
    });

    await t.test("reasoning selects the registered unit converter and reuses its scoped deterministic cache", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["BASELINE_UNIT_RESULT=unverified", "5000", "5000"];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Convert 5 km to m." }] }] };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const resolvedByContext = async (suffixKey: string) => {
        const identity = { requestId: `unit-${suffix}-${suffixKey}`, traceId: `unit-trace-${suffix}-${suffixKey}` };
        const context = await contextResolver.resolve(actor, request, identity);
        const resolved = await resolver.resolve(model, context); assert.ok(resolved);
        return { context, identity, resolved: { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, toolsIntensity: 80, maxToolCalls: 1, verificationIntensity: 80, maxStages: 8 } } };
      };
      const baselineRun = await resolvedByContext("baseline");
      const baseline = await executor.execute(baselineRun.resolved, request, baselineRun.context, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["5000", "5000"];
      const first = await resolvedByContext("first");
      const firstOutput = await engine.execute(first.resolved, request, first.context, AbortSignal.timeout(10_000));
      const second = await resolvedByContext("second");
      const secondOutput = await engine.execute(second.resolved, request, second.context, AbortSignal.timeout(10_000));
      assert.equal(firstOutput.outputText, "5000");
      assert.equal(secondOutput.outputText, "5000");
      const firstTrace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: first.identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { where: { stageType: "TOOL_EXECUTION" }, select: { metadata: true } } } });
      const secondTrace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: second.identity.traceId }, select: { summary: true, stages: { where: { stageType: "TOOL_EXECUTION" }, select: { metadata: true } } } });
      assert.equal((firstTrace.stages[0]?.metadata as { tool?: string }).tool, "oic.unit-converter");
      assert.equal((firstTrace.summary as { toolCalls: number; cacheMisses: number }).toolCalls, 1);
      assert.equal((firstTrace.summary as { cacheMisses: number }).cacheMisses, 1);
      assert.equal((secondTrace.stages[0]?.metadata as { cache?: string }).cache, "HIT");
      assert.equal((secondTrace.summary as { toolCalls: number; cacheHits: number }).toolCalls, 0);
      assert.ok((secondTrace.summary as { cacheHits: number }).cacheHits >= 1);
      assert.ok(fixture.captured.slice(-2).every((call) => call.body.includes("5 km = 5000 m")));
      const firstSummary = firstTrace.summary as { toolCalls: number; candidateCount?: number; revisions?: number; cacheHits: number; cacheMisses: number; stopReason?: string; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number }; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } } };
      emitAcceptanceRecord({ id: "O", model, baselineSummary: baseline.outputText, baselineAssertions: { directExecutionCompleted: baseline.outputText.includes("unverified") }, baseline: baselineMetrics(), baselineRequestId: baselineRun.identity.requestId, profile: "ADVANCED_TOOL_CACHE", oicSummary: firstOutput.outputText, oicAssertions: { initialCacheMiss: firstSummary.cacheMisses === 1 && (firstTrace.stages[0]?.metadata as { cache?: string }).cache !== "HIT", subsequentCacheHit: (secondTrace.summary as { cacheHits: number }).cacheHits >= 1 && (secondTrace.stages[0]?.metadata as { cache?: string }).cache === "HIT", sameDeterministicAnswer: firstOutput.outputText === "5000" && secondOutput.outputText === "5000" }, traceId: first.identity.traceId, requestId: first.identity.requestId, additionalTraceIds: [second.identity.traceId], oic: { providerCalls: firstTrace.providerCallCount, retrievalRounds: firstTrace.retrievalQueryCount, memoryReads: firstTrace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: firstSummary.toolCalls, candidateCount: firstSummary.candidateCount ?? firstSummary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: firstSummary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: firstSummary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: firstSummary.revisions ?? "UNKNOWN", backtracks: firstSummary.cognitiveSearch?.usage?.backtracks ?? firstSummary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: firstSummary.cacheHits, cacheMisses: firstSummary.cacheMisses, stopReason: firstSummary.stopReason ?? "UNKNOWN" } });
    });

    await t.test("knowledge dependency changes invalidate the retrieval artifact cache", async () => {
      fixture.mode = "success";
      const knowledge = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: null, sourceKey: `cache-invalidation-${suffix}`, sourceRef: `policy-${suffix}`,
        title: `Cache invalidation policy ${suffix}`, content: `Policy ${suffix}: rollout is blocked pending approval.`, authority: 90, sourcePriority: 90
      } });
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: `According to the current policy ${suffix}, is rollout blocked pending approval? Cite evidence.` }] }] };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const run = async (key: string) => {
        const identity = { requestId: `cache-invalidation-${suffix}-${key}`, traceId: `cache-invalidation-trace-${suffix}-${key}` };
        const context = await contextResolver.resolve(actor, request, identity);
        const resolved = await resolver.resolve(model, context); assert.ok(resolved);
        const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 90, reasoningIntensity: 50, toolsIntensity: 0, verificationIntensity: 60, synthesisIntensity: 30, maxCandidates: 1, maxProviderCalls: 2, maxStages: 10, maxRetrievalQueries: 4, maxMemoryItems: 0, maxContextTokens: 8000, requireEvidence: true, allowRevision: false } };
        await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
        const execution = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { retrievalQueryCount: true, summary: true, stages: { where: { stageType: "RETRIEVAL" }, select: { metadata: true } } } });
        return { identity, execution };
      };
      fixture.responseTexts = ["Rollout is blocked [EVIDENCE invalidated].", "Rollout is approved [EVIDENCE invalidated]."];
      const first = await run("before");
      await db.oicIntelligenceKnowledge.update({ where: { id: knowledge.id }, data: { content: `Policy ${suffix}: rollout is approved after security approval.`, authority: 96, publishedAt: new Date(Date.now() + 15_000), updatedAt: new Date(Date.now() + 15_000) } });
      const second = await run("after");
      const firstMetadata = first.execution.stages[0]?.metadata as { cache?: string } | undefined;
      const secondMetadata = second.execution.stages[0]?.metadata as { cache?: string } | undefined;
      assert.ok(first.execution.retrievalQueryCount > 0 && second.execution.retrievalQueryCount > 0);
      assert.equal(firstMetadata?.cache, "MISS");
      assert.equal(secondMetadata?.cache, "MISS");
      assert.equal((first.execution.summary as { cacheMisses: number }).cacheMisses, 1);
      assert.equal((second.execution.summary as { cacheMisses: number }).cacheMisses, 1);
      knowledgeInvalidationPassed = true;
      knowledgeInvalidationTraceIds = [first.identity.traceId, second.identity.traceId];
    });

    await t.test("memory dependency changes invalidate the retrieval artifact cache", async () => {
      fixture.mode = "success";
      const memory = await db.oicIntelligenceMemory.create({ data: {
        applicationId: app.id, tenantId: null, actorPrincipalId: actor.id, kind: "SEMANTIC", lifecycle: "ACTIVE", sensitivity: "INTERNAL",
        title: `Known release policy ${suffix}`, content: `The known release policy ${suffix} requires owner approval before deployment.`,
        sourceType: `memory-cache-invalidation-${suffix}`, sourceRef: `memory-${suffix}`, confidence: 90, salience: 90, lastConfirmedAt: new Date()
      } });
      const knowledge = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: null, sourceKey: `memory-cache-invalidation-${suffix}`, sourceRef: `policy-${suffix}`,
        title: `Release approval policy ${suffix}`, content: `The current release policy ${suffix} requires owner approval.`, authority: 90, sourcePriority: 90
      } });
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: `What do we know about release policy ${suffix} according to the stored fact and current policy? Cite evidence.` }] }] };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const baselineIdentity = { requestId: `memory-cache-baseline-${suffix}`, traceId: `memory-cache-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      const baselineModel = await resolver.resolve(model, baselineContext); assert.ok(baselineModel);
      fixture.responseTexts = ["BASELINE_MEMORY_CACHE_RESULT=unknown"];
      const baseline = await executor.execute(baselineModel, request, baselineContext, AbortSignal.timeout(10_000));
      const run = async (key: string) => {
        const identity = { requestId: `memory-cache-invalidation-${suffix}-${key}`, traceId: `memory-cache-invalidation-trace-${suffix}-${key}` };
        const context = await contextResolver.resolve(actor, request, identity);
        const resolved = await resolver.resolve(model, context); assert.ok(resolved);
        const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 90, retrievalIntensity: 90, reasoningIntensity: 50, toolsIntensity: 0, verificationIntensity: 60, synthesisIntensity: 30, maxCandidates: 1, maxProviderCalls: 2, maxStages: 10, maxRetrievalQueries: 4, maxMemoryItems: 8, maxContextTokens: 8000, requireEvidence: true, allowRevision: false } };
        const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
        const execution = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { where: { stageType: "RETRIEVAL" }, select: { metadata: true } } } });
        return { identity, result, execution };
      };
      fixture.responseTexts = [`The stored fact and current policy require owner approval [EVIDENCE ${knowledge.id}].`, `The updated stored fact and current policy require security approval [EVIDENCE ${knowledge.id}].`];
      const first = await run("before");
      const changedAt = new Date(Date.now() + 15_000);
      await db.oicIntelligenceMemory.update({ where: { id: memory.id }, data: { content: `The known release policy ${suffix} requires security approval before deployment.`, title: `Updated release policy ${suffix}`, lastConfirmedAt: changedAt, updatedAt: changedAt } });
      const second = await run("after");
      const firstMetadata = first.execution.stages[0]?.metadata as { cache?: string } | undefined;
      const secondMetadata = second.execution.stages[0]?.metadata as { cache?: string } | undefined;
      assert.ok(first.execution.memoryLookupCount > 0 && second.execution.memoryLookupCount > 0);
      assert.equal(firstMetadata?.cache, "MISS");
      assert.equal(secondMetadata?.cache, "MISS");
      assert.equal((first.execution.summary as { cacheMisses: number }).cacheMisses, 1);
      assert.equal((second.execution.summary as { cacheMisses: number }).cacheMisses, 1);
      emitAcceptanceRecord({ id: "P", model, baselineSummary: baseline.outputText, baselineAssertions: { directBaselineExecutedWithoutOicMemory: baseline.outputText.includes("unknown") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: first.result.outputText, oicAssertions: { knowledgeMutationInvalidatesCache: knowledgeInvalidationPassed && knowledgeInvalidationTraceIds.length === 2, memoryMutationInvalidatesCache: firstMetadata?.cache === "MISS" && secondMetadata?.cache === "MISS" && first.execution.memoryLookupCount > 0 && second.execution.memoryLookupCount > 0, updatedScopedFactReturned: first.result.outputText.includes("owner approval") && second.result.outputText.includes("security approval") }, traceId: first.identity.traceId, requestId: first.identity.requestId, additionalTraceIds: [...knowledgeInvalidationTraceIds, second.identity.traceId], oic: { providerCalls: first.execution.providerCallCount, retrievalRounds: first.execution.retrievalQueryCount, memoryReads: first.execution.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: "UNKNOWN", searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: (first.execution.summary as { cacheHits?: number }).cacheHits ?? "UNKNOWN", cacheMisses: (first.execution.summary as { cacheMisses?: number }).cacheMisses ?? "UNKNOWN", stopReason: (first.execution.summary as { stopReason?: string }).stopReason ?? "UNKNOWN" } });
    });

    await t.test("runtime retrieval emits and consumes declared knowledge prerequisites in the shared evidence graph", async () => {
      fixture.mode = "success";
      const sourceKey = `runtime-dependency-${suffix.toLowerCase()}`;
      const prerequisiteRef = `api-endpoint-${suffix.toLowerCase()}`;
      const prerequisite = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: null, sourceKey, sourceRef: prerequisiteRef,
        title: "Release API endpoint", content: "The approved service endpoint is https://api-a.example.test.", authority: 90, sourcePriority: 90
      } });
      const contradiction = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: null, sourceKey, sourceRef: `conflict-${suffix.toLowerCase()}`,
        title: "Release API endpoint", content: "The approved service endpoint is not https://api-a.example.test; use https://api-b.example.test.", authority: 92, sourcePriority: 92
      } });
      const dependent = await db.oicIntelligenceKnowledge.create({ data: {
        applicationId: app.id, tenantId: null, sourceKey, sourceRef: `client-compatibility-${suffix.toLowerCase()}`,
        title: "Client endpoint compatibility", content: "The client must use the endpoint approved for this release.",
        dependsOn: [{ sourceKey, sourceRef: prerequisiteRef }], authority: 95, sourcePriority: 100
      } });
      fixture.responseTexts = [`The client should use the approved release endpoint [EVIDENCE ${dependent.id}].`];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Determine the client endpoint from the approved release compatibility requirement and its prerequisite API endpoint. Cite evidence." }] }] };
      const identity = { requestId: `runtime-evidence-dependency-${suffix}`, traceId: `runtime-evidence-dependency-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 90, reasoningIntensity: 50, verificationIntensity: 80, requireEvidence: true, maxCandidates: 1, maxProviderCalls: 1, maxRetrievalQueries: 5, maxStages: 12 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { verificationStatus: true, summary: true, stages: { where: { stageType: "RETRIEVAL" }, select: { metadata: true } } } });
      const summary = trace.summary as { evidenceGraph?: { edges: Array<{ from: string; to: string; relation: string }>; conflicts: Array<{ evidenceIds: string[]; unresolved: boolean }> }; epistemicState?: { facts: Array<{ evidenceId: string; status: string }> } };
      assert.equal(result.outputText, `The client should use the approved release endpoint [EVIDENCE ${dependent.id}].`);
      assert.ok(summary.evidenceGraph?.edges.some((edge) => edge.from === dependent.id && edge.to === prerequisite.id && edge.relation === "DEPENDS_ON"));
      assert.ok(summary.evidenceGraph?.conflicts.some((conflict) => conflict.unresolved && conflict.evidenceIds.includes(prerequisite.id) && conflict.evidenceIds.includes(contradiction.id)));
      assert.equal(summary.epistemicState?.facts.find((fact) => fact.evidenceId === dependent.id)?.status, "UNVERIFIED");
      assert.ok(((trace.stages[0]?.metadata as { selectedCount?: number }).selectedCount ?? 0) >= 2);
      assert.ok(trace.verificationStatus === "PASS_WITH_WARNINGS" || trace.verificationStatus === "PASS");
      assert.equal(JSON.stringify(summary).includes(dependent.content), false);
    });

    await t.test("deep profile compares independent candidates and synthesizes disagreement within budgets", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["Option A meets the cost constraint.", "Option B meets the reliability constraint.", "Both options meet distinct constraints; reliability remains the deciding risk."];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Analyze the safety constraints. Compare the user impact. Evaluate the cost and latency. Explain the trade-offs. Recommend an option. State the uncertainty." }] }] };
      const identity = { requestId: `deep-${suffix}`, traceId: `deep-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `deep-baseline-${suffix}`, traceId: `deep-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_DEEP_RESULT=single unreviewed answer"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["Option A meets the cost constraint.", "Option B meets the reliability constraint.", "Both options meet distinct constraints; reliability remains the deciding risk."];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 95, toolsIntensity: 0, verificationIntensity: 80, synthesisIntensity: 80, maxCandidates: 2, maxProviderCalls: 4, maxStages: 10 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { select: { stageType: true } } } });
      const summary = trace.summary as { candidateCount: number; candidateNotes: Array<{ strategy: string }>; candidateComparison?: { decision: string; disagreement: boolean; assessments: Array<{ evidenceStatus: string; toolStatus: string; resourceCost: number }> }; critic?: { decision: string; findings: Array<{ code: string }> } };
      assert.equal(result.outputText, "Both options meet distinct constraints; reliability remains the deciding risk.");
      assert.equal(summary.candidateCount, 2);
      assert.equal(summary.candidateNotes.length, 2);
      assert.equal(new Set(summary.candidateNotes.map((item) => item.strategy)).size, 2);
      assert.equal(summary.candidateComparison?.decision, "MERGE");
      assert.equal(summary.candidateComparison?.disagreement, true);
      assert.ok(summary.candidateComparison?.assessments.every((item) => item.resourceCost === 1));
      assert.ok(trace.stages.some((stage) => stage.stageType === "CRITIC"));
      assert.ok(["CONTINUE", "QUALIFY", "REVISE"].includes(summary.critic?.decision ?? ""));
      assert.ok(trace.stages.some((stage) => stage.stageType === "SYNTHESIS"));
      assert.equal(trace.providerCallCount, 3);
      assert.ok(trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls);
      assert.ok(trace.stages.length <= profiled.intelligenceProfile.maxStages);
      emitAcceptanceRecord({ id: "M", model, baselineSummary: baseline.outputText, baselineAssertions: { directSingleAnswerExecuted: baseline.outputText.includes("single unreviewed answer") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "MAX", oicSummary: `${result.outputText}; criticDecision=${summary.critic?.decision ?? "UNKNOWN"}`, oicAssertions: { independentCandidatesCompared: summary.candidateCount === 2 && new Set(summary.candidateNotes.map((item) => item.strategy)).size === 2, disagreementMergedWithinBudget: summary.candidateComparison?.disagreement === true && summary.candidateComparison.decision === "MERGE", supportedCriticDecision: ["CONTINUE", "QUALIFY", "REVISE"].includes(summary.critic?.decision ?? ""), criticAndSynthesisStagesPresent: trace.stages.some((stage) => stage.stageType === "CRITIC") && trace.stages.some((stage) => stage.stageType === "SYNTHESIS") }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: summary.candidateCount, searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: "UNKNOWN" } });
    });

    await t.test("ordered reasoning subtasks wait for dependencies and synthesize completed results", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["condition identified", "result determined", "implications stated", "dependent synthesis complete"];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Identify the source condition, then determine the resulting value, then summarize the result." }] }] };
      const identity = { requestId: `dependency-${suffix}`, traceId: `dependency-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `dependency-baseline-${suffix}`, traceId: `dependency-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ["BASELINE_DEPENDENCY_RESULT=not-ordered"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["condition identified", "result determined", "implications stated", "dependent synthesis complete"];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 75, toolsIntensity: 0, verificationIntensity: 0, synthesisIntensity: 80, maxProviderCalls: 4, maxStages: 10 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const first = fixture.captured.length;
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { stages: { select: { stageType: true } }, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, verificationStatus: true, summary: true } });
      const captured = fixture.captured.slice(first);
      assert.equal(result.outputText, "dependent synthesis complete");
      assert.equal(captured.length, 4);
      assert.ok(captured[1]?.body.includes("condition identified"));
      assert.ok(captured[2]?.body.includes("result determined"));
      assert.equal(trace.stages.filter((stage) => stage.stageType === "REASONING_SUBTASK").length, 3);
      assert.ok(trace.stages.some((stage) => stage.stageType === "SYNTHESIS"));
      assert.equal(trace.providerCallCount, 4);
      const workingMemory = (trace.summary as { workingMemory?: { scope: string; subproblems: Array<{ state: string; resultRef?: string }> } }).workingMemory;
      assert.equal(workingMemory?.scope, "EXECUTION_ONLY");
      assert.equal(workingMemory?.subproblems.length, 3);
      assert.ok(workingMemory?.subproblems.every((item) => item.state === "COMPLETE" && /^[a-f0-9]{16}$/.test(item.resultRef ?? "")));
      assert.equal(JSON.stringify(workingMemory).includes("condition identified"), false);
      const summary = trace.summary as { stopReason?: string; candidateCount?: number; revisions?: number; cacheHits?: number; cacheMisses?: number; toolCalls?: number; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } }; cognitiveSignature?: { verificationRounds?: number; backtracks?: number } };
      const assertions = { baselineDidNotOrderDependencies: baseline.outputText !== "dependent synthesis complete", ACompletedBeforeB: captured[1]?.body.includes("condition identified") === true, BConsumedAResult: captured[2]?.body.includes("result determined") === true, allSubproblemsComplete: workingMemory?.subproblems.every((item) => item.state === "COMPLETE") === true, objectiveCompletion: result.outputText === "dependent synthesis complete" };
      emitAcceptanceRecord({ id: "F", model, baselineSummary: baseline.outputText, baselineAssertions: { dependencyOrderingUnavailable: baseline.outputText.includes("BASELINE_DEPENDENCY_RESULT=not-ordered") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "ADVANCED", oicSummary: result.outputText, oicAssertions: assertions, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: summary.toolCalls ?? "UNKNOWN", candidateCount: summary.candidateCount ?? "UNKNOWN", searchNodes: summary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: summary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: summary.revisions ?? "UNKNOWN", backtracks: summary.cognitiveSearch?.usage?.backtracks ?? summary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: summary.cacheHits ?? "UNKNOWN", cacheMisses: summary.cacheMisses ?? "UNKNOWN", stopReason: summary.stopReason ?? "UNKNOWN" } });
    });

    await t.test("verifier catches a flawed fixture draft and targeted revision corrects valid JSON", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["not json", "{\"result\":\"corrected\"}"];
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Return JSON with the result field set to corrected." }] }] };
      const identity = { requestId: `revision-${suffix}`, traceId: `revision-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const baselineIdentity = { requestId: `revision-baseline-${suffix}`, traceId: `revision-baseline-trace-${suffix}` };
      const baselineContext = await contextResolver.resolve(actor, request, baselineIdentity);
      fixture.responseTexts = ["{invalid JSON"];
      const baseline = await executor.execute(resolved, request, baselineContext, AbortSignal.timeout(10_000));
      fixture.responseTexts = ["not json", "{\"result\":\"corrected\"}"];
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 30, toolsIntensity: 0, verificationIntensity: 80, maxVerificationRounds: 1, allowRevision: true, maxProviderCalls: 2, maxStages: 8 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { verificationStatus: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, summary: true, stages: { select: { stageType: true } } } });
      assert.equal(result.outputText, "{\"result\":\"corrected\"}");
      assert.equal((trace.summary as { revisions: number }).revisions, 1);
      assert.equal(trace.verificationStatus, "PASS");
      assert.ok(trace.stages.some((stage) => stage.stageType === "REVISION"));
      const summary = trace.summary as { toolCalls?: number; candidateCount?: number; revisions?: number; stopReason?: string; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number }; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } } };
      emitAcceptanceRecord({ id: "G", model, baselineSummary: baseline.outputText, baselineAssertions: { invalidDraftReturned: baseline.outputText.includes("invalid JSON") }, baseline: baselineMetrics(), baselineRequestId: baselineIdentity.requestId, profile: "ADVANCED", oicSummary: result.outputText, oicAssertions: { verifierDetectedAndRepaired: result.outputText === "{\"result\":\"corrected\"}" && trace.verificationStatus === "PASS", revisionStageRecorded: trace.stages.some((stage) => stage.stageType === "REVISION"), boundedRepairCount: summary.revisions === 1 }, traceId: identity.traceId, requestId: identity.requestId, oic: { providerCalls: trace.providerCallCount, retrievalRounds: trace.retrievalQueryCount, memoryReads: trace.memoryLookupCount, memoryWrites: "UNKNOWN", toolCalls: summary.toolCalls ?? "UNKNOWN", candidateCount: summary.candidateCount ?? summary.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: summary.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: summary.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: summary.revisions ?? "UNKNOWN", backtracks: summary.cognitiveSearch?.usage?.backtracks ?? summary.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: summary.stopReason ?? "UNKNOWN" } });
    });

    await t.test("repeated failed repair backtracks to its structured checkpoint and records no progress", async () => {
      fixture.mode = "success"; fixture.responseTexts = Array.from({ length: 8 }, () => "not json");
      const request = { model, sessionId: undefined, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Return JSON with required fields: status, cause, and mitigation. Then compare the two incident paths. Analyze the operational risk. Cite evidence and state uncertainty." }] }] };
      const identity = { requestId: `backtrack-${suffix}`, traceId: `backtrack-trace-${suffix}` };
      const context = await contextResolver.resolve(actor, request, identity);
      const resolved = await resolver.resolve(model, context); assert.ok(resolved);
      const profiled = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 70, toolsIntensity: 0, verificationIntensity: 85, synthesisIntensity: 30, allowRevision: true, maxVerificationRounds: 2, maxProviderCalls: 8, maxStages: 24, maxCandidates: 1, maxRetrievalQueries: 0, maxMemoryItems: 0 } };
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const result = await engine.execute(profiled, request, context, AbortSignal.timeout(10_000));
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, summary: true, stages: { select: { stageType: true } } } });
      const summary = trace.summary as { stopReason: string; cognitiveKernel?: { checkpointCount: number; failedPathFingerprints: string[]; actions: Array<{ action: string; reason: string }> } };
      assert.equal(result.outputText, "not json");
      assert.equal(summary.stopReason, "NO_USEFUL_PROGRESS");
      assert.ok(trace.providerCallCount <= profiled.intelligenceProfile.maxProviderCalls);
      assert.ok(trace.stages.some((stage) => stage.stageType === "REVISION"));
      assert.ok((summary.cognitiveKernel?.checkpointCount ?? 0) > 0);
      assert.ok((summary.cognitiveKernel?.failedPathFingerprints.length ?? 0) > 0);
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "BACKTRACK"));
    });

    await t.test("bounded search backtracks from a contradicted hypothesis and completes the evidence-supported alternate path", async () => {
      fixture.mode = "success";
      const isolatedApplication = await db.oicApplication.create({ data: { key: `BT${suffix}`, displayName: "Backtrack Acceptance" } });
      backtrackApplicationId = isolatedApplication.id;
      const definition = await db.oicProviderDefinition.findUniqueOrThrow({ where: { key: "openai" } });
      const isolatedConnection = await db.oicProviderConnection.create({ data: { providerDefinitionId: definition.id, scope: "APPLICATION", applicationId: isolatedApplication.id, displayName: "Backtrack local fixture", endpointUrl, transportProfile: "openai-chat-completions-v1", status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: new Date() } });
      backtrackConnectionId = isolatedConnection.id;
      const encrypted = encryptProviderCredential("e2e-only-secret", isolatedConnection.id, 1);
      await db.oicProviderCredential.create({ data: { connectionId: isolatedConnection.id, version: 1, ...encrypted } });
      const isolatedUpstream = await db.oicUpstreamModel.create({ data: { providerDefinitionId: definition.id, connectionId: isolatedConnection.id, upstreamModelId: "fixture-private-upstream", displayName: "Backtrack fixture upstream", source: "MANUAL" } });
      backtrackUpstreamId = isolatedUpstream.id;
      await db.oicUpstreamCapabilityEvidence.createMany({ data: ["text.generate", "text.stream"].map((capability) => ({ upstreamModelId: isolatedUpstream.id, capability, status: "SUPPORTED", source: "PLATFORM_CURATED" })) });
      const isolatedVariant = await db.oicModelVariant.create({ data: { revisionId: revisionId!, variantKey: "backtrack", kind: "EXTERNAL_PROVIDER", providerDefinitionId: definition.id, upstreamModelId: isolatedUpstream.id, transportProfile: "openai-chat-completions-v1" } });
      backtrackVariantId = isolatedVariant.id;
      const isolatedBinding = await db.oicRuntimeBinding.create({ data: { editionId: editionId!, variantId: isolatedVariant.id, connectionId: isolatedConnection.id, scope: "APPLICATION", applicationId: isolatedApplication.id, status: "ACTIVE", environment: "production" } });
      backtrackBindingId = isolatedBinding.id;
      await db.oicApplicationModelVisibility.create({ data: { applicationId: isolatedApplication.id, editionId: editionId! } });
      const isolatedPrincipal = await db.oicServicePrincipal.create({ data: { applicationId: isolatedApplication.id, key: `backtrack-${suffix.toLocaleLowerCase()}`, displayName: "Backtrack acceptance principal" } });
      backtrackPrincipalId = isolatedPrincipal.id;
      const isolatedActor: AuthenticatedPrincipal = { ...actor, id: isolatedPrincipal.id, applicationId: isolatedApplication.id, tenantIds: [] };
      await db.oicIntelligenceKnowledge.createMany({ data: [
        { applicationId: isolatedApplication.id, tenantId: null, sourceKey: `alternate-${suffix}`, sourceRef: `cedar-${suffix}`, title: "Cedar server state", content: "Cedar server is not approved.", authority: 95, sourcePriority: 95 },
        { applicationId: isolatedApplication.id, tenantId: null, sourceKey: `alternate-${suffix}`, sourceRef: `quartz-${suffix}`, title: "Quartz release status", content: "ALTERNATE_PATH_EVIDENCE=Quartz release is approved.", authority: 95, sourcePriority: 95 }
      ] });
      const request = { model, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Determine whether Cedar server is approved or Quartz release is approved. Use the current decision records; identify the surviving path, cite the approved source, verify the conclusion, and state any remaining uncertainty." }] }] };
      const identity = { requestId: `alternate-path-${suffix}`, traceId: `alternate-path-trace-${suffix}` };
      const context = await contextResolver.resolve(isolatedActor, { tenant: undefined, sessionId: undefined }, identity);
      const modelContext = await contextResolver.resolve(actor, { tenant: undefined, sessionId: undefined }, { requestId: `alternate-model-${suffix}`, traceId: `alternate-model-trace-${suffix}` });
      const resolved = await resolver.resolve(model, modelContext); assert.ok(resolved);
      const profile = { ...resolved, intelligenceProfile: { ...resolved.intelligenceProfile!, memoryIntensity: 0, retrievalIntensity: 100, reasoningIntensity: 100, verificationIntensity: 75, synthesisIntensity: 40, maxRetrievalQueries: 8, maxProviderCalls: 3, maxStages: 16, maxCandidates: 1, maxVerificationRounds: 2, maxContextTokens: 12_000, allowRevision: false, requireEvidence: true } };
      fixture.responseTexts = [];
      fixture.responseForRequest = (body) => {
        const selectedEvidence = /ALTERNATE_PATH_EVIDENCE=([^\n.]+)/.exec(body)?.[1]?.trim();
        return selectedEvidence ? `Completed from retrieved evidence: ${selectedEvidence}.` : "No supported alternate path was retrieved.";
      };
      const capturedStart = fixture.captured.length;
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      let result;
      try { result = await engine.execute(profile, request, context, AbortSignal.timeout(10_000)); }
      finally { fixture.responseForRequest = undefined; }
      const trace = await db.oicIntelligenceExecution.findUniqueOrThrow({ where: { traceId: identity.traceId }, select: { providerCallCount: true, retrievalQueryCount: true, verificationStatus: true, summary: true } });
      const summary = trace.summary as { stopReason: string; cognitiveKernel?: { depth: number; checkpointCount: number; failedPathFingerprints: string[]; backtrackCheckpoint?: { id: string; problemStateRestored: boolean; constraintsRestored: number; epistemicFactsRestored: number; evidenceReferencesRestored: number; memorySelectionsRestored: number; candidateStatesRestored: number; resourceUsagePreserved: boolean } | null; budget: { limits: { providerCalls: number; stages: number; backtracks: number }; used: { providerCalls: number; stages: number; backtracks: number } }; actions: Array<{ action: string; reason: string }> }; cognitiveSearch?: { nodes: Array<{ id: string; hypothesisRefs: string[]; problemStateFingerprint: string; terminalStatus: string; pruneReason?: string }>; selectedNodeId: string | null; failedStateFingerprints: string[]; stopReason: string; usage: { nodes: number; backtracks: number; providerCalls: number } }; hypotheses?: Array<{ id: string; assessment: string; fingerprint: string; supportingEvidenceIds: string[]; contradictingEvidenceIds: string[] }>; epistemicState?: { facts: Array<{ evidenceId: string; status: string }> } };
      const search = summary.cognitiveSearch;
      const first = search?.nodes.find((node) => node.hypothesisRefs[0] === "H1");
      const alternate = search?.nodes.find((node) => node.id === search.selectedNodeId);
      const checkpoint = summary.cognitiveKernel?.backtrackCheckpoint;
      const capturedBodies = fixture.captured.slice(capturedStart).map((item) => item.body);
      const assertions = {
        deterministicContradictionPrunedInitialPath: first?.terminalStatus === "PRUNED" && Boolean(first.pruneReason),
        structuredCheckpointRestored: checkpoint?.problemStateRestored === true && Boolean(checkpoint.id) && checkpoint.epistemicFactsRestored >= 2 && checkpoint.evidenceReferencesRestored >= 2 && checkpoint.resourceUsagePreserved,
        failedPathExcludedAndNotRetried: Boolean(first && search?.failedStateFingerprints.includes(summary.hypotheses?.find((item) => item.id === "H1")?.fingerprint ?? "")) && new Set(search?.failedStateFingerprints).size === search?.failedStateFingerprints.length,
        differentAlternateSelected: Boolean(alternate && alternate.hypothesisRefs[0] === "H2" && alternate.problemStateFingerprint !== first?.problemStateFingerprint && alternate.terminalStatus === "SELECTED"),
        evidenceDerivedAlternateCompleted: result.outputText === "Completed from retrieved evidence: Quartz release is approved.",
        boundedBacktrackingAndCalls: search?.usage.backtracks === 1 && trace.providerCallCount <= (summary.cognitiveKernel?.budget.limits.providerCalls ?? 0) && search.usage.nodes <= 8 && (summary.cognitiveKernel?.budget.used.backtracks ?? 0) === 1,
        stopRecorded: summary.stopReason === "SUCCESS" || summary.stopReason === "ENOUGH_EVIDENCE"
      };
      assert.ok(Object.values(assertions).every(Boolean), JSON.stringify({ assertions, search, hypotheses: summary.hypotheses, stopReason: summary.stopReason, checkpoint }));
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "BACKTRACK"));
      assert.ok(summary.cognitiveKernel?.actions.some((item) => item.action === "STOP"));
      assert.equal(summary.hypotheses?.find((item) => item.id === "H1")?.assessment, "CONTRADICTED");
      assert.equal(summary.hypotheses?.find((item) => item.id === "H2")?.assessment, "SUPPORTED");
      assert.ok(capturedBodies.some((body) => body.includes("ALTERNATE_PATH_EVIDENCE=Quartz release is approved.")));
      if (process.env.OIC_ACCEPTANCE_CLOSURE === "1") console.log(JSON.stringify({ acceptance: "OIC5_BACKTRACKING_ALTERNATE_PATH", initialPath: first?.hypothesisRefs[0], failure: first?.pruneReason, checkpoint, alternatePath: alternate?.hypothesisRefs[0], backtracks: search?.usage.backtracks, searchNodes: search?.usage.nodes, providerCalls: trace.providerCallCount, stopReason: summary.stopReason, assertions }));
    });

    await t.test("Intelligence Workbench records deterministic required-field completion and resource overhead", async () => {
      fixture.mode = "success"; fixture.responseTexts = ["{\"name\":\"Aurora\"}", "{\"name\":\"Aurora\"}", "{\"name\":\"Aurora\",\"date\":\"2028\",\"status\":\"active\"}"];
      const profile = await db.oicIntelligenceProfile.create({ data: { profileKey: `wb-${suffix.toLowerCase()}`, displayName: "Workbench acceptance profile", source: "CUSTOM", lifecycle: "ACTIVE" } });
      profileId = profile.id;
      const profileRevision = await db.oicIntelligenceProfileRevision.create({ data: { profileId: profile.id, revision: 1, contextIntensity: 40, memoryIntensity: 0, retrievalIntensity: 0, reasoningIntensity: 25, toolsIntensity: 0, verificationIntensity: 80, synthesisIntensity: 25, efficiencyIntensity: 80, maxStages: 8, maxProviderCalls: 2, maxToolCalls: 0, maxRetrievalQueries: 0, maxMemoryItems: 0, maxCandidates: 1, maxVerificationRounds: 1, maxContextTokens: 4096, maxExecutionMs: 30_000, allowMemoryWrites: false, allowRevision: true, requireEvidence: false } });
      profileRevisionId = profileRevision.id;
      const engine = new IntelligenceRuntimeExecutor(db, executor, new OicMemoryRepository(db));
      const workbench = new IntelligenceWorkbenchService(db, contextResolver, resolver, engine, new BoundedRuntimePolicy());
      const result = await workbench.run(actor, { model, profileRevisionId: profileRevision.id, prompt: "Return JSON with required fields: name, date, and status." });
      assert.equal(result.baseline.outputText, "{\"name\":\"Aurora\"}");
      assert.equal(result.augmented.outputText, "{\"name\":\"Aurora\",\"date\":\"2028\",\"status\":\"active\"}");
      assert.equal(result.baseline.execution?.modelRevisionId, result.augmented.execution?.modelRevisionId);
      assert.equal(result.baseline.execution?.profileRevisionId, null);
      assert.equal(result.augmented.execution?.profileRevisionId, profileRevision.id);
      assert.equal(result.baseline.execution?.providerCallCount, 1);
      assert.equal(result.augmented.execution?.providerCallCount, 2);
      assert.equal(result.baseline.execution?.verificationStatus, "NOT_RUN");
      assert.equal(result.augmented.execution?.verificationStatus, "PASS");
      assert.equal((result.augmented.execution?.summary as { revisions?: number }).revisions, 1);
      assert.ok(result.augmented.durationMs >= 0 && result.baseline.durationMs >= 0);
      const baselineExecution = result.baseline.execution;
      const augmentedExecution = result.augmented.execution;
      const workbenchSummary = augmentedExecution?.summary as { toolCalls?: number; candidateCount?: number; revisions?: number; cacheHits?: number; cacheMisses?: number; stopReason?: string; cognitiveSearch?: { usage?: { nodes?: number; backtracks?: number } }; cognitiveSignature?: { candidateCount?: number; verificationRounds?: number; backtracks?: number } } | undefined;
      emitAcceptanceRecord({ id: "B", model, baselineSummary: result.baseline.outputText, baselineAssertions: { requiredFieldsMissing: !result.baseline.outputText.includes('"date"') || !result.baseline.outputText.includes('"status"') }, baseline: { providerCalls: baselineExecution?.providerCallCount ?? "UNKNOWN", retrievalRounds: baselineExecution?.retrievalQueryCount ?? "UNKNOWN", memoryReads: baselineExecution?.memoryLookupCount ?? "UNKNOWN", memoryWrites: "UNKNOWN", toolCalls: "UNKNOWN", candidateCount: "UNKNOWN", searchNodes: "UNKNOWN", verificationRounds: "UNKNOWN", repairRounds: "UNKNOWN", backtracks: "UNKNOWN", cacheHits: "UNKNOWN", cacheMisses: "UNKNOWN", stopReason: "DIRECT_BASELINE" }, baselineRequestId: result.baseline.requestId, profile: "WORKBENCH_CUSTOM", oicSummary: result.augmented.outputText, oicAssertions: { requiredFieldsCompleted: result.augmented.outputText === "{\"name\":\"Aurora\",\"date\":\"2028\",\"status\":\"active\"}", verifierPassed: augmentedExecution?.verificationStatus === "PASS", targetedRepairUsed: workbenchSummary?.revisions === 1, boundedCalls: (augmentedExecution?.providerCallCount ?? Number.POSITIVE_INFINITY) <= 2 }, traceId: result.augmented.traceId, requestId: result.augmented.requestId, oic: { providerCalls: augmentedExecution?.providerCallCount ?? "UNKNOWN", retrievalRounds: augmentedExecution?.retrievalQueryCount ?? "UNKNOWN", memoryReads: augmentedExecution?.memoryLookupCount ?? "UNKNOWN", memoryWrites: "UNKNOWN", toolCalls: workbenchSummary?.toolCalls ?? "UNKNOWN", candidateCount: workbenchSummary?.candidateCount ?? workbenchSummary?.cognitiveSignature?.candidateCount ?? "UNKNOWN", searchNodes: workbenchSummary?.cognitiveSearch?.usage?.nodes ?? "UNKNOWN", verificationRounds: workbenchSummary?.cognitiveSignature?.verificationRounds ?? "UNKNOWN", repairRounds: workbenchSummary?.revisions ?? "UNKNOWN", backtracks: workbenchSummary?.cognitiveSignature?.backtracks ?? "UNKNOWN", cacheHits: workbenchSummary?.cacheHits ?? "UNKNOWN", cacheMisses: workbenchSummary?.cacheMisses ?? "UNKNOWN", stopReason: workbenchSummary?.stopReason ?? "UNKNOWN" } });
      const tenantScopedActor: AuthenticatedPrincipal = { ...actor, tenantIds: [tenantAId!] };
      await assert.rejects(workbench.run(tenantScopedActor, { model, profileRevisionId: profileRevision.id, tenant: { kind: "id", tenantId: tenantBId! }, prompt: "This tenant is not granted." }));
      const actorWithoutRuntimeGrant: AuthenticatedPrincipal = { ...actor, id: randomUUID(), scopes: [] };
      await assert.rejects(workbench.run(actorWithoutRuntimeGrant, { model, profileRevisionId: profileRevision.id, prompt: "This actor has no runtime invoke grant." }));
      const otherApplicationActor: AuthenticatedPrincipal = { ...actor, applicationId: randomUUID() };
      await assert.rejects(workbench.run(otherApplicationActor, { model, profileRevisionId: profileRevision.id, prompt: "This application has no model visibility." }));
      await assert.rejects(workbench.run(actor, { model: `oi-ungranted-${suffix.toLowerCase()}`, profileRevisionId: profileRevision.id, prompt: "This model is not visible to the application." }));
      const traceAccess = new IntelligenceProfileService(db);
      const traceReadScopes = [...actor.scopes, "oic:models:read"];
      const tenantActorA: AuthenticatedPrincipal = { ...actor, scopes: traceReadScopes, tenantIds: [tenantAId!] };
      const tenantActorB: AuthenticatedPrincipal = { ...actor, scopes: traceReadScopes, tenantIds: [tenantBId!] };
      const isolatedTraceId = `trace-isolation-${suffix}`;
      const isolatedRequest = { model, tenant: { kind: "id" as const, tenantId: tenantBId! }, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "Trace tenant isolation acceptance." }] }] };
      const isolatedContext = await contextResolver.resolve(tenantActorB, isolatedRequest, { requestId: `trace-isolation-request-${suffix}`, traceId: isolatedTraceId });
      const isolatedModel = await resolver.resolve(model, isolatedContext); assert.ok(isolatedModel);
      await engine.execute(isolatedModel, isolatedRequest, isolatedContext, AbortSignal.timeout(10_000));
      assert.equal((await traceAccess.listExecutions(tenantActorA)).some((item) => item.traceId === isolatedTraceId), false);
      await assert.rejects(traceAccess.getExecution(tenantActorA, isolatedTraceId));
      assert.equal((await traceAccess.listExecutions(tenantActorB)).some((item) => item.traceId === isolatedTraceId), true);
      const otherApplicationTraceActor: AuthenticatedPrincipal = { ...otherApplicationActor, scopes: traceReadScopes };
      assert.equal((await traceAccess.listExecutions(otherApplicationTraceActor)).length, 0);
      await assert.rejects(traceAccess.getExecution(otherApplicationTraceActor, isolatedTraceId));
    });

    await t.test("Native Runtime streaming consumes provider SSE and returns raw usage evidence", async () => {
      fixture.mode = "stream";
      const events = [];
      for await (const event of await runtime.stream(actor, body, identity, undefined)) events.push(event);
      assert.deepEqual(events.map((event) => event.type), ["response.started", "content.delta", "content.delta", "usage.updated", "response.completed"]);
      assert.equal(events.filter((event) => event.type === "content.delta").map((event) => event.text).join(""), "part-1part-2");
      assert.deepEqual(events.find((event) => event.type === "usage.updated")?.usage, { inputTokens: 7, cachedInputTokens: 2, outputTokens: 3 });
    });

    const compatibility = new OpenAICompatibilityController(runtime);
    await t.test("Chat Completions and Responses compatibility traverse the real runtime and provider", async () => {
      fixture.mode = "success";
      const chat = await compatibility.chatCompletions(actor, { model, messages: [{ role: "user", content: "compat chat" }] }, requestObject() as never, responseObject() as never) as { object: string; model: string; choices: Array<{ message: { content: string } }> };
      assert.equal(chat.object, "chat.completion");
      assert.equal(chat.model, model);
      assert.equal(chat.choices[0]?.message.content, "fixture answer");
      const responses = await compatibility.responses(actor, { model, input: "compat responses", instructions: "be concise" }, requestObject() as never, responseObject() as never) as { object: string; model: string; output: Array<{ content: Array<{ text: string }> }> };
      assert.equal(responses.object, "response");
      assert.equal(responses.model, model);
      assert.equal(responses.output[0]?.content[0]?.text, "fixture answer");
      assert.ok(fixture.captured.at(-2)?.body.includes('"messages"'));
      assert.ok(fixture.captured.at(-1)?.body.includes('"messages"'));
    });

    await t.test("compatibility streaming maps both consumer protocols over provider SSE", async () => {
      fixture.mode = "stream";
      const chatRequest = requestObject();
      const chatResponse = responseObject();
      await compatibility.chatCompletions(actor, { model, messages: [{ role: "user", content: "chat stream" }], stream: true }, chatRequest as never, chatResponse as never);
      assert.ok(chatResponse.chunks.some((chunk) => chunk.includes("chat.completion.chunk")));
      assert.ok(chatResponse.chunks.some((chunk) => chunk.includes("[DONE]")));
      const responsesResponse = responseObject();
      await compatibility.responses(actor, { model, input: "responses stream", stream: true }, requestObject() as never, responsesResponse as never);
      assert.ok(responsesResponse.chunks.some((chunk) => chunk.includes("response.output_text.delta")));
      assert.ok(responsesResponse.chunks.some((chunk) => chunk.includes("response.completed")));
    });

    if (process.env.OIC_ACCEPTANCE_CLOSURE === "1") {
      const records = acceptanceLedger.assertComplete();
      console.log(JSON.stringify({ acceptance: "OIC5_A_P", records }));
    }
  } finally {
    if (profileRevisionId) await db.oicIntelligenceProfileRevision.deleteMany({ where: { id: profileRevisionId } }).catch(() => undefined);
    if (profileId) await db.oicIntelligenceProfile.deleteMany({ where: { id: profileId } }).catch(() => undefined);
    if (appId) {
      await db.oicIntelligenceExecutionStage.deleteMany({ where: { execution: { applicationId: appId } } }).catch(() => undefined);
      await db.oicIntelligenceExecution.deleteMany({ where: { applicationId: appId } }).catch(() => undefined);
      await db.oicIntelligenceMemory.deleteMany({ where: { applicationId: appId } }).catch(() => undefined);
      await db.oicIntelligenceKnowledge.deleteMany({ where: { applicationId: appId } }).catch(() => undefined);
    }
    if (foreignApplicationId) {
      await db.oicIntelligenceKnowledge.deleteMany({ where: { applicationId: foreignApplicationId } }).catch(() => undefined);
      await db.oicApplication.deleteMany({ where: { id: foreignApplicationId } }).catch(() => undefined);
    }
    if (backtrackApplicationId) {
      await db.oicIntelligenceExecutionStage.deleteMany({ where: { execution: { applicationId: backtrackApplicationId } } }).catch(() => undefined);
      await db.oicIntelligenceExecution.deleteMany({ where: { applicationId: backtrackApplicationId } }).catch(() => undefined);
      await db.oicIntelligenceKnowledge.deleteMany({ where: { applicationId: backtrackApplicationId } }).catch(() => undefined);
      await db.oicApplicationModelVisibility.deleteMany({ where: { applicationId: backtrackApplicationId } }).catch(() => undefined);
      if (backtrackBindingId) await db.oicRuntimeBinding.deleteMany({ where: { id: backtrackBindingId } }).catch(() => undefined);
      if (backtrackPrincipalId) await db.oicServicePrincipal.deleteMany({ where: { id: backtrackPrincipalId } }).catch(() => undefined);
      await db.oicApplication.deleteMany({ where: { id: backtrackApplicationId } }).catch(() => undefined);
    }
    if (tenantAId) await db.oicTenant.deleteMany({ where: { id: tenantAId } }).catch(() => undefined);
    if (tenantBId) await db.oicTenant.deleteMany({ where: { id: tenantBId } }).catch(() => undefined);
    if (principalId) await db.oicIdempotencyRecord.deleteMany({ where: { principalId } }).catch(() => undefined);
    if (editionId) await db.oicApplicationModelVisibility.deleteMany({ where: { editionId } }).catch(() => undefined);
    if (backtrackBindingId) await db.oicRuntimeBinding.deleteMany({ where: { id: backtrackBindingId } }).catch(() => undefined);
    if (backtrackVariantId) await db.oicModelVariant.deleteMany({ where: { id: backtrackVariantId } }).catch(() => undefined);
    if (backtrackUpstreamId) {
      await db.oicUpstreamCapabilityEvidence.deleteMany({ where: { upstreamModelId: backtrackUpstreamId } }).catch(() => undefined);
      await db.oicUpstreamPricingEvidence.deleteMany({ where: { upstreamModelId: backtrackUpstreamId } }).catch(() => undefined);
      await db.oicUpstreamModel.deleteMany({ where: { id: backtrackUpstreamId } }).catch(() => undefined);
    }
    if (backtrackConnectionId) {
      await db.oicProviderHealthCheck.deleteMany({ where: { connectionId: backtrackConnectionId } }).catch(() => undefined);
      await db.oicProviderCredential.deleteMany({ where: { connectionId: backtrackConnectionId } }).catch(() => undefined);
      await db.oicProviderConnection.deleteMany({ where: { id: backtrackConnectionId } }).catch(() => undefined);
    }
    if (bindingId) await db.oicRuntimeBinding.deleteMany({ where: { id: bindingId } }).catch(() => undefined);
    if (variantId) await db.oicModelVariant.deleteMany({ where: { id: variantId } }).catch(() => undefined);
    if (revisionId) await db.oicModelRevision.deleteMany({ where: { id: revisionId } }).catch(() => undefined);
    if (editionId) await db.oicModelEdition.deleteMany({ where: { id: editionId } }).catch(() => undefined);
    if (familyId) await db.oicModelFamily.deleteMany({ where: { id: familyId } }).catch(() => undefined);
    if (upstreamId) {
      await db.oicUpstreamCapabilityEvidence.deleteMany({ where: { upstreamModelId: upstreamId } }).catch(() => undefined);
      await db.oicUpstreamPricingEvidence.deleteMany({ where: { upstreamModelId: upstreamId } }).catch(() => undefined);
      await db.oicUpstreamModel.deleteMany({ where: { id: upstreamId } }).catch(() => undefined);
    }
    if (connectionId) {
      await db.oicProviderHealthCheck.deleteMany({ where: { connectionId } }).catch(() => undefined);
      await db.oicProviderCredential.deleteMany({ where: { connectionId } }).catch(() => undefined);
      await db.oicProviderConnection.deleteMany({ where: { id: connectionId } }).catch(() => undefined);
    }
    if (principalId) {
      await db.oicPrincipalScopeGrant.deleteMany({ where: { principalId } }).catch(() => undefined);
      await db.oicServicePrincipal.deleteMany({ where: { id: principalId } }).catch(() => undefined);
    }
    if (appId) await db.oicApplication.deleteMany({ where: { id: appId } }).catch(() => undefined);
    await db.$disconnect();
    await fixture.stop();
    if (priorKey === undefined) delete process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = priorKey;
  }
});
