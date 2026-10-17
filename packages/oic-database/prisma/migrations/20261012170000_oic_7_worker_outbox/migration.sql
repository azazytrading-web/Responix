ALTER TABLE "OicEvaluationRun"
  ADD CONSTRAINT "OicEvaluationRun_id_applicationId_key"
  UNIQUE ("id", "applicationId");

ALTER TABLE "OicEvaluationRun"
  ADD CONSTRAINT "OicEvaluationRun_id_applicationId_tenantId_key"
  UNIQUE ("id", "applicationId", "tenantId");

ALTER TABLE "OicEvaluationCaseExecution"
  ADD COLUMN "leaseOwner" VARCHAR(128);

CREATE TABLE "OicEvaluationWorkItem" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "runId" UUID NOT NULL,
  "caseExecutionId" UUID NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" VARCHAR(128),
  "leaseGeneration" INTEGER NOT NULL DEFAULT 0,
  "leaseUntil" TIMESTAMPTZ(6),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastFailureClass" VARCHAR(40),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationWorkItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationWorkItem_caseExecutionId_key" UNIQUE ("caseExecutionId"),
  CONSTRAINT "OicEvaluationWorkItem_id_applicationId_tenantId_key" UNIQUE ("id", "applicationId", "tenantId"),
  CONSTRAINT "OicEvaluationWorkItem_attempt_bounds_check" CHECK ("attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 32),
  CONSTRAINT "OicEvaluationWorkItem_lease_state_check" CHECK (("status" = 'LEASED') = ("leaseOwner" IS NOT NULL AND "leaseUntil" IS NOT NULL)),
  CONSTRAINT "OicEvaluationWorkItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationWorkItem_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationWorkItem_runId_applicationId_fkey" FOREIGN KEY ("runId", "applicationId") REFERENCES "OicEvaluationRun"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationWorkItem_caseExecutionId_fkey" FOREIGN KEY ("caseExecutionId") REFERENCES "OicEvaluationCaseExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OicEvaluationWorkItem_status_availableAt_leaseUntil_priority_createdAt_idx"
  ON "OicEvaluationWorkItem"("status", "availableAt", "leaseUntil", "priority", "createdAt");
CREATE INDEX "OicEvaluationWorkItem_applicationId_tenantId_status_createdAt_idx"
  ON "OicEvaluationWorkItem"("applicationId", "tenantId", "status", "createdAt");

CREATE TABLE "OicEvaluationOutbox" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "runId" UUID,
  "eventKey" VARCHAR(128) NOT NULL,
  "eventType" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" VARCHAR(128),
  "leaseGeneration" INTEGER NOT NULL DEFAULT 0,
  "leaseUntil" TIMESTAMPTZ(6),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastFailureClass" VARCHAR(40),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationOutbox_applicationId_tenantId_eventKey_key" UNIQUE ("applicationId", "tenantId", "eventKey"),
  CONSTRAINT "OicEvaluationOutbox_id_applicationId_tenantId_key" UNIQUE ("id", "applicationId", "tenantId"),
  CONSTRAINT "OicEvaluationOutbox_attempt_count_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "OicEvaluationOutbox_lease_state_check" CHECK (("status" = 'LEASED') = ("leaseOwner" IS NOT NULL AND "leaseUntil" IS NOT NULL)),
  CONSTRAINT "OicEvaluationOutbox_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationOutbox_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationOutbox_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OicEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OicEvaluationOutbox_status_availableAt_leaseUntil_createdAt_idx"
  ON "OicEvaluationOutbox"("status", "availableAt", "leaseUntil", "createdAt");
CREATE INDEX "OicEvaluationOutbox_applicationId_tenantId_status_createdAt_idx"
  ON "OicEvaluationOutbox"("applicationId", "tenantId", "status", "createdAt");
CREATE UNIQUE INDEX "OicEvaluationOutbox_application_global_eventKey_key"
  ON "OicEvaluationOutbox"("applicationId", "eventKey") WHERE "tenantId" IS NULL;

CREATE FUNCTION oic_evaluation_work_item_scope_check() RETURNS trigger AS $$
DECLARE
  run_application UUID;
  run_tenant UUID;
  case_run UUID;
BEGIN
  SELECT "applicationId", "tenantId" INTO run_application, run_tenant
    FROM "OicEvaluationRun" WHERE "id" = NEW."runId";
  SELECT "runId" INTO case_run
    FROM "OicEvaluationCaseExecution" WHERE "id" = NEW."caseExecutionId";
  IF run_application IS DISTINCT FROM NEW."applicationId" OR
     run_tenant IS DISTINCT FROM NEW."tenantId" OR
     case_run IS DISTINCT FROM NEW."runId" THEN
    RAISE EXCEPTION 'OIC evaluation work item scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_eval_work_item_scope
  BEFORE INSERT OR UPDATE ON "OicEvaluationWorkItem"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_work_item_scope_check();

CREATE FUNCTION oic_evaluation_outbox_scope_check() RETURNS trigger AS $$
DECLARE
  run_application UUID;
  run_tenant UUID;
BEGIN
  IF NEW."runId" IS NULL THEN RETURN NEW; END IF;
  SELECT "applicationId", "tenantId" INTO run_application, run_tenant
    FROM "OicEvaluationRun" WHERE "id" = NEW."runId";
  IF run_application IS DISTINCT FROM NEW."applicationId" OR run_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'OIC evaluation outbox scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_eval_outbox_scope
  BEFORE INSERT OR UPDATE ON "OicEvaluationOutbox"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_outbox_scope_check();
