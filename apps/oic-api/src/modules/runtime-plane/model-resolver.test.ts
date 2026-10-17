import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseOicModelResolver, OicModelResolutionOperationError } from "./model-resolver";

void test("database model resolver exposes only application-visible Oi identity and selects binding by scope", async () => {
  const providerDefinition = { id: "provider-definition", key: "fixture-provider" };
  const bindings = ["platform", "application", "tenant"].map((scope) => ({
    id: scope, scope: scope.toUpperCase(), applicationId: scope === "platform" ? null : "app", tenantId: scope === "tenant" ? "tenant" : null,
    connectionId: `connection-${scope}`, connection: { id: `connection-${scope}`, transportProfile: "fixture-chat", providerDefinition },
    variantId: `variant-${scope}`,
    variant: {
      revisionId: `revision-${scope}`, providerDefinitionId: providerDefinition.id,
      upstreamModel: { providerDefinitionId: providerDefinition.id, connectionId: `connection-${scope}`, upstreamModelId: `upstream-${scope}` },
      revision: { editionId: "edition" }
    }
  }));
  const db = { oicModelEdition: { findFirst: () => Promise.resolve({ id: "edition", publicId: "oi-core", displayName: "Oi Core", bindings }) } };
  const resolver = new DatabaseOicModelResolver(db as never);
  const resolved = await resolver.resolve("oi-core", { requestId: "r", traceId: "t", applicationId: "app", principalId: "p", tenantId: "tenant" });
  assert.equal(resolved?.id, "oi-core");
  assert.equal(resolved?.displayName, "Oi Core");
  assert.deepEqual(resolved?.capabilities, ["text.generate", "text.stream"]);
  assert.equal((resolved as { bindingId?: string }).bindingId, "tenant");
  assert.equal("providerConnectionId" in (resolved ?? {}), false);
  const resolvedForEvaluation = await resolver.resolveForEvaluation("oi-core", { requestId: "r", traceId: "t", applicationId: "app", principalId: "p", tenantId: "tenant" });
  assert.equal((resolvedForEvaluation as { providerConnectionId?: string } | null)?.providerConnectionId, "connection-tenant");
  assert.equal((resolvedForEvaluation as { providerDefinitionId?: string } | null)?.providerDefinitionId, "provider-definition");
  assert.equal((resolvedForEvaluation as { providerKey?: string } | null)?.providerKey, "fixture-provider");
  assert.equal((resolvedForEvaluation as { upstreamModelRef?: string } | null)?.upstreamModelRef, "upstream-tenant");
  assert.equal((resolvedForEvaluation as { transportProfile?: string } | null)?.transportProfile, "fixture-chat");
});

void test("database model resolver does not resolve an edition absent from visibility and active binding lookup", async () => {
  const db = { oicModelEdition: { findFirst: () => Promise.resolve(null) } };
  const resolver = new DatabaseOicModelResolver(db as never);
  assert.equal(await resolver.resolve("oi-hidden", { requestId: "r", traceId: "t", applicationId: "wrong-app", principalId: "p", tenantId: null }), null);
});

void test("model resolver error identifies the Prisma operation without retaining raw database text", async () => {
  const db = { oicModelEdition: { findFirst: () => Promise.reject(Object.assign(new Error("password=do-not-retain postgresql://private.example/db"), { code: "P2010", meta: { database_error: "private SQL text", constraint: "OicModelEdition_safe_constraint" } })) } };
  const resolver = new DatabaseOicModelResolver(db as never);
  await assert.rejects(resolver.resolveForEvaluation("oi-safe", { requestId: "r", traceId: "t", applicationId: "app", principalId: "p", tenantId: null }), (error: unknown) => {
    assert.ok(error instanceof OicModelResolutionOperationError);
    assert.equal(error.safeDiagnostic.operationId, "OIC_MODEL_EDITION_FIND_FIRST");
    assert.equal(error.safeDiagnostic.prismaErrorType, "Error");
    assert.equal(error.safeDiagnostic.prismaErrorCode, "P2010");
    assert.equal(error.safeDiagnostic.modelName, "OicModelEdition");
    assert.equal(error.safeDiagnostic.safeDatabaseMeta.constraint, "OicModelEdition_safe_constraint");
    assert.deepEqual(error.safeDiagnostic.inputShape, { applicationScoped: true, tenantScoped: false, modelIdValid: true });
    assert.equal(JSON.stringify(error.safeDiagnostic).includes("do-not-retain"), false);
    assert.equal(JSON.stringify(error.safeDiagnostic).includes("private.example"), false);
    assert.equal(JSON.stringify(error.safeDiagnostic).includes("private SQL"), false);
    return true;
  });
});
