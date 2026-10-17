import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { EvaluationArtifactError, EvaluationArtifactVault, openEvaluationArtifact, sealEvaluationArtifact } from "./artifact-vault";
import { decodeVisibleOutput, EMPTY_VISIBLE_OUTPUT_ENCODING, encodeEmptyVisibleOutput } from "./visible-output-evidence";

const keyVariables = ["OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY", "OIC_EVALUATION_ARTIFACT_KEY_V2", "OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION"] as const;

void test("artifact vault writes only version 2, reads exact persisted versions and rejects compromised-key reuse", () => {
  const previous = new Map(keyVariables.map((name) => [name, process.env[name]]));
  const legacy = randomBytes(32);
  const active = randomBytes(32);
  process.env.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY = legacy.toString("hex");
  process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = active.toString("hex");
  process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = "2";
  let databaseWrites = 0;
  try {
    const readiness = new EvaluationArtifactVault({ $transaction: () => { databaseWrites++; return Promise.resolve(); } } as never).readiness();
    assert.deepEqual(readiness, { available: true, activeWriteKeyVersion: 2, legacyWriteDisabled: true });
    assert.equal(databaseWrites, 0, "readiness must not create a fake artifact record");
    const scope = { applicationId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a3", tenantId: "c8792436-4157-40dd-bad5-a99e3543ea88", purpose: "ORACLE", exposureTier: "PRIVATE_HOLDOUT" };
    const plaintext = Buffer.from("sealed evaluator answer");
    const sealed = sealEvaluationArtifact(plaintext, scope);
    assert.equal(sealed.keyVersion, 2);
    assert.notEqual(sealed.ciphertext.toString("utf8"), plaintext.toString("utf8"));
    assert.deepEqual(openEvaluationArtifact(sealed, scope), plaintext);
    assert.throws(() => openEvaluationArtifact(sealed, { ...scope, purpose: "INPUT" }));
    assert.throws(() => openEvaluationArtifact({ ...sealed, digest: "0".repeat(64) }, scope));
    assert.throws(() => openEvaluationArtifact({ ...sealed, authTag: "0".repeat(32) }, scope));
    assert.throws(() => openEvaluationArtifact({ ...sealed, keyVersion: 3 }, scope), /envelope is invalid/);
    assert.throws(() => sealEvaluationArtifact(Buffer.alloc(0), scope), (error: unknown) => error instanceof EvaluationArtifactError && error.code === "EMPTY_ARTIFACT_REJECTED");

    const oldId = randomUUID();
    const oldDigest = createHash("sha256").update(plaintext).digest("hex");
    const oldNonce = randomBytes(12).toString("hex");
    const aad = Buffer.from(`oic-evaluation-artifact-v1:${oldId}:${scope.applicationId}:${scope.tenantId}:${scope.purpose}:${scope.exposureTier}:${oldDigest}:1`);
    const cipher = createCipheriv("aes-256-gcm", legacy, Buffer.from(oldNonce, "hex"));
    cipher.setAAD(aad);
    const old = { ...scope, id: oldId, digest: oldDigest, ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]), nonce: oldNonce, authTag: cipher.getAuthTag().toString("hex"), keyVersion: 1 };
    assert.deepEqual(openEvaluationArtifact(old, scope), plaintext, "historical version 1 remains readable by its exact legacy key");
    delete process.env.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY;
    assert.throws(() => openEvaluationArtifact(old, scope), /ENCRYPTION_CONFIG_INVALID/, "version 2 may not be guessed as a fallback for version 1");
    process.env.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY = legacy.toString("hex");
    delete process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
    assert.throws(() => openEvaluationArtifact(sealed, scope), /ENCRYPTION_CONFIG_INVALID/, "version 1 may not be guessed as a fallback for version 2");
    process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = legacy.toString("hex");
    assert.throws(() => sealEvaluationArtifact(plaintext, scope), /ENCRYPTION_CONFIG_INVALID/, "compromised key cannot become the active write key");
    process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = active.toString("hex");
    process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = "1";
    assert.throws(() => sealEvaluationArtifact(plaintext, scope), /ENCRYPTION_CONFIG_INVALID/, "legacy version cannot be selected for new writes");
    assert.throws(() => new EvaluationArtifactVault({} as never).readiness(), /ENCRYPTION_CONFIG_INVALID/, "readiness fails when legacy writes are selected");
    process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = "2";
    const attemptId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a8";
    const emptyEnvelope = encodeEmptyVisibleOutput(attemptId);
    const sealedEmpty = sealEvaluationArtifact(emptyEnvelope, { ...scope, purpose: "OUTPUT" });
    assert.deepEqual(decodeVisibleOutput(openEvaluationArtifact(sealedEmpty, { ...scope, purpose: "OUTPUT" }), EMPTY_VISIBLE_OUTPUT_ENCODING, attemptId), Buffer.alloc(0));
    assert.throws(() => decodeVisibleOutput(emptyEnvelope, EMPTY_VISIBLE_OUTPUT_ENCODING, "c8b49b66-a9a9-4edf-b955-ef5084ea46a9"), /VISIBLE_OUTPUT_ENVELOPE_INVALID/);
  } finally {
    for (const name of keyVariables) { const value = previous.get(name); if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    legacy.fill(0);
    active.fill(0);
  }
});
