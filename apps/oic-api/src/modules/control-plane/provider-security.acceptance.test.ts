import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptProviderCredential, encryptProviderCredential } from "./provider-credential.crypto";
import { isPublicAddress, resolvePublicHttpsEndpoint } from "./provider-endpoint";
import { registeredProvider } from "./provider-registry";

void test("provider credential encryption is authenticated and connection-bound", () => {
  const previous = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    const secret = "opaque-provider-secret";
    const encrypted = encryptProviderCredential(secret, "connection-a", 1);
    assert.equal(JSON.stringify(encrypted).includes(secret), false);
    assert.equal(decryptProviderCredential(encrypted, "connection-a", 1), secret);
    assert.throws(() => decryptProviderCredential(encrypted, "connection-b", 1));
    assert.throws(() => decryptProviderCredential({ ...encrypted, authTag: "0".repeat(32) }, "connection-a", 1));
    assert.throws(() => encryptProviderCredential("  ", "connection-a", 1));
  } finally {
    if (previous === undefined) delete process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = previous;
  }
});

void test("provider endpoint validation rejects unsafe schemes, credentials, local and mixed DNS targets", async () => {
  await assert.rejects(resolvePublicHttpsEndpoint("http://example.com/v1"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://user:pass@example.com/v1"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://example.com/v1?token=x"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://localhost/v1"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://127.0.0.1/v1"));
  await assert.rejects(resolvePublicHttpsEndpoint("https://example.test/v1", () => Promise.resolve([
    { address: "203.0.113.10", family: 4 }, { address: "8.8.8.8", family: 4 }
  ])));
  const resolved = await resolvePublicHttpsEndpoint("https://provider.example/v1", () => Promise.resolve([
    { address: "8.8.8.8", family: 4 }
  ]));
  assert.equal(resolved.hostname, "provider.example");
  assert.deepEqual(resolved.addresses, [{ address: "8.8.8.8", family: 4 }]);
});

void test("provider endpoint public address filter denies special and private ranges", () => {
  for (const address of ["0.0.0.1", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.1.1", "198.18.0.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002::1"]) {
    assert.equal(isPublicAddress(address), false, `${address} must be denied`);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(address), true, `${address} must be public`);
});

void test("provider registry publishes only statically registered transports", () => {
  assert.deepEqual(registeredProvider("openai")?.transportProfiles, ["openai-chat-completions-v1", "openai-responses-v1"]);
  assert.equal(registeredProvider("arbitrary-module-name"), undefined);
});
