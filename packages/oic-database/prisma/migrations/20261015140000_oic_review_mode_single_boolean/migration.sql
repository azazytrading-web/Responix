ALTER TABLE "OicReviewAssignment"
  ADD COLUMN "reviewMode" VARCHAR(24) NOT NULL DEFAULT 'PAIRWISE';

ALTER TABLE "OicReviewSubmission"
  ADD COLUMN "reviewMode" VARCHAR(24) NOT NULL DEFAULT 'PAIRWISE';

ALTER TABLE "OicReviewAssignment"
  ADD CONSTRAINT "OicReviewAssignment_reviewMode_check"
  CHECK ("reviewMode" IN ('PAIRWISE', 'SINGLE_BOOLEAN'));

ALTER TABLE "OicReviewSubmission"
  ADD CONSTRAINT "OicReviewSubmission_reviewMode_check"
  CHECK ("reviewMode" IN ('PAIRWISE', 'SINGLE_BOOLEAN'));
