import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationService } from "./evaluation.service";

const applicationId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const publisherId = "863bc769-2a72-443e-9ad8-15618759059b";
const runnerId = "c73fcd8d-670c-4ca1-9f42-7a152418bd87";
const actor = { id: publisherId, applicationId, scopes: ["oic:evaluation:manage"], tenantIds: [] };
const caseRow = {
  id: "948bb9c9-420c-44c9-8bfd-3e75ca0d8d89", status: "PUBLISHED", exposureTier: "PRIVATE_HOLDOUT",
  sourceDigest: "a".repeat(64), oracleDigest: "b".repeat(64),
  rights: { sourceType: "FIRST_PARTY_SYNTHETIC", rightsBasis: "OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", reviewedBy: publisherId },
  oracle: { encryptedArtifactId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a1", digest: "b".repeat(64) },
  inputArtifact: { encryptedArtifactId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a2", digest: "a".repeat(64) }
};
const release = {
  id: "e336bc49-969a-4ffb-a7e2-d71cbecec676", applicationId, tenantId: null, packId: "6f20b0a5-b93a-4f99-ba1f-016a8672e1f5", status: "PUBLISHED", compromisedAt: null,
  releaseTier: "PRIVATE_HOLDOUT", createdBy: publisherId, manifestDigest: "c".repeat(64),
  pack: { createdBy: runnerId, manifestDigest: "d".repeat(64), cases: [caseRow] }
};

void test("independent publisher records bounded contamination review after exact local scan", async () => {
  const stages: string[] = [];
  let overlaps = 0;
  const db = {
    oicEvaluationRelease: { findFirst: () => Promise.resolve(release) },
    oicEvaluationValidationJob: { findFirst: () => Promise.resolve({ id: "validation-id" }) },
    oicAuditEvent: {
      findFirst: () => Promise.resolve(null),
      create: ({ data }: { data: { actorPrincipalId: string; metadata: Record<string, unknown> } }) => {
        stages.push("audit");
        assert.equal(data.actorPrincipalId, publisherId);
        assert.equal(data.metadata.localExactSourceOverlaps, 0);
        assert.equal(JSON.stringify(data).includes("SECRET_HIDDEN_REASONING_TEXT"), false);
        return Promise.resolve({ id: "review-id" });
      }
    },
    oicEvaluationCaseRevision: { count: () => { stages.push("scan"); return Promise.resolve(overlaps); } }
  };
  const artifacts = { verifyReference: (_id: string, _digest: string, scope: { purpose: string }) => { stages.push(scope.purpose); return Promise.resolve(); } };
  const service = new EvaluationService(db as never, artifacts as never);
  assert.deepEqual(await service.reviewReleaseContamination(actor, release.id), { releaseId: release.id, status: "REVIEWED_NO_KNOWN_LOCAL_OVERLAP", reviewId: "review-id" });
  assert.deepEqual(stages, ["ORACLE", "INPUT", "scan", "audit"]);
  stages.length = 0;
  overlaps = 1;
  await assert.rejects(service.reviewReleaseContamination(actor, release.id), /HOLDOUT_LOCAL_SOURCE_OVERLAP/);
  assert.deepEqual(stages, ["ORACLE", "INPUT", "scan"]);
  await assert.rejects(service.reviewReleaseContamination({ ...actor, id: runnerId }, release.id), /HOLDOUT_CONTAMINATION_REVIEW_INELIGIBLE/);
});
