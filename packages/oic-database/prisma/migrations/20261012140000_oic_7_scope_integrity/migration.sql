-- Nullable tenant IDs bypass a conventional composite FK under MATCH SIMPLE.
-- Keep application and tenant scope identical at every direct OIC-7 reference.
CREATE FUNCTION oic_evaluation_assert_parent_scope() RETURNS trigger AS $$
DECLARE
  parent_id UUID;
  parent_application UUID;
  parent_tenant UUID;
BEGIN
  parent_id := NULLIF(to_jsonb(NEW)->>TG_ARGV[1], '')::uuid;
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT "applicationId", "tenantId" FROM %I WHERE "id" = $1', TG_ARGV[0])
    INTO parent_application, parent_tenant USING parent_id;
  IF NOT FOUND OR parent_application IS DISTINCT FROM NEW."applicationId" OR parent_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'OIC evaluation scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_eval_case_pack_scope BEFORE INSERT OR UPDATE ON "OicEvaluationCaseRevision"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationPackRevision', 'packId');
CREATE TRIGGER oic_eval_dataset_pack_scope BEFORE INSERT OR UPDATE ON "OicEvaluationDatasetRevision"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationPackRevision', 'packId');
CREATE TRIGGER oic_eval_environment_pack_scope BEFORE INSERT OR UPDATE ON "OicEvaluationEnvironmentRevision"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationPackRevision', 'packId');
CREATE TRIGGER oic_eval_suite_pack_scope BEFORE INSERT OR UPDATE ON "OicEvaluationSuiteRevision"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationPackRevision', 'packId');
CREATE TRIGGER oic_eval_suite_dataset_scope BEFORE INSERT OR UPDATE ON "OicEvaluationSuiteRevision"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationDatasetRevision', 'datasetId');
CREATE TRIGGER oic_eval_suite_environment_scope BEFORE INSERT OR UPDATE ON "OicEvaluationSuiteRevision"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationEnvironmentRevision', 'environmentId');
CREATE TRIGGER oic_eval_release_pack_scope BEFORE INSERT OR UPDATE ON "OicEvaluationRelease"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationPackRevision', 'packId');
CREATE TRIGGER oic_eval_release_dataset_scope BEFORE INSERT OR UPDATE ON "OicEvaluationRelease"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationDatasetRevision', 'datasetId');
CREATE TRIGGER oic_eval_release_environment_scope BEFORE INSERT OR UPDATE ON "OicEvaluationRelease"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationEnvironmentRevision', 'environmentId');
CREATE TRIGGER oic_eval_release_suite_scope BEFORE INSERT OR UPDATE ON "OicEvaluationRelease"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationSuiteRevision', 'suiteId');
CREATE TRIGGER oic_eval_manifest_release_scope BEFORE INSERT OR UPDATE ON "OicEvaluationProtocolManifest"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationRelease', 'releaseId');
CREATE TRIGGER oic_eval_campaign_release_scope BEFORE INSERT OR UPDATE ON "OicEvaluationCampaign"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationRelease', 'releaseId');
CREATE TRIGGER oic_eval_run_manifest_scope BEFORE INSERT OR UPDATE ON "OicEvaluationRun"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationProtocolManifest', 'manifestId');
CREATE TRIGGER oic_eval_run_campaign_scope BEFORE INSERT OR UPDATE ON "OicEvaluationRun"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_parent_scope('OicEvaluationCampaign', 'campaignId');

CREATE FUNCTION oic_evaluation_assert_case_run_scope() RETURNS trigger AS $$
DECLARE
  run_application UUID;
  run_tenant UUID;
  case_application UUID;
  case_tenant UUID;
BEGIN
  SELECT "applicationId", "tenantId" INTO run_application, run_tenant FROM "OicEvaluationRun" WHERE "id" = NEW."runId";
  SELECT "applicationId", "tenantId" INTO case_application, case_tenant FROM "OicEvaluationCaseRevision" WHERE "id" = NEW."caseRevisionId";
  IF run_application IS DISTINCT FROM case_application OR run_tenant IS DISTINCT FROM case_tenant THEN
    RAISE EXCEPTION 'OIC evaluation case scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER oic_eval_case_run_scope BEFORE INSERT OR UPDATE ON "OicEvaluationCaseExecution"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_case_run_scope();

CREATE FUNCTION oic_evaluation_assert_comparison_scope() RETURNS trigger AS $$
DECLARE
  baseline_application UUID;
  baseline_tenant UUID;
  candidate_application UUID;
  candidate_tenant UUID;
BEGIN
  SELECT r."applicationId", r."tenantId" INTO baseline_application, baseline_tenant
    FROM "OicEvaluationReport" x JOIN "OicEvaluationRun" r ON r."id" = x."runId" WHERE x."id" = NEW."baselineReportId";
  SELECT r."applicationId", r."tenantId" INTO candidate_application, candidate_tenant
    FROM "OicEvaluationReport" x JOIN "OicEvaluationRun" r ON r."id" = x."runId" WHERE x."id" = NEW."candidateReportId";
  IF baseline_application IS DISTINCT FROM candidate_application OR baseline_tenant IS DISTINCT FROM candidate_tenant THEN
    RAISE EXCEPTION 'OIC evaluation comparison scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER oic_eval_comparison_scope BEFORE INSERT OR UPDATE ON "OicEvaluationComparison"
  FOR EACH ROW EXECUTE FUNCTION oic_evaluation_assert_comparison_scope();
