ALTER TABLE "OicReviewAssignment"
  DROP CONSTRAINT "OicReviewAssignment_conflictState_check";

ALTER TABLE "OicReviewAssignment"
  ADD CONSTRAINT "OicReviewAssignment_conflictState_check"
  CHECK ("conflictState" IN ('CLEAR', 'CLEARED', 'CONFLICT', 'UNKNOWN'));
