DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "OicUpstreamModel") THEN
    RAISE EXCEPTION 'OIC upstream models need explicit provider-connection ownership before this migration can be applied';
  END IF;
END $$;
-- DropIndex
DROP INDEX "OicUpstreamModel_providerDefinitionId_lifecycle_displayName_idx";

-- DropIndex
DROP INDEX "OicUpstreamModel_providerDefinitionId_upstreamModelId_key";

-- AlterTable
ALTER TABLE "OicUpstreamModel" ADD COLUMN     "connectionId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "OicUpstreamModel_providerDefinitionId_connectionId_lifecycl_idx" ON "OicUpstreamModel"("providerDefinitionId", "connectionId", "lifecycle", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "OicUpstreamModel_connectionId_upstreamModelId_key" ON "OicUpstreamModel"("connectionId", "upstreamModelId");

-- AddForeignKey
ALTER TABLE "OicUpstreamModel" ADD CONSTRAINT "OicUpstreamModel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION oic_validate_upstream_model_connection() RETURNS trigger AS $$
DECLARE connection_provider UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."providerDefinitionId" IS DISTINCT FROM OLD."providerDefinitionId" OR NEW."connectionId" IS DISTINCT FROM OLD."connectionId" OR NEW."upstreamModelId" IS DISTINCT FROM OLD."upstreamModelId") THEN
    RAISE EXCEPTION 'OIC upstream model provider and exact identity are immutable';
  END IF;
  SELECT "providerDefinitionId" INTO connection_provider FROM "OicProviderConnection" WHERE "id" = NEW."connectionId";
  IF connection_provider IS NULL OR connection_provider <> NEW."providerDefinitionId" THEN
    RAISE EXCEPTION 'OIC upstream model provider must match its connection';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OicUpstreamModel_connection_integrity" BEFORE INSERT OR UPDATE ON "OicUpstreamModel" FOR EACH ROW EXECUTE FUNCTION oic_validate_upstream_model_connection();