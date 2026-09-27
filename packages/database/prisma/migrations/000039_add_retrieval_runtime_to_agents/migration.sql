-- Add denormalized retrieval runtime reference to agents so a published,
-- knowledge-enabled agent can be bound to a published RetrievalRuntime and have
-- its latest published snapshot resolved when the agent is bound to a channel.
ALTER TABLE "ai_agents" ADD COLUMN "retrieval_runtime_id" UUID;
