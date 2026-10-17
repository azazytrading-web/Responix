CREATE OR REPLACE FUNCTION oic_7_guard_validation_job_scope() RETURNS trigger AS $$
DECLARE
  pack_tenant UUID;
BEGIN
  SELECT pack."tenantId" INTO pack_tenant
  FROM "OicEvaluationPackRevision" pack
  WHERE pack."id" = NEW."packId" AND pack."applicationId" = NEW."applicationId";
  IF NOT FOUND OR pack_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'OIC-7 validation job scope does not match its pack';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_eval_validation_job_scope
  BEFORE INSERT OR UPDATE ON "OicEvaluationValidationJob"
  FOR EACH ROW EXECUTE FUNCTION oic_7_guard_validation_job_scope();

CREATE OR REPLACE FUNCTION oic_7_reject_validation_job_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OIC-7 validation job reports are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_eval_validation_job_immutable
  BEFORE UPDATE OR DELETE ON "OicEvaluationValidationJob"
  FOR EACH ROW EXECUTE FUNCTION oic_7_reject_validation_job_mutation();
