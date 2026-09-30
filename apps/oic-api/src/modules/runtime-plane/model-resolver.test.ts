import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseOicModelResolver } from "./model-resolver";

void test("database model resolver exposes only application-visible Oi identity and selects binding by scope", async () => {
  const bindings = [
    { id: "platform", scope: "PLATFORM", applicationId: null, tenantId: null, variantId: "vp", variant: { revisionId: "rp", revision: { editionId: "edition" } } },
    { id: "application", scope: "APPLICATION", applicationId: "app", tenantId: null, variantId: "va", variant: { revisionId: "ra", revision: { editionId: "edition" } } },
    { id: "tenant", scope: "TENANT", applicationId: "app", tenantId: "tenant", variantId: "vt", variant: { revisionId: "rt", revision: { editionId: "edition" } } }
  ];
  const db = { oicModelEdition: { findFirst: () => Promise.resolve({ id: "edition", publicId: "oi-core", displayName: "Oi Core", bindings }) } };
  const resolver = new DatabaseOicModelResolver(db as never);
  const resolved = await resolver.resolve("oi-core", { requestId: "r", traceId: "t", applicationId: "app", principalId: "p", tenantId: "tenant" });
  assert.equal(resolved?.id, "oi-core");
  assert.equal(resolved?.displayName, "Oi Core");
  assert.deepEqual(resolved?.capabilities, ["text.generate", "text.stream"]);
  assert.equal((resolved as { bindingId?: string }).bindingId, "tenant");
  assert.equal("providerDefinitionId" in (resolved ?? {}), false);
  assert.equal("upstreamModelId" in (resolved ?? {}), false);
});

void test("database model resolver does not resolve an edition absent from visibility and active binding lookup", async () => {
  const db = { oicModelEdition: { findFirst: () => Promise.resolve(null) } };
  const resolver = new DatabaseOicModelResolver(db as never);
  assert.equal(await resolver.resolve("oi-hidden", { requestId: "r", traceId: "t", applicationId: "wrong-app", principalId: "p", tenantId: null }), null);
});
