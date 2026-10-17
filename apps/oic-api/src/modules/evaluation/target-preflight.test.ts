import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { EvaluationService } from "./evaluation.service";

const applicationId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const runtimePrincipalId = "92842122-822f-4ddc-a3af-7a162f8a35f1";
const connectionId = "bc113c1b-e8fc-4a0b-9bda-8428a94f3005";
const bindingId = "ada73ca7-ca5c-4b30-bae6-80c221b3eab4";
const revisionId = "95fccd39-a7a9-462e-90c6-cd4cd4b7da3e";
const now = new Date("2026-10-14T10:00:00.000Z");

function setup() {
  let describeCalls = 0;
  let invokeCalls = 0;
  let audit: unknown;
  const runtime = {
    describeEvaluationTarget(actor: { id: string; scopes: string[] }, request: { model: string; maxOutputUnits: number }) {
      describeCalls += 1;
      assert.equal(actor.id, runtimePrincipalId);
      assert.deepEqual(actor.scopes, ["oic:runtime:invoke"]);
      assert.equal(request.model, "oi-deepseek-flash");
      assert.equal(request.maxOutputUnits, 8);
      return Promise.resolve({
        modelId: "oi-deepseek-flash", resolverVersion: "oic-model-resolver-v1", runtimeVersion: "1",
        revisionId, variantId: "dbd623d6-9b0f-42f0-ad7b-60ab5d4bb926", bindingId,
        profileId: "builtin-fast-unassigned", profileRevision: 1, providerConnectionId: connectionId,
        providerDefinitionId: "b805b686-a2a0-4b8b-b206-3c50f6515c8a", providerKey: "openai-compatible",
        upstreamModelRef: "deepseek-flash", transportProfile: "openai-chat-completions-v1"
      });
    },
    invokeEvaluationAttempt() { invokeCalls += 1; return Promise.reject(new Error("Paid execution must not run during preflight")); }
  };
  const db = {
    oicServicePrincipal: { findFirst() { return Promise.resolve({ id: runtimePrincipalId, applicationId, status: "ACTIVE", scopes: [{ scope: "oic:runtime:invoke" }], tenantGrants: [] }); } },
    oicProviderConnection: { findFirst() { return Promise.resolve({
      id: connectionId, endpointUrl: "https://api.deepseek.com/", transportProfile: "openai-chat-completions-v1", status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: now,
      providerDefinition: { key: "openai-compatible" }, credentials: [{ id: "safe-credential-row-id", version: 1, status: "ACTIVE" }]
    }); } },
    oicUpstreamModel: { findFirst() { return Promise.resolve({
      id: "44111f9f-fd3a-4bc7-9900-33972f6ef544", upstreamModelId: "deepseek-flash", providerDefinitionId: "b805b686-a2a0-4b8b-b206-3c50f6515c8a", connectionId, lifecycle: "ACTIVE",
      capabilityEvidence: [{ capability: "text.generate", status: "SUPPORTED", source: "PLATFORM_CURATED", observedAt: now }]
    }); } },
    oicAuditEvent: { create(input: unknown) { audit = input; return Promise.resolve(input); } }
  };
  const service = new EvaluationService(db as never, {} as never, runtime as never);
  return { service, get describeCalls() { return describeCalls; }, get invokeCalls() { return invokeCalls; }, get audit() { return audit; } };
}

const expectedTarget = {
  providerKey: "openai-compatible", upstreamModelRef: "deepseek-flash", providerConnectionId: connectionId,
  bindingId, revisionId, transportProfile: "openai-chat-completions-v1"
};
const input = { applicationId, modelId: "oi-deepseek-flash", runtimePrincipalId, maxOutputUnits: 8, expectedTarget };
const actor = { id: "independent-reviewer", applicationId, scopes: ["oic:evaluation:manage"], tenantIds: [] };

void test("evaluation target preflight resolves exact DeepSeek binding without provider dispatch and persists safe evidence", async () => {
  const harness = setup();
  const result = await harness.service.preflightTarget(actor, input, "preflight-request", "preflight-trace");
  assert.equal(harness.describeCalls, 1);
  assert.equal(harness.invokeCalls, 0);
  assert.deepEqual(result, {
    status: "PASS", dispatchOccurred: false, paidRequestCreated: false, checkedAt: result.checkedAt,
    applicationId, runtimePrincipalId, runtimeScope: "oic:runtime:invoke", modelId: "oi-deepseek-flash",
    targetFingerprint: result.targetFingerprint, provider: "DeepSeek", providerDefinitionKey: "openai-compatible",
    providerConnectionId: connectionId, connectionStatus: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: now.toISOString(),
    credentialStatus: "ACTIVE", credentialVersion: 1, upstreamModelRef: "deepseek-flash", upstreamLifecycle: "ACTIVE",
    bindingId, revisionId, variantId: "dbd623d6-9b0f-42f0-ad7b-60ab5d4bb926", transportProfile: "openai-chat-completions-v1",
    capability: { name: "text.generate", status: "SUPPORTED", source: "PLATFORM_CURATED", observedAt: now.toISOString() },
    applicationVisibility: "RESOLVED", executionEligibility: "ELIGIBLE"
  });
  assert.doesNotMatch(JSON.stringify(result), /ciphertext|authorization|api.?key|secret/i);
  assert.deepEqual(harness.audit, { data: {
    actorPrincipalId: actor.id, applicationId, action: "evaluation.target.preflight", targetType: "runtime-binding", targetId: bindingId,
    requestId: "preflight-request", traceId: "preflight-trace",
    metadata: {
      status: "PASS", dispatchOccurred: false, paidRequestCreated: false, modelId: "oi-deepseek-flash", runtimePrincipalId,
      runtimeScope: "oic:runtime:invoke", targetFingerprint: result.targetFingerprint, provider: "DeepSeek", providerDefinitionKey: "openai-compatible",
      providerConnectionId: connectionId, connectionStatus: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: now.toISOString(), credentialStatus: "ACTIVE", credentialVersion: 1,
      upstreamModelRef: "deepseek-flash", upstreamLifecycle: "ACTIVE", bindingId, revisionId, variantId: "dbd623d6-9b0f-42f0-ad7b-60ab5d4bb926",
      transportProfile: "openai-chat-completions-v1", capability: { name: "text.generate", status: "SUPPORTED", source: "PLATFORM_CURATED" },
      applicationVisibility: "RESOLVED", executionEligibility: "ELIGIBLE"
    }
  } });
  assert.doesNotMatch(JSON.stringify(harness.audit), /ciphertext|authorization|api.?key|secret/i);
});

void test("evaluation target preflight rejects a target identity mismatch", async () => {
  const harness = setup();
  await assert.rejects(
    harness.service.preflightTarget(actor, { ...input, expectedTarget: { ...expectedTarget, bindingId: "00000000-0000-4000-8000-000000000000" } }, "preflight-request"),
    (error: unknown) => error instanceof ConflictException && error.message === "TARGET_EXPECTATION_MISMATCH"
  );
  assert.equal(harness.invokeCalls, 0);
});

void test("evaluation target preflight rejects callers without evaluation management permission", async () => {
  const harness = setup();
  await assert.rejects(
    harness.service.preflightTarget({ ...actor, scopes: ["oic:evaluation:read"] }, input, "preflight-request"),
    (error: unknown) => error instanceof NotFoundException
  );
  assert.equal(harness.describeCalls, 0);
});
