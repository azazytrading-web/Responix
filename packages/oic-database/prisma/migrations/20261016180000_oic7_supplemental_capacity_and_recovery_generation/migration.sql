ALTER TABLE "OicAdmission"
  ADD COLUMN "capacityExtensionId" UUID;

ALTER TABLE "OicEvaluationAttempt"
  ADD COLUMN "recoveryGenerationId" UUID,
  ADD COLUMN "recoveryOrdinal" INTEGER,
  ADD COLUMN "lastDurableStage" VARCHAR(32);

CREATE TABLE "OicEvaluationCapacityExtension" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "campaignId" UUID NOT NULL,
  "runId" UUID NOT NULL,
  "baseBudgetRevisionId" UUID NOT NULL,
  "budgetRevisionId" UUID NOT NULL,
  "cohortKey" VARCHAR(96) NOT NULL,
  "authorizedOiu" DECIMAL(38,18) NOT NULL,
  "perAdmissionLimitOiu" DECIMAL(38,18) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "authorizationId" VARCHAR(96) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "OicEvaluationCapacityExtension_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationCapacityExtension_amount_check" CHECK (
    "authorizedOiu" > 0 AND "perAdmissionLimitOiu" > 0 AND "perAdmissionLimitOiu" <= "authorizedOiu"
  ),
  CONSTRAINT "OicEvaluationCapacityExtension_status_check" CHECK ("status" IN ('ACTIVE','CLOSED','EXPIRED')),
  CONSTRAINT "OicEvaluationCapacityExtension_budgetRevisionId_key" UNIQUE ("budgetRevisionId"),
  CONSTRAINT "OicEvaluationCapacityExtension_campaign_cohort_auth_key" UNIQUE ("campaignId","cohortKey","authorizationId"),
  CONSTRAINT "OicEvaluationCapacityExtension_application_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationCapacityExtension_tenant_fkey" FOREIGN KEY ("tenantId","applicationId") REFERENCES "OicTenant"("id","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationCapacityExtension_campaign_fkey" FOREIGN KEY ("campaignId","applicationId") REFERENCES "OicEvaluationCampaign"("id","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationCapacityExtension_run_fkey" FOREIGN KEY ("runId","applicationId") REFERENCES "OicEvaluationRun"("id","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationCapacityExtension_base_budget_fkey" FOREIGN KEY ("baseBudgetRevisionId") REFERENCES "OicBudgetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationCapacityExtension_budget_fkey" FOREIGN KEY ("budgetRevisionId") REFERENCES "OicBudgetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OicEvaluationRecoveryGeneration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "runId" UUID NOT NULL,
  "workItemId" UUID NOT NULL,
  "cohortKey" VARCHAR(96) NOT NULL,
  "pairKey" VARCHAR(96) NOT NULL,
  "repetitionOrdinal" INTEGER NOT NULL,
  "previousAttemptId" UUID NOT NULL,
  "generationOrdinal" INTEGER NOT NULL DEFAULT 1,
  "maxPhysicalAttempts" INTEGER NOT NULL DEFAULT 3,
  "usedPhysicalAttempts" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "authorizationId" VARCHAR(96) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationRecoveryGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationRecoveryGeneration_workItem_key" UNIQUE ("workItemId"),
  CONSTRAINT "OicEvaluationRecoveryGeneration_run_cohort_ordinal_key" UNIQUE ("runId","cohortKey","generationOrdinal"),
  CONSTRAINT "OicEvaluationRecoveryGeneration_bounds_check" CHECK ("generationOrdinal" = 1 AND "maxPhysicalAttempts" = 3 AND "usedPhysicalAttempts" BETWEEN 0 AND 3),
  CONSTRAINT "OicEvaluationRecoveryGeneration_status_check" CHECK ("status" IN ('ACTIVE','CLOSED','EXHAUSTED')),
  CONSTRAINT "OicEvaluationRecoveryGeneration_work_fkey" FOREIGN KEY ("workItemId") REFERENCES "OicEvaluationWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRecoveryGeneration_previous_attempt_fkey" FOREIGN KEY ("previousAttemptId") REFERENCES "OicEvaluationAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "OicAdmission"
  ADD CONSTRAINT "OicAdmission_capacityExtension_fkey" FOREIGN KEY ("capacityExtensionId") REFERENCES "OicEvaluationCapacityExtension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationAttempt"
  ADD CONSTRAINT "OicEvaluationAttempt_recoveryGeneration_fkey" FOREIGN KEY ("recoveryGenerationId") REFERENCES "OicEvaluationRecoveryGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "OicEvaluationAttempt_recoveryOrdinal_check" CHECK (("recoveryGenerationId" IS NULL AND "recoveryOrdinal" IS NULL) OR ("recoveryGenerationId" IS NOT NULL AND "recoveryOrdinal" BETWEEN 1 AND 3));

CREATE INDEX "OicEvaluationCapacityExtension_scope_status_expires_idx"
  ON "OicEvaluationCapacityExtension"("applicationId","campaignId","runId","status","expiresAt");
CREATE INDEX "OicEvaluationRecoveryGeneration_scope_status_created_idx"
  ON "OicEvaluationRecoveryGeneration"("applicationId","runId","status","createdAt");
CREATE INDEX "OicEvaluationAttempt_recoveryGenerationId_recoveryOrdinal_idx"
  ON "OicEvaluationAttempt"("recoveryGenerationId","recoveryOrdinal");

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
      AND event."metadata"->>'authorizedOiu' = NEW."authorizedOiu"::text
  ) THEN RAISE EXCEPTION 'OIC-7 capacity extension requires owner authorization audit provenance'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_7_capacity_extension_guard
BEFORE INSERT OR UPDATE ON "OicEvaluationCapacityExtension"
FOR EACH ROW EXECUTE FUNCTION oic_7_guard_capacity_extension();

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
  IF TG_OP = 'INSERT' AND (
    NOT EXISTS (
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
    ) OR EXISTS (
      SELECT 1 FROM "OicEvaluationAttempt" attempt
      LEFT JOIN "OicAdmission" admission ON admission."id" = attempt."admissionId"
      WHERE attempt."caseExecutionId" = (SELECT "caseExecutionId" FROM "OicEvaluationWorkItem" WHERE "id" = NEW."workItemId")
        AND (attempt."providerAttemptId" IS NOT NULL OR attempt."providerDispatchStartedAt" IS NOT NULL
          OR attempt."artifactManifest" IS NOT NULL OR attempt."evidenceDigest" IS NOT NULL
          OR (attempt."admissionId" IS NOT NULL AND (admission."status"::text <> 'RELEASED'
            OR EXISTS (SELECT 1 FROM "OicProviderAttempt" provider WHERE provider."admissionId" = admission."id"))))
    ) OR NOT EXISTS (
    SELECT 1 FROM "OicAuditEvent" event WHERE event."applicationId" = NEW."applicationId"
      AND event."tenantId" IS NOT DISTINCT FROM NEW."tenantId"
      AND event."action" = 'evaluation.packet76.recovery_generation.authorized'
      AND event."targetType" = 'evaluation-recovery-generation'
      AND event."metadata"->>'authorizationId' = NEW."authorizationId"
      AND event."metadata"->>'workItemId' = NEW."workItemId"::text
    ) OR NEW."generationOrdinal" <> 1 OR NEW."maxPhysicalAttempts" <> 3 OR NEW."authorizationId" <> 'OIC7_PACKET76_RECOVERY_GENERATION_V1'
  ) THEN RAISE EXCEPTION 'OIC-7 recovery generation requires eligible no-dispatch work and authorization audit provenance'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_7_recovery_generation_guard
BEFORE INSERT OR UPDATE ON "OicEvaluationRecoveryGeneration"
FOR EACH ROW EXECUTE FUNCTION oic_7_guard_recovery_generation();

CREATE OR REPLACE FUNCTION oic_7_close_capacity_extension_on_terminal_run() RETURNS trigger AS $$
DECLARE item RECORD;
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" IN ('EXECUTED','CANCELLED') THEN
    FOR item IN
      UPDATE "OicEvaluationCapacityExtension"
      SET "status" = 'CLOSED'
      WHERE "runId" = NEW."id" AND "status" = 'ACTIVE'
      RETURNING "id", "applicationId", "tenantId", "createdBy"
    LOOP
      INSERT INTO "OicAuditEvent" ("actorPrincipalId","applicationId","tenantId","action","targetType","targetId","metadata")
      VALUES (item."createdBy", item."applicationId", item."tenantId", 'evaluation.packet76.capacity_extension.closed',
        'evaluation-capacity-extension', item."id", jsonb_build_object('runId', NEW."id", 'reason', 'TERMINAL_RUN_CLOSURE'));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_7_capacity_extension_run_close
AFTER UPDATE OF "status" ON "OicEvaluationRun"
FOR EACH ROW EXECUTE FUNCTION oic_7_close_capacity_extension_on_terminal_run();

CREATE OR REPLACE FUNCTION oic_7_guard_capacity_admission() RETURNS trigger AS $$
DECLARE extension "OicEvaluationCapacityExtension"%ROWTYPE;
DECLARE leg_amount DECIMAL(38,18);
BEGIN
  IF NEW."capacityExtensionId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO extension FROM "OicEvaluationCapacityExtension" WHERE "id" = NEW."capacityExtensionId" FOR UPDATE;
  IF NOT FOUND OR extension."status" <> 'ACTIVE' OR extension."expiresAt" <= clock_timestamp()
      OR extension."applicationId" IS DISTINCT FROM NEW."applicationId"
      OR extension."tenantId" IS DISTINCT FROM NEW."tenantId"
      OR NOT EXISTS (
        SELECT 1 FROM "OicEvaluationAttempt" attempt
        JOIN "OicEvaluationCaseExecution" execution ON execution."id" = attempt."caseExecutionId"
        JOIN "OicEvaluationRun" run ON run."id" = execution."runId"
        JOIN "OicEvaluationProtocolManifest" manifest ON manifest."id" = run."manifestId"
        WHERE attempt."id"::text = split_part(NEW."idempotencyKey", ':', 2)
          AND run."id" = extension."runId" AND run."campaignId" = extension."campaignId"
          AND manifest."payload"->'cohort'->>'cohortKey' = extension."cohortKey"
      )
      OR NEW."operation" <> 'text.generate' THEN RAISE EXCEPTION 'OIC-7 supplemental capacity extension unavailable'; END IF;
  SELECT leg."amount" INTO leg_amount FROM "OicReservationLeg" leg
    WHERE leg."admissionId" = NEW."id" AND leg."budgetRevisionId" = extension."budgetRevisionId";
  IF leg_amount IS NULL OR leg_amount > extension."perAdmissionLimitOiu"
      OR (SELECT COUNT(*) FROM "OicReservationLeg" leg WHERE leg."admissionId" = NEW."id" AND leg."budgetRevisionId" = extension."budgetRevisionId") <> 1
  THEN RAISE EXCEPTION 'OIC-7 supplemental capacity per-admission bound exceeded'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER oic_7_capacity_admission_guard
AFTER INSERT OR UPDATE OF "capacityExtensionId" ON "OicAdmission"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION oic_7_guard_capacity_admission();
