ALTER TABLE "OicEvaluationRecoveryGeneration"
  DROP CONSTRAINT "OicEvaluationRecoveryGeneration_workItem_key",
  DROP CONSTRAINT "OicEvaluationRecoveryGeneration_bounds_check",
  ADD CONSTRAINT "OicEvaluationRecoveryGeneration_bounds_check"
    CHECK ("generationOrdinal" BETWEEN 1 AND 2 AND "maxPhysicalAttempts" = 3 AND "usedPhysicalAttempts" BETWEEN 0 AND 3);

CREATE INDEX "OicEvaluationRecoveryGeneration_workItemId_generationOrdinal_idx"
  ON "OicEvaluationRecoveryGeneration"("workItemId", "generationOrdinal");
