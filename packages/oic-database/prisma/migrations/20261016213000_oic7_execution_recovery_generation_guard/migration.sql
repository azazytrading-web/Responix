CREATE OR REPLACE FUNCTION oic_7_guard_recovery_generation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."applicationId" IS DISTINCT FROM OLD."applicationId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."runId" IS DISTINCT FROM OLD."runId" OR NEW."workItemId" IS DISTINCT FROM OLD."workItemId"
    OR NEW."cohortKey" IS DISTINCT FROM OLD."cohortKey" OR NEW."pairKey" IS DISTINCT FROM OLD."pairKey"
    OR NEW."repetitionOrdinal" IS DISTINCT FROM OLD."repetitionOrdinal" OR NEW."previousAttemptId" IS DISTINCT FROM OLD."previousAttemptId"
    OR NEW."generationOrdinal" IS DISTINCT FROM OLD."generationOrdinal" OR NEW."maxPhysicalAttempts" IS DISTINCT FROM OLD."maxPhysicalAttempts"
    OR NEW."authorizationId" IS DISTINCT FROM OLD."authorizationId" OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."createdBy" IS DISTINCT FROM OLD."createdBy" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR NEW."usedPhysicalAttempts" < OLD."usedPhysicalAttempts"
  ) THEN RAISE EXCEPTION 'OIC-7 recovery generation provenance is immutable'; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."generationOrdinal" = 1 AND NEW."authorizationId" = 'OIC7_PACKET76_RECOVERY_GENERATION_V1' THEN
      IF NOT EXISTS (
        SELECT 1 FROM "OicEvaluationWorkItem" work
        JOIN "OicEvaluationRun" run ON run."id" = work."runId"
        JOIN "OicEvaluationCaseExecution" execution ON execution."id" = work."caseExecutionId"
        JOIN "OicEvaluationAttempt" attempt ON attempt."id" = NEW."previousAttemptId" AND attempt."caseExecutionId" = execution."id"
        JOIN "OicEvaluationProtocolManifest" manifest ON manifest."id" = run."manifestId"
        WHERE work."id" = NEW."workItemId" AND work."applicationId" = NEW."applicationId"
          AND work."tenantId" IS NOT DISTINCT FROM NEW."tenantId" AND work."runId" = NEW."runId"
          AND work."status" = 'FAILED' AND work."attemptCount" = 5 AND work."maxAttempts" = 5
          AND execution."status" IN ('FAILED','INCONCLUSIVE') AND attempt."attemptOrdinal" = 5
          AND attempt."status" = 'INFRA_FAILURE' AND attempt."admissionId" IS NULL
          AND attempt."providerAttemptId" IS NULL AND attempt."providerDispatchStartedAt" IS NULL
          AND attempt."artifactManifest" IS NULL AND attempt."evidenceDigest" IS NULL
          AND run."applicationId" = NEW."applicationId" AND run."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
          AND manifest."payload"->'cohort'->>'cohortKey' = NEW."cohortKey"
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(manifest."payload"->'cohort'->'slots') slot
            WHERE slot->>'caseRevisionId' = execution."caseRevisionId"::text
              AND (slot->>'repetitionOrdinal')::integer = NEW."repetitionOrdinal"
              AND slot->>'pairKey' = NEW."pairKey")
      ) THEN RAISE EXCEPTION 'OIC-7 first recovery generation source is ineligible'; END IF;
    ELSIF NEW."generationOrdinal" = 2 AND NEW."authorizationId" = 'OIC7_PACKET76_EXECUTION_RECOVERY_GENERATION_V2' THEN
      IF NOT EXISTS (
        SELECT 1 FROM "OicEvaluationWorkItem" work
        JOIN "OicEvaluationRun" run ON run."id" = work."runId"
        JOIN "OicEvaluationCaseExecution" execution ON execution."id" = work."caseExecutionId"
        JOIN "OicEvaluationAttempt" attempt ON attempt."id" = NEW."previousAttemptId" AND attempt."caseExecutionId" = execution."id"
        JOIN "OicEvaluationProtocolManifest" manifest ON manifest."id" = run."manifestId"
        JOIN "OicEvaluationRecoveryGeneration" prior ON prior."workItemId" = work."id"
          AND prior."runId" = run."id" AND prior."cohortKey" = NEW."cohortKey" AND prior."generationOrdinal" = 1
        WHERE work."id" = NEW."workItemId" AND work."applicationId" = NEW."applicationId"
          AND work."tenantId" IS NOT DISTINCT FROM NEW."tenantId" AND work."runId" = NEW."runId"
          AND work."status" = 'FAILED' AND work."attemptCount" = 8 AND work."maxAttempts" = 8
          AND execution."status" IN ('FAILED','INCONCLUSIVE') AND attempt."attemptOrdinal" = 8
          AND attempt."status" = 'INFRA_FAILURE' AND attempt."completedAt" IS NOT NULL
          AND attempt."recoveryGenerationId" = prior."id" AND attempt."recoveryOrdinal" = 3
          AND attempt."admissionId" IS NULL AND attempt."providerAttemptId" IS NULL AND attempt."providerDispatchStartedAt" IS NULL
          AND attempt."artifactManifest" IS NULL AND attempt."evidenceDigest" IS NULL
          AND prior."status" = 'EXHAUSTED' AND prior."usedPhysicalAttempts" = 3 AND prior."maxPhysicalAttempts" = 3
          AND prior."previousAttemptId" = (SELECT anchor."id" FROM "OicEvaluationAttempt" anchor WHERE anchor."caseExecutionId" = execution."id" AND anchor."attemptOrdinal" = 5)
          AND (SELECT count(*) FROM "OicEvaluationAttempt" physical WHERE physical."caseExecutionId" = execution."id") = 8
          AND (SELECT count(*) FROM "OicEvaluationAttempt" physical WHERE physical."caseExecutionId" = execution."id" AND physical."status" = 'INFRA_FAILURE' AND physical."completedAt" IS NOT NULL) = 8
          AND (SELECT count(*) FROM "OicEvaluationAttempt" physical WHERE physical."caseExecutionId" = execution."id" AND physical."recoveryGenerationId" = prior."id" AND physical."recoveryOrdinal" BETWEEN 1 AND 3 AND physical."attemptOrdinal" BETWEEN 6 AND 8 AND physical."status" = 'INFRA_FAILURE') = 3
          AND run."applicationId" = NEW."applicationId" AND run."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
          AND manifest."payload"->'cohort'->>'cohortKey' = NEW."cohortKey"
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(manifest."payload"->'cohort'->'slots') slot
            WHERE slot->>'caseRevisionId' = execution."caseRevisionId"::text
              AND (slot->>'repetitionOrdinal')::integer = NEW."repetitionOrdinal"
              AND slot->>'pairKey' = NEW."pairKey")
      ) THEN RAISE EXCEPTION 'OIC-7 execution recovery generation source is ineligible'; END IF;
    ELSE
      RAISE EXCEPTION 'OIC-7 recovery generation authorization is invalid';
    END IF;

    IF EXISTS (
      SELECT 1 FROM "OicEvaluationAttempt" physical
      LEFT JOIN "OicAdmission" admission ON admission."id" = physical."admissionId"
      WHERE physical."caseExecutionId" = (SELECT "caseExecutionId" FROM "OicEvaluationWorkItem" WHERE "id" = NEW."workItemId")
        AND (physical."providerAttemptId" IS NOT NULL OR physical."providerDispatchStartedAt" IS NOT NULL
          OR physical."artifactManifest" IS NOT NULL OR physical."evidenceDigest" IS NOT NULL
          OR (physical."admissionId" IS NOT NULL AND (admission."status"::text <> 'RELEASED'
            OR EXISTS (SELECT 1 FROM "OicProviderAttempt" provider WHERE provider."admissionId" = admission."id"))))
    ) THEN RAISE EXCEPTION 'OIC-7 recovery generation has unresolved provider or admission evidence'; END IF;

    IF NEW."generationOrdinal" = 1 THEN
      IF NEW."authorizationId" <> 'OIC7_PACKET76_RECOVERY_GENERATION_V1' OR NOT EXISTS (
        SELECT 1 FROM "OicAuditEvent" event WHERE event."applicationId" = NEW."applicationId"
          AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
          AND event."action" = 'evaluation.packet76.recovery_generation.authorized'
          AND event."targetType" = 'evaluation-recovery-generation' AND event."targetId" = NEW."id"
          AND event."metadata"->>'authorizationId' = NEW."authorizationId"
          AND event."metadata"->>'workItemId' = NEW."workItemId"::text
      ) THEN RAISE EXCEPTION 'OIC-7 first recovery generation lacks matching authorization audit'; END IF;
    ELSE
      IF NEW."generationOrdinal" <> 2 OR NEW."maxPhysicalAttempts" <> 3
        OR NEW."authorizationId" <> 'OIC7_PACKET76_EXECUTION_RECOVERY_GENERATION_V2'
        OR NOT EXISTS (
        SELECT 1 FROM "OicAuditEvent" event WHERE event."applicationId" = NEW."applicationId"
          AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
          AND event."action" = 'evaluation.packet76.recovery_generation.authorized'
          AND event."targetType" = 'evaluation-recovery-generation' AND event."targetId" = NEW."id"
          AND event."metadata"->>'authorizationId' = NEW."authorizationId"
          AND event."metadata"->>'generationId' = NEW."id"::text
          AND event."metadata"->>'generationOrdinal' = '2'
          AND event."metadata"->>'workItemId' = NEW."workItemId"::text
          AND event."metadata"->>'previousAttemptId' = NEW."previousAttemptId"::text
          AND event."metadata"->>'maxPhysicalAttempts' = '3'
          AND event."metadata"->>'maxProviderDispatches' = '3'
          AND event."metadata"->>'providerDispatchCeilingRemainingBefore' = '4'
          AND event."metadata"->>'diagnosticPasses' = '3'
      )
      THEN RAISE EXCEPTION 'OIC-7 recovery generation lacks matching authorization audit'; END IF;
    END IF;
  END IF;

  IF NEW."generationOrdinal" NOT BETWEEN 1 AND 2 OR NEW."maxPhysicalAttempts" <> 3 THEN
    RAISE EXCEPTION 'OIC-7 recovery generation bounds are invalid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
