import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import { EvaluationArtifactVault } from "./artifact-vault";
import { EvaluationService } from "./evaluation.service";
import { evaluateObjectiveOracle } from "./objective-oracle";

void test("live deterministic registry publication is atomic and scoped", { skip: !process.env.OIC_DATABASE_URL }, async () => {
  const previousKey = process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
  const previousVersion = process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION;
  process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = randomBytes(32).toString("hex");
  process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = "2";
  const db = new OicDatabaseService();
  const rollback = "OIC_EVALUATION_FIXTURE_ROLLBACK";
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const client = new Proxy(tx, { get(target, property, receiver) {
        if (property === "$transaction") return (callback: (transaction: typeof tx) => Promise<unknown>) => callback(target);
        return Reflect.get(target, property, receiver) as unknown;
      } }) as unknown as OicDatabaseService;
      const application = await tx.oicApplication.create({ data: { key: `OIC7TEST_${randomUUID().slice(0, 16)}`, displayName: "OIC-7 rollback fixture" } });
      const principal = await tx.oicServicePrincipal.create({ data: { applicationId: application.id, key: "oic7-registry-test", displayName: "OIC-7 registry test" } });
      const actor = { id: principal.id, applicationId: application.id, tenantIds: [], scopes: ["oic:evaluation:manage"] };
      const vault = new EvaluationArtifactVault(client);
      const scope = { applicationId: application.id, tenantId: null, exposureTier: "INTERNAL" };
      const input = await vault.store(Buffer.from("2 + 2"), { ...scope, purpose: "INPUT" }, principal.id);
      const oracle = await vault.store(Buffer.from("4"), { ...scope, purpose: "ORACLE" }, principal.id);
      const registry = new EvaluationService(client, vault);
      const pack = await registry.createPack(actor, {
        packKey: "deterministic-math", revision: 1, domain: "mathematics", license: "internal-fixture", targetClasses: ["BASE_MODEL"],
        environment: { kind: "DETERMINISTIC_REFERENCE", methodDigest: "a".repeat(64), networkPolicy: "DENY", timeoutMs: 1000 },
        suitePlan: { plannedRepetitions: 1, stoppingRule: "FIXED", samplingRevision: "fixed-v1", minimumEffectiveN: 1, requiredSlices: ["arithmetic"] },
        cases: [{ caseKey: "addition", taskType: "mathematics", language: "en", slices: ["arithmetic"], oracleMethod: "REFERENCE_EXACT_BYTES_V1", inputArtifact: { artifactId: input.id, digest: input.digest }, oracle: { artifactId: oracle.id, digest: oracle.digest }, sourceDigest: input.digest, oracleDigest: oracle.digest, rights: { confirmed: true, license: "internal-fixture", sourceRef: "fixture:addition", permittedUses: ["evaluation"], reviewedBy: principal.id, reviewedAt: "2026-10-12T00:00:00Z" } }]
      });
      const validated = await registry.validatePack(actor, pack.id);
      assert.equal(validated.status, "VALIDATED");
      assert.equal(evaluateObjectiveOracle(Buffer.from("4"), await vault.read(oracle.id, { ...scope, purpose: "ORACLE" })).success, true);
      const release = await registry.publishRelease(actor, { packId: pack.id, idempotencyKey: "registry-live-fixture-1", changelog: "Initial deterministic fixture" });
      assert.equal(release.status, "PUBLISHED");
      const stored = await tx.oicEvaluationRelease.findUnique({ where: { id: release.id }, include: { dataset: true, environment: true, suite: true } });
      assert.equal(stored?.dataset?.status, "PUBLISHED");
      assert.equal(stored?.environment?.status, "PUBLISHED");
      assert.equal(stored?.suite?.status, "PUBLISHED");
      throw new Error(rollback);
    }, { timeout: 30000 }), new RegExp(rollback));
  } finally {
    await db.$disconnect();
    if (previousKey === undefined) delete process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
    else process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = previousKey;
    if (previousVersion === undefined) delete process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION;
    else process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = previousVersion;
  }
});
