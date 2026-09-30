CREATE OR REPLACE FUNCTION oic_validate_runtime_binding() RETURNS trigger AS $$
DECLARE
  variant_revision UUID;
  variant_provider UUID;
  connection_provider UUID;
  connection_scope "OicProviderConnectionScope";
  connection_app UUID;
  connection_tenant UUID;
  connection_status "OicLifecycleStatus";
  connection_health "OicProviderHealthStatus";
  connection_validated_at TIMESTAMPTZ;
  auth_strategy "OicProviderAuthStrategy";
  has_credential BOOLEAN;
BEGIN
  SELECT "revisionId", "providerDefinitionId" INTO variant_revision, variant_provider
    FROM "OicModelVariant" WHERE "id" = NEW."variantId" AND "kind" = 'EXTERNAL_PROVIDER';
  IF variant_revision IS NULL OR NOT EXISTS (
    SELECT 1 FROM "OicModelRevision" WHERE "id" = variant_revision AND "editionId" = NEW."editionId"
  ) THEN RAISE EXCEPTION 'OIC runtime binding edition must own the selected variant revision'; END IF;

  SELECT c."providerDefinitionId", c."scope", c."applicationId", c."tenantId", c."status",
         c."healthStatus", c."lastValidatedAt", d."authStrategy"
    INTO connection_provider, connection_scope, connection_app, connection_tenant, connection_status,
         connection_health, connection_validated_at, auth_strategy
    FROM "OicProviderConnection" c JOIN "OicProviderDefinition" d ON d."id" = c."providerDefinitionId"
    WHERE c."id" = NEW."connectionId";
  IF connection_provider IS NULL OR connection_provider <> variant_provider THEN
    RAISE EXCEPTION 'OIC runtime binding provider must match the selected provider variant';
  END IF;
  IF (connection_scope = 'APPLICATION' AND (NEW."applicationId" IS DISTINCT FROM connection_app OR NEW."scope" = 'PLATFORM')) OR
     (connection_scope = 'TENANT' AND (NEW."tenantId" IS DISTINCT FROM connection_tenant OR NEW."applicationId" IS DISTINCT FROM connection_app OR NEW."scope" <> 'TENANT')) THEN
    RAISE EXCEPTION 'OIC runtime binding scope exceeds provider connection scope';
  END IF;
  IF NEW."status" = 'ACTIVE' THEN
    IF connection_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active OIC runtime bindings require an active provider connection'; END IF;
    IF connection_health <> 'HEALTHY' OR connection_validated_at IS NULL THEN
      RAISE EXCEPTION 'Active OIC runtime bindings require a validated healthy provider connection';
    END IF;
    SELECT EXISTS (SELECT 1 FROM "OicProviderCredential" WHERE "connectionId" = NEW."connectionId" AND "status" = 'ACTIVE') INTO has_credential;
    IF auth_strategy <> 'NONE' AND NOT has_credential THEN RAISE EXCEPTION 'Active provider connection requires an active credential'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
