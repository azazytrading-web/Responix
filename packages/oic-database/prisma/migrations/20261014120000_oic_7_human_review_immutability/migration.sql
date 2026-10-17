CREATE FUNCTION oic_reviewer_evidence_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'human reviewer evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oic_reviewer_calibration_immutable
BEFORE UPDATE OR DELETE ON "OicReviewerCalibration"
FOR EACH ROW EXECUTE FUNCTION oic_reviewer_evidence_immutable();

CREATE TRIGGER oic_review_submission_immutable
BEFORE UPDATE OR DELETE ON "OicReviewSubmission"
FOR EACH ROW EXECUTE FUNCTION oic_reviewer_evidence_immutable();

CREATE TRIGGER oic_review_adjudication_immutable
BEFORE UPDATE OR DELETE ON "OicReviewAdjudication"
FOR EACH ROW EXECUTE FUNCTION oic_reviewer_evidence_immutable();
