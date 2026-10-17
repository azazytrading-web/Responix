CREATE OR REPLACE FUNCTION oic_7_guard_run_budget_reservation() RETURNS trigger AS $$
DECLARE
  contingency jsonb;
  reconciliation jsonb;
  extension numeric;
  audit_count integer;
  reconciliation_count integer;
  reconciliation_revision bigint;
  latest_reconciliation_revision bigint;
  reconciliation_valid boolean := false;
BEGIN
  IF NEW."budgetReservationOiu" IS NOT DISTINCT FROM OLD."budgetReservationOiu" THEN
    RETURN NEW;
  END IF;

  -- A run aggregate can be repaired only from a canonical reconciliation audit
  -- inserted earlier in the same transaction. The immutable OIC-6 admissions
  -- and postings are never changed by this exception.
  SELECT event."metadata" INTO reconciliation
  FROM "OicAuditEvent" event
  WHERE event."applicationId" = NEW."applicationId"
    AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
    AND event."action" = 'evaluation.budget.run_aggregate_reconciled'
    AND event."targetType" = 'evaluation-run'
    AND event."targetId" = NEW."id"::text
    AND event."actorPrincipalId" IS NOT NULL
    AND event."occurredAt" >= transaction_timestamp()
    AND event."metadata"->>'reason' = 'PACKET76_IMMUTABLE_OIC6_ADMISSION_LEDGER_RECOMPUTE'
    AND event."metadata"->>'ledger' = 'OIC6_IMMUTABLE_ADMISSION_POSTINGS'
  ORDER BY event."occurredAt" DESC
  LIMIT 1;

  IF reconciliation IS NOT NULL
      AND reconciliation->>'ledgerBasisDigest' ~ '^[a-f0-9]{64}$'
      AND reconciliation->>'admissionCount' ~ '^[1-9][0-9]*$'
      AND reconciliation->>'reconciliationRevision' ~ '^[1-9][0-9]*$'
      AND reconciliation->'funding' IS NOT NULL
      AND reconciliation->'previousAggregate'->>'reservedOiu' ~ '^[0-9]+(\.[0-9]+)?$'
      AND reconciliation->'previousAggregate'->>'releasedOiu' ~ '^[0-9]+(\.[0-9]+)?$'
      AND reconciliation->'recomputedAggregate'->>'reservedOiu' ~ '^[0-9]+(\.[0-9]+)?$'
      AND reconciliation->'recomputedAggregate'->>'releasedOiu' ~ '^[0-9]+(\.[0-9]+)?$'
      AND reconciliation->'recomputedAggregate'->>'consumedOiu' ~ '^[0-9]+(\.[0-9]+)?$' THEN
    BEGIN
      reconciliation_revision := (reconciliation->>'reconciliationRevision')::bigint;
      reconciliation_valid :=
        (reconciliation->'previousAggregate'->>'reservedOiu')::numeric IS NOT DISTINCT FROM OLD."budgetReservationOiu"
        AND (reconciliation->'previousAggregate'->>'releasedOiu')::numeric IS NOT DISTINCT FROM OLD."budgetReleasedOiu"
        AND (reconciliation->'recomputedAggregate'->>'reservedOiu')::numeric IS NOT DISTINCT FROM NEW."budgetReservationOiu"
        AND (reconciliation->'recomputedAggregate'->>'releasedOiu')::numeric IS NOT DISTINCT FROM NEW."budgetReleasedOiu"
        AND (reconciliation->'recomputedAggregate'->>'reservedOiu')::numeric =
            (reconciliation->'recomputedAggregate'->>'releasedOiu')::numeric + (reconciliation->'recomputedAggregate'->>'consumedOiu')::numeric;
    EXCEPTION WHEN OTHERS THEN
      reconciliation_valid := false;
    END;
  END IF;

  IF reconciliation_valid THEN
    SELECT COUNT(*) INTO reconciliation_count
    FROM "OicAuditEvent" event
    WHERE event."applicationId" = NEW."applicationId"
      AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
      AND event."action" = 'evaluation.budget.run_aggregate_reconciled'
      AND event."targetType" = 'evaluation-run'
      AND event."targetId" = NEW."id"::text
      AND event."occurredAt" >= transaction_timestamp()
      AND event."metadata"->>'reason' = 'PACKET76_IMMUTABLE_OIC6_ADMISSION_LEDGER_RECOMPUTE'
      AND event."metadata"->>'reconciliationRevision' = reconciliation->>'reconciliationRevision';

    SELECT COALESCE(MAX((event."metadata"->>'reconciliationRevision')::bigint), 0) INTO latest_reconciliation_revision
    FROM "OicAuditEvent" event
    WHERE event."applicationId" = NEW."applicationId"
      AND event."action" = 'evaluation.budget.run_aggregate_reconciled'
      AND event."targetType" = 'evaluation-run'
      AND event."targetId" = NEW."id"::text
      AND event."metadata"->>'reconciliationRevision' ~ '^[1-9][0-9]*$';

    IF reconciliation_count = 1 AND reconciliation_revision = latest_reconciliation_revision THEN
      RETURN NEW;
    END IF;
  END IF;

  -- One exact Packet 7.6 successor slot may re-reserve its already-authorized
  -- per-admission envelope after a proven no-admission pre-dispatch failure.
  SELECT event."metadata" INTO contingency
  FROM "OicAuditEvent" event
  WHERE event."applicationId" = NEW."applicationId"
    AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
    AND event."action" = 'evaluation.packet76.successor.pre_dispatch_resumed'
    AND event."targetType" = 'evaluation-case'
    AND event."targetId" = event."metadata"->>'caseExecutionId'
    AND event."metadata"->>'runId' = NEW."id"::text
    AND event."metadata"->>'withinExistingAuthorization' = 'true'
    AND event."metadata"->>'additionalBudgetReserved' = 'true'
    AND event."metadata"->>'reservedOiu' = '256'
    AND event."actorPrincipalId" IS NOT NULL
    AND event."occurredAt" >= transaction_timestamp()
  ORDER BY event."occurredAt" DESC
  LIMIT 1;

  IF contingency IS NOT NULL THEN
    extension := 256;
    IF NEW."id" <> '733615b4-15c7-42a9-a247-1e24b4218ae7'::uuid
      OR NEW."applicationId" <> '7f25c69e-bdbb-4949-ad7b-ef6412119850'::uuid
      OR NEW."campaignId" <> 'fc8a3bc9-ae98-4f22-b26c-77c23a690d39'::uuid
      OR NEW."manifestId" <> '9a16d64f-ea1f-4ae2-b50d-35fefc30d0c0'::uuid
      OR OLD."status" <> 'PARTIAL'
      OR NEW."status" <> 'RUNNING'
      OR NEW."budgetReservationOiu" - OLD."budgetReservationOiu" <> extension
      OR NEW."budgetReservationOiu" > 768
      OR NEW."budgetReleasedOiu" > NEW."budgetReservationOiu"
      OR contingency->>'previousFailureClass' <> 'PACKET76_CAPACITY_EXTENSION_UNAVAILABLE'
      OR contingency->>'previousFailureStage' <> 'ADMISSION_PREFLIGHT'
      OR contingency->>'caseExecutionId' IS NULL
      OR contingency->>'caseExecutionId' <> 'dc8e6390-9a05-42e0-93b0-870067bfb2a4'
      OR contingency->>'providerDispatchOccurredBeforeResume' <> 'false'
      OR contingency->>'priorAdmissionPresent' <> 'false'
      OR contingency->>'maxPhysicalAttemptsAfterResume' <> '2'
      OR contingency->>'repetitionOrdinal' <> '2'
      OR contingency->>'cohortKey' <> 'packet76-cohort-20261016-v1'
      OR contingency->>'pairKey' <> 'pair-2'
      OR NOT EXISTS (
        SELECT 1
        FROM "OicEvaluationCampaign" campaign
        JOIN "OicBudgetRevision" budget ON budget."id" = campaign."budgetRevisionId"
        JOIN "OicPlanRevision" planRevision ON planRevision."id" = budget."planRevisionId"
        WHERE campaign."id" = NEW."campaignId"
          AND campaign."applicationId" = NEW."applicationId"
          AND campaign."tenantId" IS NULL
          AND campaign."status" = 'ACTIVE'
          AND campaign."budgetRevisionId" = 'e87bf0a7-571a-47b3-b567-137f3ad042d5'::uuid
          AND campaign."budgetLimitOiu" = 768
          AND campaign."reservationPerAttemptOiu" = extension
          AND campaign."reservedOiu" <= campaign."budgetLimitOiu"
          AND budget."status" = 'PUBLISHED'
          AND budget."unit" = 'OIU'
          AND budget."enforcement" = 'HARD'
          AND budget."unknownLiabilityRule" = 'DENY'
          AND budget."amount" = 768
          AND budget."reservationUpperBound" = extension
          AND budget."effectiveFrom" <= transaction_timestamp()
          AND budget."effectiveTo" > transaction_timestamp()
          AND budget."planRevisionId" = '8b7e4ad4-01cd-4909-8e9c-83cf3dc03771'::uuid
          AND planRevision."status" = 'PUBLISHED'
          AND planRevision."effectiveFrom" <= transaction_timestamp()
          AND planRevision."effectiveTo" > transaction_timestamp()
      )
      OR NOT EXISTS (
        SELECT 1
        FROM "OicEvaluationCaseExecution" execution
        JOIN "OicEvaluationAttempt" failedAttempt ON failedAttempt."id"::text = contingency->>'previousAttemptId'
        JOIN "OicEvaluationWorkItem" work ON work."caseExecutionId" = execution."id"
        WHERE execution."id"::text = contingency->>'caseExecutionId'
          AND execution."runId" = NEW."id"
          AND execution."repetitionOrdinal" = 2
          AND execution."status" = 'FAILED'
          AND work."runId" = NEW."id"
          AND work."status" = 'FAILED'
          AND work."attemptCount" = 1
          AND work."maxAttempts" = 1
          AND failedAttempt."caseExecutionId" = execution."id"
          AND failedAttempt."attemptOrdinal" = 1
          AND failedAttempt."status" = 'INFRA_FAILURE'
          AND failedAttempt."failureClass" = 'PACKET76_CAPACITY_EXTENSION_UNAVAILABLE'
          AND failedAttempt."failureStage" = 'ADMISSION_PREFLIGHT'
          AND failedAttempt."safeErrorCode" = 'PACKET76_CAPACITY_EXTENSION_UNAVAILABLE'
          AND failedAttempt."admissionId" IS NULL
          AND failedAttempt."providerAttemptId" IS NULL
          AND failedAttempt."providerDispatchStartedAt" IS NULL
          AND failedAttempt."artifactManifest" IS NULL
          AND failedAttempt."evidenceDigest" IS NULL
          AND failedAttempt."budgetReconciledAt" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "OicAdmission" admission WHERE admission."applicationId" = NEW."applicationId" AND admission."tenantId" IS NULL AND admission."idempotencyKey" = ('evaluation-attempt:' || failedAttempt."id"::text))
          AND NOT EXISTS (SELECT 1 FROM "OicProviderAttempt" providerAttempt WHERE providerAttempt."applicationId" = NEW."applicationId" AND providerAttempt."tenantId" IS NULL AND (providerAttempt."admissionId" IN (SELECT admission."id" FROM "OicAdmission" admission WHERE admission."idempotencyKey" = ('evaluation-attempt:' || failedAttempt."id"::text)) OR providerAttempt."requestId" = ('evaluation-' || failedAttempt."id"::text)))
      )
      OR NOT EXISTS (
        SELECT 1
        FROM "OicEvaluationCaseExecution" firstExecution
        JOIN "OicEvaluationAttempt" firstAttempt ON firstAttempt."caseExecutionId" = firstExecution."id"
        JOIN "OicAdmission" firstAdmission ON firstAdmission."id" = firstAttempt."admissionId"
        JOIN "OicReservationLeg" leg ON leg."admissionId" = firstAdmission."id"
        JOIN "OicQuotaBucket" bucket ON bucket."id" = leg."bucketId"
        JOIN "OicProviderAttempt" providerAttempt ON providerAttempt."admissionId" = firstAdmission."id"
        WHERE firstExecution."runId" = NEW."id"
          AND firstExecution."repetitionOrdinal" = 1
          AND firstExecution."status" = 'EXECUTED'
          AND firstAttempt."status" = 'SUCCEEDED'
          AND firstAttempt."budgetReconciledAt" IS NOT NULL
          AND firstAttempt."evidenceDigest" IS NOT NULL
          AND firstAdmission."status" = 'SETTLED'
          AND leg."state" = 'SETTLED'
          AND leg."budgetRevisionId" = 'e87bf0a7-571a-47b3-b567-137f3ad042d5'::uuid
          AND bucket."unit" = 'OIU'
          AND providerAttempt."status" = 'SUCCEEDED'
          AND providerAttempt."usageStatus" = 'REPORTED'
          AND providerAttempt."providerKey" = 'openai-compatible'
          AND providerAttempt."upstreamModelId" = 'deepseek-flash'
          AND providerAttempt."bindingId" = 'ada73ca7-ca5c-4b30-bae6-80c221b3eab4'::uuid
          AND providerAttempt."connectionId" = 'bc113c1b-e8fc-4a0b-9bda-8428a94f3005'::uuid
          AND (SELECT COUNT(*) FROM "OicProviderAttempt" dispatched WHERE dispatched."admissionId" = firstAdmission."id") = 1
      ) THEN
      RAISE EXCEPTION 'OIC-7 successor resume is not backed by the exact authorized pre-dispatch recovery';
    END IF;
    RETURN NEW;
  END IF;
  -- Preserve the existing narrowly audited contingency path unchanged.
  IF OLD."budgetReservationOiu" IS NULL
      OR NEW."budgetReservationOiu" IS NULL
      OR NEW."budgetReservationOiu" <= OLD."budgetReservationOiu"
      OR NEW."status" <> 'RUNNING'
      OR OLD."status" NOT IN ('PARTIAL', 'INCONCLUSIVE') THEN
    RAISE EXCEPTION 'OIC-7 run budget reservation is immutable outside an audited contingency or ledger reconciliation';
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
