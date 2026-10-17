import { ConflictException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import { EvaluationArtifactVault, openEvaluationArtifact } from "./artifact-vault";
import { evaluateObjectiveOracle, OBJECTIVE_ORACLE_METHOD } from "./objective-oracle";
import { decodeVisibleOutput } from "./visible-output-evidence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Internal sealed-output verifier. It never returns oracle bytes or accepts caller-supplied candidate bytes. */
@Injectable()
export class EvaluationSealedOracle {
  constructor(private readonly db: OicDatabaseService, private readonly artifacts: EvaluationArtifactVault) {}

  async verifyCaseExecution(caseExecutionId: string) {
    if (!UUID.test(caseExecutionId)) throw new ConflictException("ORACLE_CASE_ID_INVALID");
    const execution = await this.db.oicEvaluationCaseExecution.findUnique({
      where: { id: caseExecutionId },
      include: { run: { include: { manifest: { include: { release: true } } } }, attempts: { where: { status: "SUCCEEDED" }, select: { id: true, admissionId: true, artifactManifest: true, evidenceDigest: true } } }
    });
    if (!execution || execution.status !== "EXECUTED" || execution.attempts.length !== 1 || !execution.attempts[0]?.admissionId) throw new ConflictException("ORACLE_OUTPUT_NOT_FINAL");
    const run = execution.run;
    const release = run.manifest.release;
    if (release.status !== "PUBLISHED" || release.compromisedAt || release.id !== run.manifest.releaseId || release.applicationId !== run.applicationId || release.tenantId !== run.tenantId) throw new ConflictException("ORACLE_RELEASE_INVALID");
    const caseRevision = await this.db.oicEvaluationCaseRevision.findFirst({ where: { id: execution.caseRevisionId, applicationId: run.applicationId, tenantId: run.tenantId, status: "PUBLISHED" } });
    if (!caseRevision || caseRevision.oracleMethod !== OBJECTIVE_ORACLE_METHOD || !DIGEST.test(caseRevision.oracleDigest)) throw new ConflictException("ORACLE_CASE_INVALID");
    const releaseCase = Array.isArray(release.caseManifest) ? release.caseManifest.map(record).find((item) => item?.caseRevisionId === caseRevision.id) : null;
    if (!releaseCase || releaseCase.oracleHash !== caseRevision.oracleDigest || releaseCase.contentHash !== caseRevision.sourceDigest || releaseCase.exposureTier !== caseRevision.exposureTier || releaseCase.oracleMethod !== OBJECTIVE_ORACLE_METHOD) throw new ConflictException("ORACLE_RELEASE_CASE_MISMATCH");
    const attempt = execution.attempts[0];
    const admission = await this.db.oicAdmission.findFirst({ where: {
      id: attempt.admissionId!, applicationId: run.applicationId, tenantId: run.tenantId,
      idempotencyKey: `evaluation-attempt:${attempt.id}`, status: "SETTLED"
    }, select: { id: true } });
    if (!admission) throw new ConflictException("ORACLE_ADMISSION_UNSETTLED");
    const outcome = record(execution.outcome);
    const output = record(outcome?.output);
    const manifest = record(attempt.artifactManifest);
    const attemptOutput = record(manifest?.output);
    if (!output || !attemptOutput || JSON.stringify(output) !== JSON.stringify(attemptOutput) || outcome?.evidenceDigest !== attempt.evidenceDigest || typeof output.artifactId !== "string" || !UUID.test(output.artifactId) || typeof output.digest !== "string" || !DIGEST.test(output.digest) || output.exposureTier !== caseRevision.exposureTier || output.purpose !== "OUTPUT") throw new ConflictException("ORACLE_OUTPUT_EVIDENCE_INVALID");
    const oracleRef = record(caseRevision.oracle);
    const protectedTier = caseRevision.exposureTier === "PRIVATE_HOLDOUT" || caseRevision.exposureTier === "PROTECTED_CERTIFICATION";
    const oracleId = oracleRef?.[protectedTier ? "encryptedArtifactId" : "artifactId"];
    if (typeof oracleId !== "string" || !UUID.test(oracleId) || oracleRef?.digest !== caseRevision.oracleDigest) throw new ConflictException("ORACLE_REFERENCE_INVALID");
    const scope = { applicationId: run.applicationId, tenantId: run.tenantId, exposureTier: caseRevision.exposureTier };
    const outputArtifact = await this.artifacts.read(output.artifactId, { ...scope, purpose: "OUTPUT" });
    if (createHash("sha256").update(outputArtifact).digest("hex") !== output.digest) throw new ConflictException("ORACLE_OUTPUT_DIGEST_INVALID");
    let outputBytes: Buffer;
    try { outputBytes = decodeVisibleOutput(outputArtifact, output.encoding, attempt.id); }
    catch { throw new ConflictException("ORACLE_OUTPUT_ENCODING_INVALID"); }
    let result: ReturnType<typeof evaluateObjectiveOracle>;
    const executionEvidence = record(manifest?.execution);
    if (executionEvidence && !["SUCCEEDED", "TARGET_FAILED", "TIMEOUT", "RESOURCE_LIMIT"].includes(String(executionEvidence.status))) throw new ConflictException("ORACLE_EXECUTION_EVIDENCE_INVALID");
    if (executionEvidence && executionEvidence.status !== "SUCCEEDED") {
      result = { method: OBJECTIVE_ORACLE_METHOD, availability: "MEASURED", success: false, reason: "EXECUTION_FAILED" };
    } else {
      const sealedOracle = await this.db.oicEvaluationArtifact.findFirst({ where: { id: oracleId, ...scope, purpose: "ORACLE", digest: caseRevision.oracleDigest, status: "AVAILABLE" } });
      if (!sealedOracle) throw new ConflictException("ORACLE_ARTIFACT_UNAVAILABLE");
      const reference = openEvaluationArtifact({ ...sealedOracle, ciphertext: Buffer.from(sealedOracle.ciphertext) }, { ...scope, purpose: "ORACLE" });
      try { result = evaluateObjectiveOracle(outputBytes, reference); }
      finally { reference.fill(0); }
    }
    const evidenceDigest = createHash("sha256").update(JSON.stringify({ caseExecutionId, attemptId: attempt.id, outputDigest: output.digest, oracleDigest: caseRevision.oracleDigest, method: result.method, availability: result.availability, success: result.success, reason: result.reason })).digest("hex");
    return { ...result, evidenceDigest, caseExecutionId, attemptId: attempt.id };
  }
}
