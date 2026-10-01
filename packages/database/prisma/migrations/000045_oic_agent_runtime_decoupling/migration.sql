-- Make provider/model references optional only for explicitly configured OIC execution.
-- Existing Agent rows retain their provider/model values and legacy runtime mode.
ALTER TABLE "ai_agents" ALTER COLUMN "provider_id" DROP NOT NULL;
ALTER TABLE "ai_agents" ALTER COLUMN "model_id" DROP NOT NULL;
ALTER TABLE "agent_runtime_preparations" ALTER COLUMN "provider_id" DROP NOT NULL;
ALTER TABLE "agent_runtime_preparations" ALTER COLUMN "model_id" DROP NOT NULL;
ALTER TABLE "agent_runtime_preparations" ALTER COLUMN "provider_configuration_id" DROP NOT NULL;
ALTER TABLE "agent_runtime_snapshots" ALTER COLUMN "provider_id" DROP NOT NULL;
ALTER TABLE "agent_runtime_snapshots" ALTER COLUMN "model_id" DROP NOT NULL;
ALTER TABLE "agent_runtime_snapshots" ALTER COLUMN "provider_configuration_id" DROP NOT NULL;
ALTER TABLE "agent_execution_orchestrations" ALTER COLUMN "provider_runtime_snapshot_id" DROP NOT NULL;
-- Existing rows and history stay LEGACY. New rows are checked against the explicit execution mode.
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_execution_mode_assets_check"
CHECK (status = 'DRAFT' OR (
  (
    runtime_configuration->'oicIntegration'->>'executionMode' = 'OIC'
    AND runtime_configuration->'oicIntegration'->>'oiModelKey' ~ '^oi-[A-Za-z0-9._:-]{1,120}$'
    AND provider_id IS NULL AND model_id IS NULL AND provider_configuration_id IS NULL
  ) OR (
    COALESCE(runtime_configuration->'oicIntegration'->>'executionMode', 'LEGACY') = 'LEGACY'
    AND provider_id IS NOT NULL AND model_id IS NOT NULL
  )
));
