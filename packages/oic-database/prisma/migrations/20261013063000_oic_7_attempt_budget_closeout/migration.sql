ALTER TABLE "OicEvaluationAttempt"
  ADD COLUMN "budgetReconciledAt" TIMESTAMPTZ(6),
  ADD COLUMN "budgetReleasedOiu" DECIMAL(38,18) NOT NULL DEFAULT 0;

ALTER TABLE "OicEvaluationAttempt"
  ADD CONSTRAINT "OicEvaluationAttempt_budget_release_check"
  CHECK ("budgetReleasedOiu" >= 0 AND ("budgetReconciledAt" IS NOT NULL OR "budgetReleasedOiu" = 0));

CREATE INDEX "OicEvaluationAttempt_budget_reconcile_idx"
  ON "OicEvaluationAttempt"("status", "budgetReconciledAt", "completedAt");

-- Retirement or expiry of a previously pinned policy must not strand safe
-- releases. Budget identity remains immutable and increases still require the
-- current published policy through the original guard below.
CREATE OR REPLACE FUNCTION oic_7_guard_campaign_budget() RETURNS trigger AS $$
DECLARE
  policy "OicBudgetRevision"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."budgetRevisionId" IS DISTINCT FROM OLD."budgetRevisionId"
    OR NEW."budgetLimitOiu" IS DISTINCT FROM OLD."budgetLimitOiu"
    OR NEW."reservationPerAttemptOiu" IS DISTINCT FROM OLD."reservationPerAttemptOiu"
    OR NEW."budgetPolicyDigest" IS DISTINCT FROM OLD."budgetPolicyDigest"
  ) THEN
    RAISE EXCEPTION 'OIC-7 campaign budget identity is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."reservedOiu" <= OLD."reservedOiu" THEN
    RETURN NEW;
  END IF;
  IF NEW."budgetRevisionId" IS NULL THEN
    IF NEW."budgetLimitOiu" IS NOT NULL OR NEW."reservationPerAttemptOiu" IS NOT NULL OR NEW."budgetPolicyDigest" IS NOT NULL OR NEW."reservedOiu" <> 0 THEN
      RAISE EXCEPTION 'OIC-7 campaign budget is incomplete';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO policy FROM "OicBudgetRevision" WHERE "id" = NEW."budgetRevisionId";
  IF NOT FOUND OR policy."applicationId" IS DISTINCT FROM NEW."applicationId"
      OR policy."tenantId" IS DISTINCT FROM NEW."tenantId"
      OR policy."status"::text <> 'PUBLISHED' OR policy."unit"::text <> 'OIU'
      OR policy."enforcement"::text <> 'HARD'
      OR policy."reservationUpperBound" IS NULL OR policy."reservationUpperBound" <= 0
      OR NEW."budgetLimitOiu" IS NULL OR NEW."budgetLimitOiu" <= 0
      OR NEW."budgetLimitOiu" > policy."amount"
      OR NEW."reservationPerAttemptOiu" IS DISTINCT FROM policy."reservationUpperBound"
      OR NEW."budgetPolicyDigest" IS DISTINCT FROM policy."sourceDigest" THEN
    RAISE EXCEPTION 'OIC-7 campaign budget policy is unavailable or mismatched';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
