import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { OicDatabaseService } from "@oic/database";

const LEGACY_READ_KEY_VERSION = 1;
const ACTIVE_WRITE_KEY_VERSION = 2;
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const tiers = new Set(["PUBLIC", "INTERNAL", "PRIVATE_HOLDOUT", "PROTECTED_CERTIFICATION"]);
const purposes = new Set(["INPUT", "ORACLE", "RUBRIC", "OUTPUT", "EVIDENCE"]);

export type EvaluationArtifactFailureCode = "EMPTY_ARTIFACT_REJECTED" | "ARTIFACT_TOO_LARGE" | "ARTIFACT_SCOPE_INVALID" | "ENCRYPTION_CONFIG_INVALID" | "ENCRYPTION_FAILED" | "WRITE_FAILED";
export class EvaluationArtifactError extends Error {
  constructor(readonly code: EvaluationArtifactFailureCode) { super(code); }
}

export type ArtifactScope = {
  applicationId: string;
  tenantId: string | null;
  purpose: string;
  exposureTier: string;
};

export type SealedArtifact = ArtifactScope & {
  id: string;
  digest: string;
  ciphertext: Buffer;
  nonce: string;
  authTag: string;
  keyVersion: number;
};

function decodeKey(encoded: string | undefined): Buffer {
  if (!encoded || !(/^[a-f0-9]{64}$/i.test(encoded) || /^[A-Za-z0-9+/]{43}=$/.test(encoded))) throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
  const key = Buffer.from(encoded, /^[a-f0-9]{64}$/i.test(encoded) ? "hex" : "base64");
  if (key.length !== 32) throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
  return key;
}

function readKey(version: number): Buffer {
  if (version === LEGACY_READ_KEY_VERSION) return decodeKey(process.env.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY);
  if (version === ACTIVE_WRITE_KEY_VERSION) return decodeKey(process.env.OIC_EVALUATION_ARTIFACT_KEY_V2);
  throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
}

function writeKey(): Buffer {
  if (process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION !== String(ACTIVE_WRITE_KEY_VERSION)) throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
  const active = readKey(ACTIVE_WRITE_KEY_VERSION);
  const legacyEncoded = process.env.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY;
  if (legacyEncoded && timingSafeEqual(active, readKey(LEGACY_READ_KEY_VERSION))) throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
  return active;
}

function assertScope(scope: ArtifactScope): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(scope.applicationId) || (scope.tenantId !== null && !uuid.test(scope.tenantId)) || !tiers.has(scope.exposureTier) || !purposes.has(scope.purpose)) throw new EvaluationArtifactError("ARTIFACT_SCOPE_INVALID");
}

function aad(value: SealedArtifact): Buffer {
  return Buffer.from(`oic-evaluation-artifact-v1:${value.id}:${value.applicationId}:${value.tenantId ?? "NONE"}:${value.purpose}:${value.exposureTier}:${value.digest}:${value.keyVersion}`, "utf8");
}

export function sealEvaluationArtifact(content: Buffer, scope: ArtifactScope): SealedArtifact {
  assertScope(scope);
  if (!Buffer.isBuffer(content) || content.length === 0) throw new EvaluationArtifactError("EMPTY_ARTIFACT_REJECTED");
  if (content.length > MAX_ARTIFACT_BYTES) throw new EvaluationArtifactError("ARTIFACT_TOO_LARGE");
  const envelope: SealedArtifact = {
    ...scope,
    id: randomUUID(),
    digest: createHash("sha256").update(content).digest("hex"),
    ciphertext: Buffer.alloc(0),
    nonce: randomBytes(12).toString("hex"),
    authTag: "",
    keyVersion: ACTIVE_WRITE_KEY_VERSION
  };
  try {
    const cipher = createCipheriv("aes-256-gcm", writeKey(), Buffer.from(envelope.nonce, "hex"));
    cipher.setAAD(aad(envelope));
    envelope.ciphertext = Buffer.concat([cipher.update(content), cipher.final()]);
    envelope.authTag = cipher.getAuthTag().toString("hex");
  } catch (error) {
    if (error instanceof EvaluationArtifactError) throw error;
    throw new EvaluationArtifactError("ENCRYPTION_FAILED");
  }
  return envelope;
}

export function openEvaluationArtifact(envelope: SealedArtifact, expected: ArtifactScope): Buffer {
  assertScope(expected);
  if (envelope.applicationId !== expected.applicationId || envelope.tenantId !== expected.tenantId || envelope.purpose !== expected.purpose || envelope.exposureTier !== expected.exposureTier || ![LEGACY_READ_KEY_VERSION, ACTIVE_WRITE_KEY_VERSION].includes(envelope.keyVersion) || !/^[a-f0-9]{64}$/.test(envelope.digest) || !/^[a-f0-9]{24}$/.test(envelope.nonce) || !/^[a-f0-9]{32}$/.test(envelope.authTag)) throw new Error("Evaluation artifact envelope is invalid");
  const decipher = createDecipheriv("aes-256-gcm", readKey(envelope.keyVersion), Buffer.from(envelope.nonce, "hex"));
  decipher.setAAD(aad(envelope));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "hex"));
  const content = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
  const digest = createHash("sha256").update(content).digest();
  if (!timingSafeEqual(digest, Buffer.from(envelope.digest, "hex"))) throw new Error("Evaluation artifact digest mismatch");
  return content;
}

@Injectable()
export class EvaluationArtifactVault {
  constructor(private readonly db: OicDatabaseService) {}

  assertConfigured(): void { void writeKey(); }

  /** A zero-persistence active-key round trip proves the v2 write path without exposing key material. */
  readiness(): { available: true; activeWriteKeyVersion: 2; legacyWriteDisabled: true } {
    const sample = Buffer.from("oic-evaluation-vault-readiness-v1", "utf8");
    let opened: Buffer | undefined;
    try {
      const scope = { applicationId: randomUUID(), tenantId: null, purpose: "EVIDENCE", exposureTier: "INTERNAL" };
      const sealed = sealEvaluationArtifact(sample, scope);
      if (sealed.keyVersion !== ACTIVE_WRITE_KEY_VERSION) throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
      opened = openEvaluationArtifact(sealed, scope);
      if (!opened.equals(sample)) throw new EvaluationArtifactError("ENCRYPTION_FAILED");
      return { available: true, activeWriteKeyVersion: ACTIVE_WRITE_KEY_VERSION, legacyWriteDisabled: true };
    } catch {
      throw new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
    } finally {
      sample.fill(0);
      opened?.fill(0);
    }
  }

  async store(content: Buffer, scope: ArtifactScope, createdBy: string) {
    const sealed = sealEvaluationArtifact(content, scope);
    let row;
    try {
      row = await this.db.$transaction(async (tx) => {
        const artifact = await tx.oicEvaluationArtifact.create({ data: { ...sealed, ciphertext: Uint8Array.from(sealed.ciphertext), createdBy } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: createdBy, applicationId: scope.applicationId, tenantId: scope.tenantId, action: "evaluation.artifact.stored", targetType: "evaluation-artifact", targetId: artifact.id, metadata: { digest: artifact.digest, purpose: artifact.purpose, exposureTier: artifact.exposureTier } } });
        return artifact;
      });
    } catch {
      throw new EvaluationArtifactError("WRITE_FAILED");
    }
    return { id: row.id, digest: row.digest, purpose: row.purpose, exposureTier: row.exposureTier };
  }

  async read(id: string, expected: ArtifactScope): Promise<Buffer> {
    if ((expected.exposureTier === "PRIVATE_HOLDOUT" || expected.exposureTier === "PROTECTED_CERTIFICATION") && expected.purpose === "ORACLE") throw new Error("Protected oracle read requires a sealed-output evaluator capability");
    const row = await this.db.oicEvaluationArtifact.findFirst({ where: { id, applicationId: expected.applicationId, tenantId: expected.tenantId, purpose: expected.purpose, exposureTier: expected.exposureTier, status: "AVAILABLE" } });
    if (!row) throw new Error("Evaluation artifact is unavailable");
    return openEvaluationArtifact({ ...row, ciphertext: Buffer.from(row.ciphertext) }, expected);
  }

  async verifyReference(id: string, digest: string, expected: ArtifactScope, requiredKeyVersion?: number): Promise<void> {
    const row = await this.db.oicEvaluationArtifact.findFirst({ where: { id, applicationId: expected.applicationId, tenantId: expected.tenantId, purpose: expected.purpose, exposureTier: expected.exposureTier, digest, status: "AVAILABLE", ...(requiredKeyVersion === undefined ? {} : { keyVersion: requiredKeyVersion }) }, select: { id: true } });
    if (!row) throw new Error("Evaluation artifact reference is unavailable");
  }
}
