CREATE OR REPLACE FUNCTION oic_7_guard_capacity_extension() RETURNS trigger AS $$
DECLARE base_policy "OicBudgetRevision"%ROWTYPE;
DECLARE supplement "OicBudgetRevision"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."applicationId" IS DISTINCT FROM OLD."applicationId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."campaignId" IS DISTINCT FROM OLD."campaignId" OR NEW."runId" IS DISTINCT FROM OLD."runId"
    OR NEW."baseBudgetRevisionId" IS DISTINCT FROM OLD."baseBudgetRevisionId" OR NEW."budgetRevisionId" IS DISTINCT FROM OLD."budgetRevisionId"
    OR NEW."cohortKey" IS DISTINCT FROM OLD."cohortKey" OR NEW."authorizedOiu" IS DISTINCT FROM OLD."authorizedOiu"
    OR NEW."perAdmissionLimitOiu" IS DISTINCT FROM OLD."perAdmissionLimitOiu" OR NEW."authorizationId" IS DISTINCT FROM OLD."authorizationId"
    OR NEW."reason" IS DISTINCT FROM OLD."reason" OR NEW."createdBy" IS DISTINCT FROM OLD."createdBy"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
  ) THEN RAISE EXCEPTION 'OIC-7 capacity extension identity is immutable'; END IF;

  SELECT * INTO base_policy FROM "OicBudgetRevision" WHERE "id" = NEW."baseBudgetRevisionId";
  SELECT * INTO supplement FROM "OicBudgetRevision" WHERE "id" = NEW."budgetRevisionId";
  IF NOT FOUND OR base_policy."applicationId" IS DISTINCT FROM NEW."applicationId"
      OR base_policy."tenantId" IS DISTINCT FROM NEW."tenantId"
      OR base_policy."unit"::text <> 'OIU' OR base_policy."enforcement"::text <> 'HARD'
      OR base_policy."unknownLiabilityRule"::text <> 'DENY'
      OR supplement."applicationId" IS DISTINCT FROM NEW."applicationId"
      OR supplement."tenantId" IS DISTINCT FROM NEW."tenantId"
      OR supplement."unit"::text <> 'OIU' OR supplement."enforcement"::text <> 'HARD'
      OR supplement."unknownLiabilityRule"::text <> 'DENY'
      OR supplement."amount" IS DISTINCT FROM NEW."authorizedOiu"
      OR supplement."reservationUpperBound" IS DISTINCT FROM NEW."perAdmissionLimitOiu"
      OR NEW."authorizedOiu" <> 1536 OR NEW."perAdmissionLimitOiu" <> 256
      OR supplement."safetyMargin" <> 0 OR supplement."effectiveTo" IS DISTINCT FROM NEW."expiresAt"
      OR NEW."expiresAt" <= NEW."createdAt"
      OR NOT EXISTS (
        SELECT 1 FROM "OicEvaluationCampaign" campaign
        JOIN "OicEvaluationRun" run ON run."campaignId" = campaign."id"
        JOIN "OicEvaluationProtocolManifest" manifest ON manifest."id" = run."manifestId"
        WHERE campaign."id" = NEW."campaignId" AND campaign."applicationId" = NEW."applicationId"
          AND campaign."tenantId" IS NOT DISTINCT FROM NEW."tenantId" AND run."id" = NEW."runId"
          AND manifest."payload"->'cohort'->>'cohortKey' = NEW."cohortKey"
      ) THEN RAISE EXCEPTION 'OIC-7 capacity extension does not match its frozen Packet 7.6 scope'; END IF;

  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "OicAuditEvent" event WHERE event."applicationId" = NEW."applicationId"
      AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
      AND event."action" = 'evaluation.packet76.capacity_extension.authorized'
      AND event."targetType" = 'evaluation-capacity-extension'
      AND event."metadata"->>'authorizationId' = NEW."authorizationId"
      AND event."metadata"->>'runId' = NEW."runId"::text
      AND event."metadata"->>'authorizedOiu' ~ '^[0-9]+(\.[0-9]+)?$'
      AND (event."metadata"->>'authorizedOiu')::numeric = NEW."authorizedOiu"
  ) THEN RAISE EXCEPTION 'OIC-7 capacity extension requires owner authorization audit provenance'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
