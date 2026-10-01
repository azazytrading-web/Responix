import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, resolvePublicHttpsEndpoint } from "./provider-endpoint";
import { isLocalFixtureConnection, LOCAL_PROVIDER_FIXTURE_CATALOG, LOCAL_PROVIDER_FIXTURE_ENDPOINT, LOCAL_PROVIDER_FIXTURE_KEY, localProviderFixtureEnabled } from "./local-provider-fixture";
import { registeredProvider } from "./provider-registry";
import { canTransitionUpstreamCatalogLifecycle } from "./model-fabric.service";

void test("local provider fixture is disabled by default and requires explicit development opt-in", () => {
  assert.equal(localProviderFixtureEnabled({}), false);
  assert.equal(localProviderFixtureEnabled({ NODE_ENV: "development", OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: "false" }), false);
  assert.equal(localProviderFixtureEnabled({ NODE_ENV: "test", OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: "true" }), false);
  assert.equal(localProviderFixtureEnabled({ NODE_ENV: "development", OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: "true" }), true);
});

void test("local provider fixture remains unavailable in production even when explicitly requested", () => {
  assert.equal(localProviderFixtureEnabled({ NODE_ENV: "production", OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: "true" }), false);
  assert.equal(localProviderFixtureEnabled({ NODE_ENV: "production", OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: "false" }), false);
});

void test("provider registry exposes the local adapter only during explicit local development", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.OIC_ENABLE_LOCAL_PROVIDER_FIXTURE;
  try {
    process.env.NODE_ENV = "development";
    delete process.env.OIC_ENABLE_LOCAL_PROVIDER_FIXTURE;
    assert.equal(registeredProvider(LOCAL_PROVIDER_FIXTURE_KEY), undefined);
    process.env.OIC_ENABLE_LOCAL_PROVIDER_FIXTURE = "true";
    assert.equal(registeredProvider(LOCAL_PROVIDER_FIXTURE_KEY)?.defaultEndpoint, LOCAL_PROVIDER_FIXTURE_ENDPOINT);
    process.env.NODE_ENV = "production";
    assert.equal(registeredProvider(LOCAL_PROVIDER_FIXTURE_KEY), undefined);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousFlag === undefined) delete process.env.OIC_ENABLE_LOCAL_PROVIDER_FIXTURE; else process.env.OIC_ENABLE_LOCAL_PROVIDER_FIXTURE = previousFlag;
  }
});

void test("the endpoint exception recognizes only the registered fixture identity and exact reserved endpoint", async () => {
  assert.equal(isLocalFixtureConnection({ providerDefinition: { key: LOCAL_PROVIDER_FIXTURE_KEY }, endpointUrl: LOCAL_PROVIDER_FIXTURE_ENDPOINT }), true);
  assert.equal(isLocalFixtureConnection({ providerDefinition: { key: LOCAL_PROVIDER_FIXTURE_KEY }, endpointUrl: "https://127.0.0.1/v1" }), false);
  assert.equal(isLocalFixtureConnection({ providerDefinition: { key: "openai-compatible" }, endpointUrl: LOCAL_PROVIDER_FIXTURE_ENDPOINT }), false);
  assert.equal(isPublicAddress("127.0.0.1"), false);
  await assert.rejects(resolvePublicHttpsEndpoint("http://127.0.0.1/v1"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://localhost/v1"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://192.168.1.10/v1"));
});

void test("fixture catalog preserves supported, unsupported, unknown, known-zero and unknown pricing states", () => {
  const allCapabilities = LOCAL_PROVIDER_FIXTURE_CATALOG.flatMap((model) => model.capabilities ?? []);
  assert.ok(allCapabilities.some(({ status }) => status === "SUPPORTED"));
  assert.ok(allCapabilities.some(({ status }) => status === "UNSUPPORTED"));
  assert.ok(allCapabilities.some(({ status }) => status === "UNKNOWN"));
  assert.ok(LOCAL_PROVIDER_FIXTURE_CATALOG.some(({ contextLimit, outputLimit }) => contextLimit === undefined && outputLimit === undefined));
  assert.ok(LOCAL_PROVIDER_FIXTURE_CATALOG.some(({ pricing }) => pricing?.status === "KNOWN" && pricing.inputRate === 0));
  assert.ok(LOCAL_PROVIDER_FIXTURE_CATALOG.some(({ pricing }) => pricing?.status === "UNKNOWN"));
});

void test("upstream catalog lifecycle supports one-way archive semantics", () => {
  assert.equal(canTransitionUpstreamCatalogLifecycle("ACTIVE", "ARCHIVED"), true);
  assert.equal(canTransitionUpstreamCatalogLifecycle("DISABLED", "ARCHIVED"), true);
  assert.equal(canTransitionUpstreamCatalogLifecycle("DEPRECATED", "ARCHIVED"), true);
  assert.equal(canTransitionUpstreamCatalogLifecycle("ARCHIVED", "ACTIVE"), false);
});
