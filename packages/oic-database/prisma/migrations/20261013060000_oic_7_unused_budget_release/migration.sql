ALTER TABLE "OicEvaluationRun"
  ADD COLUMN "budgetReleasedOiu" DECIMAL(38,18) NOT NULL DEFAULT 0;

ALTER TABLE "OicEvaluationCaseExecution"
  ADD COLUMN "unusedReservationReleasedOiu" DECIMAL(38,18) NOT NULL DEFAULT 0;

ALTER TABLE "OicEvaluationRun"
  ADD CONSTRAINT "OicEvaluationRun_budget_released_check" CHECK (
    "budgetReleasedOiu" >= 0 AND
    ("budgetReservationOiu" IS NULL AND "budgetReleasedOiu" = 0 OR
     "budgetReservationOiu" IS NOT NULL AND "budgetReleasedOiu" <= "budgetReservationOiu")
  );

ALTER TABLE "OicEvaluationCaseExecution"
  ADD CONSTRAINT "OicEvaluationCaseExecution_budget_released_check"
  CHECK ("unusedReservationReleasedOiu" >= 0);
