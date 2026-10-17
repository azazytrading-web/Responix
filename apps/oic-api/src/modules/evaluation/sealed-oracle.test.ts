import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EvaluationSealedOracle } from "./sealed-oracle";
import { sealEvaluationArtifact } from "./artifact-vault";
import { EMPTY_VISIBLE_OUTPUT_ENCODING, encodeEmptyVisibleOutput } from "./visible-output-evidence";

const ids = {
  application: "c8b49b66-a9a9-4edf-b955-ef5084ea46a3",
  case: "c8b49b66-a9a9-4edf-b955-ef5084ea46a5",
  caseRevision: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6",
  release: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7",
  attempt: "c8b49b66-a9a9-4edf-b955-ef5084ea46a8",
  admission: "c8b49b66-a9a9-4edf-b955-ef5084ea46a9"
};

void test("sealed oracle compares persisted output without returning protected reference bytes", async () => {
  const previous = process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
  const previousVersion = process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION;
  process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = "4a".repeat(32);
  process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = "2";
  try {
    const reference = Buffer.from("SYNTHETIC_PRIVATE_ANSWER", "utf8");
    const oracle = sealEvaluationArtifact(reference, { applicationId: ids.application, tenantId: null, exposureTier: "PRIVATE_HOLDOUT", purpose: "ORACLE" });
    const output: { artifactId: string; digest: string; purpose: string; exposureTier: string; encoding?: string } = { artifactId: "c8b49b66-a9a9-4edf-b955-ef5084ea46aa", digest: createHash("sha256").update(reference).digest("hex"), purpose: "OUTPUT", exposureTier: "PRIVATE_HOLDOUT" };
    const attemptManifest: { output: typeof output; execution?: { status: string } } = { output };
    const caseRevision = {
      id: ids.caseRevision, sourceDigest: "b".repeat(64), oracleDigest: oracle.digest,
      oracleMethod: "REFERENCE_EXACT_BYTES_V1", exposureTier: "PRIVATE_HOLDOUT",
      oracle: { encryptedArtifactId: oracle.id, digest: oracle.digest }
    };
    const execution = {
      id: ids.case, status: "EXECUTED", caseRevisionId: ids.caseRevision,
      outcome: { output, evidenceDigest: "c".repeat(64) },
      attempts: [{ id: ids.attempt, admissionId: ids.admission, artifactManifest: attemptManifest, evidenceDigest: "c".repeat(64) }],
      run: { applicationId: ids.application, tenantId: null, manifest: { releaseId: ids.release, release: {
        id: ids.release, applicationId: ids.application, tenantId: null, status: "PUBLISHED", compromisedAt: null,
        caseManifest: [{ caseRevisionId: ids.caseRevision, contentHash: caseRevision.sourceDigest, oracleHash: oracle.digest, exposureTier: "PRIVATE_HOLDOUT", oracleMethod: "REFERENCE_EXACT_BYTES_V1" }]
      } } }
    };
    const reads: string[] = [];
    let artifactBytes: Buffer = reference;
    const vault = { read: (id: string, scope: { purpose: string }) => {
      reads.push(scope.purpose);
      assert.equal(id, output.artifactId);
      assert.equal(scope.purpose, "OUTPUT");
      return Promise.resolve(artifactBytes);
    } };
    let settled = true;
    let oracleReads = 0;
    const db = {
      oicEvaluationCaseExecution: { findUnique: () => Promise.resolve(execution) },
      oicEvaluationCaseRevision: { findFirst: () => Promise.resolve(caseRevision) },
      oicAdmission: { findFirst: () => Promise.resolve(settled ? { id: ids.admission } : null) },
      oicEvaluationArtifact: { findFirst: ({ where }: { where: { purpose: string; id: string } }) => {
        oracleReads += 1;
        assert.equal(where.purpose, "ORACLE");
        assert.equal(where.id, oracle.id);
        return Promise.resolve(oracle);
      } }
    };
    const verifier = new EvaluationSealedOracle(db as never, vault as never);
    const result = await verifier.verifyCaseExecution(ids.case);
    assert.equal(result.success, true);
    assert.equal(result.availability, "MEASURED");
    assert.deepEqual(reads, ["OUTPUT"]);
    assert.equal(JSON.stringify(result).includes(reference.toString("utf8")), false);
    artifactBytes = encodeEmptyVisibleOutput(ids.attempt);
    output.digest = createHash("sha256").update(artifactBytes).digest("hex");
    output.encoding = EMPTY_VISIBLE_OUTPUT_ENCODING;
    const emptyResult = await verifier.verifyCaseExecution(ids.case);
    assert.equal(emptyResult.availability, "MEASURED");
    assert.equal(emptyResult.success, false);
    assert.equal(emptyResult.reason, "MISMATCH");
    assert.equal(JSON.stringify(emptyResult).includes(reference.toString("utf8")), false);
    attemptManifest.execution = { status: "TARGET_FAILED" };
    const failedExecution = await verifier.verifyCaseExecution(ids.case);
    assert.equal(failedExecution.success, false);
    assert.equal(failedExecution.reason, "EXECUTION_FAILED");
    assert.equal(oracleReads, 2, "failed executable output must not probe protected truth");
    delete attemptManifest.execution;
    settled = false;
    await assert.rejects(verifier.verifyCaseExecution(ids.case), /ORACLE_ADMISSION_UNSETTLED/);
    settled = true;
    execution.outcome.output = { ...output, digest: "d".repeat(64) };
    await assert.rejects(verifier.verifyCaseExecution(ids.case), /ORACLE_OUTPUT_EVIDENCE_INVALID/);
  } finally {
    if (previous === undefined) delete process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
    else process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = previous;
    if (previousVersion === undefined) delete process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION;
    else process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = previousVersion;
  }
});
