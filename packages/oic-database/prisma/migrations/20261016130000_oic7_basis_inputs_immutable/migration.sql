CREATE OR REPLACE FUNCTION oic_guard_evaluation_protocol_manifest() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'published evaluation protocol manifests are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OicEvaluationProtocolManifest_immutable"
BEFORE UPDATE OR DELETE ON "OicEvaluationProtocolManifest"
FOR EACH ROW EXECUTE FUNCTION oic_guard_evaluation_protocol_manifest();

CREATE OR REPLACE FUNCTION oic_guard_packet76_metric_revision() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR ROW(NEW."id", NEW."applicationId", NEW."tenantId", NEW."metricKey", NEW."revision", NEW."definition", NEW."definitionDigest", NEW."status", NEW."createdBy", NEW."createdAt", NEW."publishedAt")
     IS DISTINCT FROM ROW(OLD."id", OLD."applicationId", OLD."tenantId", OLD."metricKey", OLD."revision", OLD."definition", OLD."definitionDigest", OLD."status", OLD."createdBy", OLD."createdAt", OLD."publishedAt") THEN
    RAISE EXCEPTION 'Packet 7.6 metric revision is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OicEvaluationMetricRevision_packet76_immutable"
BEFORE UPDATE OR DELETE ON "OicEvaluationMetricRevision"
FOR EACH ROW WHEN (OLD."metricKey" = 'oic7-objective-exact-match' AND OLD."revision" >= 2)
EXECUTE FUNCTION oic_guard_packet76_metric_revision();
