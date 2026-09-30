-- MOD-2 Sprint A: preserve canonical identities and all existing FK consumers.
-- Fail closed on unreviewed prices in any deployment, even beyond the inventoried DB.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ai_models WHERE input_cost <> 0 OR output_cost <> 0) THEN
    RAISE EXCEPTION 'MOD2_PRICE_PROVENANCE_REQUIRED: nonzero legacy prices require owner disposition';
  END IF;
END $$;
ALTER TYPE "ModelStatus" ADD VALUE 'ARCHIVED';
CREATE TYPE "ModelSource" AS ENUM ('BUILT_IN','PROVIDER_SYNCED','CUSTOM');
CREATE TYPE "ModelCapabilityKey" AS ENUM ('TEXT_CHAT','STREAMING','TOOLS','STRUCTURED_OUTPUT','REASONING','VISION_INPUT','IMAGE_GENERATION','AUDIO_INPUT','AUDIO_OUTPUT','VIDEO','EMBEDDINGS','AUDIO','FUNCTION_CALLING','MCP');
CREATE TYPE "ModelCapabilityState" AS ENUM ('SUPPORTED','UNSUPPORTED','UNKNOWN');
CREATE TYPE "ModelEvidenceSource" AS ENUM ('PLATFORM_CURATED','PROVIDER_SYNC','MODEL_VALIDATION','WORKSPACE_DECLARED');
CREATE TYPE "ModelPriceState" AS ENUM ('KNOWN','UNKNOWN');
CREATE TYPE "ModelPriceUnit" AS ENUM ('PER_MILLION_TOKENS');
ALTER TABLE ai_models
  ALTER COLUMN provider_id DROP NOT NULL,
  ALTER COLUMN context_window DROP NOT NULL,
  ADD COLUMN provider_model_id VARCHAR(200),
  ADD COLUMN source "ModelSource" NOT NULL DEFAULT 'BUILT_IN',
  ADD COLUMN owner_workspace_id UUID,
  ADD COLUMN custom_provider_id UUID,
  ADD COLUMN family VARCHAR(100),
  ADD COLUMN archived_at TIMESTAMP(3);
UPDATE ai_models SET provider_model_id=model_name;
ALTER TABLE ai_models ALTER COLUMN provider_model_id SET NOT NULL;
ALTER TABLE ai_models
  ADD CONSTRAINT ai_models_owner_workspace_id_fkey FOREIGN KEY (owner_workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT ai_models_custom_provider_workspace_fkey FOREIGN KEY (custom_provider_id,owner_workspace_id) REFERENCES custom_ai_providers(id,workspace_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT ai_models_target_xor CHECK ((provider_id IS NOT NULL)::int + (custom_provider_id IS NOT NULL)::int = 1),
  ADD CONSTRAINT ai_models_source_owner CHECK ((source='BUILT_IN' AND owner_workspace_id IS NULL AND provider_id IS NOT NULL) OR (source IN ('CUSTOM','PROVIDER_SYNCED') AND owner_workspace_id IS NOT NULL)),
  ADD CONSTRAINT ai_models_identity_valid CHECK (length(provider_model_id)>0 AND provider_model_id !~ '[[:cntrl:]]' AND model_name=provider_model_id),
  ADD CONSTRAINT ai_models_limits_valid CHECK ((context_window IS NULL OR context_window>0) AND (max_output_tokens IS NULL OR max_output_tokens>0));
DROP INDEX ai_models_provider_id_model_name_key;
-- Partial uniqueness deliberately separates NULL/global ownership from workspace ownership.
CREATE UNIQUE INDEX ai_models_global_identity_key ON ai_models(provider_id,provider_model_id COLLATE "C") WHERE owner_workspace_id IS NULL;
CREATE UNIQUE INDEX ai_models_workspace_provider_identity_key ON ai_models(owner_workspace_id,provider_id,provider_model_id COLLATE "C") WHERE owner_workspace_id IS NOT NULL AND provider_id IS NOT NULL;
CREATE UNIQUE INDEX ai_models_workspace_custom_identity_key ON ai_models(owner_workspace_id,custom_provider_id,provider_model_id COLLATE "C") WHERE custom_provider_id IS NOT NULL;
CREATE INDEX ai_models_owner_workspace_id_source_status_idx ON ai_models(owner_workspace_id,source,status);
CREATE INDEX ai_models_custom_provider_id_owner_workspace_id_idx ON ai_models(custom_provider_id,owner_workspace_id);
CREATE TABLE ai_model_capabilities (
  model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  key "ModelCapabilityKey" NOT NULL,
  source "ModelEvidenceSource" NOT NULL,
  state "ModelCapabilityState" NOT NULL DEFAULT 'UNKNOWN',
  observed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_model_capabilities_pkey PRIMARY KEY (model_id,key,source)
);
CREATE TABLE ai_model_prices (
  id UUID NOT NULL PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  state "ModelPriceState" NOT NULL DEFAULT 'UNKNOWN',
  input_rate DECIMAL(18,6), output_rate DECIMAL(18,6), cached_input_rate DECIMAL(18,6),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  unit "ModelPriceUnit" NOT NULL DEFAULT 'PER_MILLION_TOKENS',
  source "ModelEvidenceSource" NOT NULL,
  effective_from TIMESTAMP(3) NOT NULL, effective_to TIMESTAMP(3),
  observed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_model_prices_state_rates CHECK (
    (state='UNKNOWN' AND input_rate IS NULL AND output_rate IS NULL AND cached_input_rate IS NULL)
    OR (state='KNOWN' AND input_rate IS NOT NULL AND output_rate IS NOT NULL AND input_rate>=0 AND output_rate>=0 AND (cached_input_rate IS NULL OR cached_input_rate>=0))),
  CONSTRAINT ai_model_prices_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT ai_model_prices_dates CHECK (effective_to IS NULL OR effective_to>effective_from)
);
CREATE INDEX ai_model_prices_model_id_effective_from_idx ON ai_model_prices(model_id,effective_from);
INSERT INTO ai_model_prices(id,model_id,state,source,effective_from)
SELECT gen_random_uuid(),id,'UNKNOWN','PLATFORM_CURATED',CURRENT_TIMESTAMP FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'VISION_INPUT','PLATFORM_CURATED',CASE WHEN supports_vision THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'AUDIO','PLATFORM_CURATED',CASE WHEN supports_audio THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'TOOLS','PLATFORM_CURATED',CASE WHEN supports_tools THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'REASONING','PLATFORM_CURATED',CASE WHEN supports_reasoning THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'STREAMING','PLATFORM_CURATED',CASE WHEN supports_streaming THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'STRUCTURED_OUTPUT','PLATFORM_CURATED',CASE WHEN supports_json THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'FUNCTION_CALLING','PLATFORM_CURATED',CASE WHEN supports_function_calling THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'VIDEO','PLATFORM_CURATED',CASE WHEN supports_video THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
INSERT INTO ai_model_capabilities(model_id,key,source,state)
SELECT id,'MCP','PLATFORM_CURATED',CASE WHEN supports_mcp THEN 'SUPPORTED'::"ModelCapabilityState" ELSE 'UNKNOWN'::"ModelCapabilityState" END FROM ai_models;
-- No identity mutation or deletion, including through internal callers.
CREATE FUNCTION mod2_preserve_model_identity() RETURNS trigger AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'MODEL_HARD_DELETE_FORBIDDEN' USING ERRCODE='23514'; END IF;
  IF ROW(NEW.id,NEW.provider_id,NEW.custom_provider_id,NEW.owner_workspace_id,NEW.provider_model_id,NEW.source)
     IS DISTINCT FROM ROW(OLD.id,OLD.provider_id,OLD.custom_provider_id,OLD.owner_workspace_id,OLD.provider_model_id,OLD.source) THEN
    RAISE EXCEPTION 'MODEL_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER ai_models_preserve_identity BEFORE UPDATE OR DELETE ON ai_models FOR EACH ROW EXECUTE FUNCTION mod2_preserve_model_identity();
INSERT INTO permissions(id,code,created_at,updated_at)
VALUES (gen_random_uuid(),'ai.models.write',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(id,role_id,permission_id,created_at,updated_at)
SELECT gen_random_uuid(),roles.id,permissions.id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM roles JOIN permissions ON permissions.code='ai.models.write'
WHERE roles.workspace_id IS NULL AND roles.name IN ('Owner','Administrator')
ON CONFLICT(role_id,permission_id) DO NOTHING;
