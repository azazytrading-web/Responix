-- Preserve immutable comparison evidence while allowing a corrected derived
-- projection from the same reports and statistical method revision.
ALTER TABLE "OicEvaluationComparison"
  ADD COLUMN "projectionRevision" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "OicEvaluationComparison_baselineReportId_candidateReportId__key";

CREATE UNIQUE INDEX "OicEvalComparison_pair_method_revision_uq"
  ON "OicEvaluationComparison"("baselineReportId", "candidateReportId", "methodRevision", "projectionRevision");
