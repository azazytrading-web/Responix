CREATE OR REPLACE FUNCTION oic_guard_evaluation_basis_revision() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'evaluation basis revisions are immutable';
  END IF;
  IF ROW(NEW."id", NEW."applicationId", NEW."tenantId", NEW."bridgeKey", NEW."revision", NEW."bridgeType", NEW."sourceManifestId", NEW."targetGradingManifestId", NEW."sourceMetricRevisionId", NEW."targetMetricRevisionId", NEW."sourceMethodRevision", NEW."targetMethodRevision", NEW."validationEvidence", NEW."validationEvidenceDigest", NEW."bridgeDigest", NEW."authorPrincipalId", NEW."publisherPrincipalId", NEW."createdAt", NEW."publishedAt")
     IS DISTINCT FROM
     ROW(OLD."id", OLD."applicationId", OLD."tenantId", OLD."bridgeKey", OLD."revision", OLD."bridgeType", OLD."sourceManifestId", OLD."targetGradingManifestId", OLD."sourceMetricRevisionId", OLD."targetMetricRevisionId", OLD."sourceMethodRevision", OLD."targetMethodRevision", OLD."validationEvidence", OLD."validationEvidenceDigest", OLD."bridgeDigest", OLD."authorPrincipalId", OLD."publisherPrincipalId", OLD."createdAt", OLD."publishedAt") THEN
    RAISE EXCEPTION 'evaluation basis revision content is immutable';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" OR NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    IF OLD."status" <> 'PUBLISHED' OR NEW."status" <> 'REVOKED' OR OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN
      RAISE EXCEPTION 'evaluation basis revision status may only transition from PUBLISHED to REVOKED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OicEvaluationBasisBridgeRevision_immutable"
BEFORE UPDATE OR DELETE ON "OicEvaluationBasisBridgeRevision"
FOR EACH ROW EXECUTE FUNCTION oic_guard_evaluation_basis_revision();

CREATE OR REPLACE FUNCTION oic_guard_evaluation_basis_draft() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR ROW(NEW."id", NEW."applicationId", NEW."tenantId", NEW."kind", NEW."draftKey", NEW."payload", NEW."payloadDigest", NEW."createdByPrincipalId", NEW."createdAt")
     IS DISTINCT FROM ROW(OLD."id", OLD."applicationId", OLD."tenantId", OLD."kind", OLD."draftKey", OLD."payload", OLD."payloadDigest", OLD."createdByPrincipalId", OLD."createdAt") THEN
    RAISE EXCEPTION 'evaluation basis draft content is immutable';
  END IF;
  IF OLD."status" <> 'DRAFT' OR NEW."status" NOT IN ('PUBLISHED', 'REJECTED') THEN
    RAISE EXCEPTION 'evaluation basis draft has an invalid lifecycle transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OicEvaluationBasisDraft_immutable"
BEFORE UPDATE OR DELETE ON "OicEvaluationBasisDraft"
FOR EACH ROW EXECUTE FUNCTION oic_guard_evaluation_basis_draft();

CREATE OR REPLACE FUNCTION oic_guard_evaluation_regrade_record() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'evaluation regrade records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OicEvaluationRegradePass_append_only"
BEFORE UPDATE OR DELETE ON "OicEvaluationRegradePass"
FOR EACH ROW EXECUTE FUNCTION oic_guard_evaluation_regrade_record();
CREATE TRIGGER "OicEvaluationRegradeSource_append_only"
BEFORE UPDATE OR DELETE ON "OicEvaluationRegradeSource"
FOR EACH ROW EXECUTE FUNCTION oic_guard_evaluation_regrade_record();
CREATE TRIGGER "OicEvaluationRegradeMeasurement_append_only"
BEFORE UPDATE OR DELETE ON "OicEvaluationRegradeMeasurement"
FOR EACH ROW EXECUTE FUNCTION oic_guard_evaluation_regrade_record();
