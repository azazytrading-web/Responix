import assert from "node:assert/strict";
import test from "node:test";
import { issueCredential, verifyCredential } from "./credential.crypto";

void test("machine credentials are versioned, high entropy, and verifier-only", async () => {
  const issued = await issueCredential();
  assert.match(issued.token, /^oic_v1\.[A-Za-z0-9_-]{20,24}\.[A-Za-z0-9_-]{40,50}$/);
  assert.equal(issued.verifier.includes(issued.token), false);
  assert.equal(await verifyCredential(issued.token.slice(issued.token.lastIndexOf(".") + 1), issued.verifier), true);
  assert.equal(await verifyCredential("incorrect-secret", issued.verifier), false);
  assert.equal(await verifyCredential("anything", "plaintext-secret"), false);
});