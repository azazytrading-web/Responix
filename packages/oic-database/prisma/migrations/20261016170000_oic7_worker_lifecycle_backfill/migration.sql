UPDATE "OicEvaluationAttempt" AS attempt
SET "lifecycleStage" = CASE WHEN attempt."status" = 'SUCCEEDED' THEN 'COMPLETED' ELSE 'FAILED' END,
    "lifecycleUpdatedAt" = COALESCE(attempt."completedAt", attempt."startedAt"),
    "leaseAcquiredAt" = COALESCE(attempt."leaseAcquiredAt", attempt."startedAt"),
    "providerAttemptId" = providerAttempt."id",
    "providerDispatchStartedAt" = providerAttempt."startedAt"
FROM "OicProviderAttempt" AS providerAttempt
WHERE attempt."admissionId" = providerAttempt."admissionId"
  AND attempt."lifecycleStage" = 'CREATED';

UPDATE "OicEvaluationAttempt"
SET "lifecycleStage" = CASE WHEN "status" = 'SUCCEEDED' THEN 'COMPLETED' ELSE 'FAILED' END,
    "lifecycleUpdatedAt" = COALESCE("completedAt", "startedAt"),
    "leaseAcquiredAt" = COALESCE("leaseAcquiredAt", "startedAt")
WHERE "lifecycleStage" = 'CREATED'
  AND "status" IN ('SUCCEEDED', 'INFRA_FAILURE', 'BUDGET_BLOCKED');
