-- Domain-review lifecycle values include SECOND_REVIEW_OPEN (18 chars) and
-- RECONCILED_REVIEW_REQUIRED (26 chars). Keep the column wide enough for all
-- canonical states so final-submission and reconciliation transactions commit.
ALTER TABLE "OicDomainReviewBatch"
  ALTER COLUMN "status" TYPE VARCHAR(32);
