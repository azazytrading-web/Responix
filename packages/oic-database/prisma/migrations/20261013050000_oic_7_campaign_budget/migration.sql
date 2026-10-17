ALTER TABLE "OicEvaluationCampaign"
  ADD COLUMN "budgetRevisionId" UUID,
  ADD COLUMN "budgetLimitOiu" DECIMAL(38,18),
  ADD COLUMN "reservationPerAttemptOiu" DECIMAL(38,18),
  ADD COLUMN "reservedOiu" DECIMAL(38,18) NOT NULL DEFAULT 0,
  ADD COLUMN "budgetPolicyDigest" CHAR(64);

ALTER TABLE "OicEvaluationRun"
  ADD COLUMN "budgetReservationOiu" DECIMAL(38,18);

ALTER TABLE "OicEvaluationCampaign"
  ADD CONSTRAINT "OicEvaluationCampaign_budgetRevisionId_fkey"
  FOREIGN KEY ("budgetRevisionId") REFERENCES "OicBudgetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OicEvaluationCampaign"
  ADD CONSTRAINT "OicEvaluationCampaign_budget_bounds_check" CHECK (
    "reservedOiu" >= 0
    AND ("budgetLimitOiu" IS NULL OR "budgetLimitOiu" > 0)
    AND ("reservationPerAttemptOiu" IS NULL OR "reservationPerAttemptOiu" > 0)
    AND ("budgetLimitOiu" IS NULL OR "reservedOiu" <= "budgetLimitOiu")
  );

ALTER TABLE "OicEvaluationRun"
  ADD CONSTRAINT "OicEvaluationRun_budget_reservation_check" CHECK (
    "budgetReservationOiu" IS NULL OR "budgetReservationOiu" > 0
  );

CREATE INDEX "OicEvaluationCampaign_budgetRevisionId_idx"
  ON "OicEvaluationCampaign"("budgetRevisionId");

CREATE OR REPLACE FUNCTION oic_7_guard_campaign_budget() RETURNS trigger AS $$
DECLARE
  policy "OicBudgetRevision"%ROWTYPE;
BEGIN
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

CREATE TRIGGER oic_7_campaign_budget_guard
BEFORE INSERT OR UPDATE OF "budgetRevisionId", "budgetLimitOiu", "reservationPerAttemptOiu", "reservedOiu", "budgetPolicyDigest"
ON "OicEvaluationCampaign"
FOR EACH ROW EXECUTE FUNCTION oic_7_guard_campaign_budget();
