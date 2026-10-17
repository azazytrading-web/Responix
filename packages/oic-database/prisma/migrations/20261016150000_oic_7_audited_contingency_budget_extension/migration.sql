CREATE OR REPLACE FUNCTION oic_7_guard_run_budget_reservation() RETURNS trigger AS $$
DECLARE
  contingency jsonb;
  extension numeric;
  audit_count integer;
BEGIN
  IF NEW."budgetReservationOiu" IS NOT DISTINCT FROM OLD."budgetReservationOiu" THEN
    RETURN NEW;
  END IF;

  IF OLD."budgetReservationOiu" IS NULL
      OR NEW."budgetReservationOiu" IS NULL
      OR NEW."budgetReservationOiu" <= OLD."budgetReservationOiu"
      OR NEW."status" <> 'RUNNING'
      OR OLD."status" NOT IN ('PARTIAL', 'INCONCLUSIVE') THEN
    RAISE EXCEPTION 'OIC-7 run budget reservation is immutable outside an audited contingency';
  END IF;

  SELECT event."metadata" INTO contingency
  FROM "OicAuditEvent" event
  WHERE event."applicationId" = NEW."applicationId"
    AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
    AND event."action" = 'evaluation.case.contingency.requested'
    AND event."targetType" = 'evaluation-case'
    AND event."metadata"->>'runId' = NEW."id"::text
  ORDER BY event."occurredAt" DESC
  LIMIT 1;

  IF contingency IS NULL THEN
    RAISE EXCEPTION 'OIC-7 reservation extension requires a contingency audit record';
  END IF;

  BEGIN
    extension := (contingency->>'reservedOiu')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'OIC-7 contingency reservation amount is invalid';
  END;

  SELECT COUNT(*) INTO audit_count
  FROM "OicAuditEvent" event
  WHERE event."applicationId" = NEW."applicationId"
    AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
    AND event."action" = 'evaluation.case.contingency.requested'
    AND event."targetType" = 'evaluation-case'
    AND event."metadata"->>'runId' = NEW."id"::text;

  IF extension <= 0
      OR NEW."budgetReservationOiu" - OLD."budgetReservationOiu" <> extension
      OR contingency->>'providerAttemptCountBeforeReplacement' <> '0'
      OR contingency->>'originalAttemptId' IS NULL
      OR contingency->>'admissionId' IS NULL
      OR audit_count <> 1
      OR NEW."budgetReleasedOiu" > NEW."budgetReservationOiu"
      OR NOT EXISTS (
        SELECT 1
        FROM "OicEvaluationCaseExecution" execution
        JOIN "OicEvaluationAttempt" attempt ON attempt."caseExecutionId" = execution."id"
        JOIN "OicAdmission" admission ON admission."id" = attempt."admissionId"
        JOIN "OicEvaluationCampaign" campaign ON campaign."id" = NEW."campaignId"
        JOIN "OicBudgetRevision" budget ON budget."id" = campaign."budgetRevisionId"
        WHERE execution."id"::text = (
            SELECT event."targetId"
            FROM "OicAuditEvent" event
            WHERE event."applicationId" = NEW."applicationId"
              AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
              AND event."action" = 'evaluation.case.contingency.requested'
              AND event."targetType" = 'evaluation-case'
              AND event."metadata"->>'runId' = NEW."id"::text
            LIMIT 1
          )
          AND execution."runId" = NEW."id"
          AND attempt."id"::text = contingency->>'originalAttemptId'
          AND attempt."status" = 'INFRA_FAILURE'
          AND attempt."failureClass" = 'RUNTIME_UNAVAILABLE'
          AND attempt."artifactManifest" IS NULL
          AND attempt."evidenceDigest" IS NULL
          AND attempt."budgetReconciledAt" IS NOT NULL
          AND attempt."budgetReleasedOiu" = extension
          AND admission."id"::text = contingency->>'admissionId'
          AND admission."status"::text = 'RELEASED'
          AND campaign."id" = NEW."campaignId"
          AND campaign."applicationId" = NEW."applicationId"
          AND campaign."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
          AND campaign."status" = 'ACTIVE'
          AND campaign."reservedOiu" >= extension
          AND campaign."reservationPerAttemptOiu" = extension
          AND budget."status"::text = 'PUBLISHED'
          AND budget."unit"::text = 'OIU'
          AND budget."enforcement"::text = 'HARD'
          AND budget."unknownLiabilityRule"::text = 'DENY'
          AND budget."reservationUpperBound" = extension
          AND NOT EXISTS (SELECT 1 FROM "OicProviderAttempt" providerAttempt WHERE providerAttempt."admissionId" = admission."id")
          AND NOT EXISTS (SELECT 1 FROM "OicReservationLeg" leg WHERE leg."admissionId" = admission."id" AND leg."state"::text <> 'RELEASED')
      ) THEN
    RAISE EXCEPTION 'OIC-7 reservation extension is not backed by one fully reconciled no-dispatch contingency';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
