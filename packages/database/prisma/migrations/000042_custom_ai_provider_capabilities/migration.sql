ALTER TABLE "custom_ai_providers"
  ADD COLUMN "supports_streaming" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supports_tools" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "custom_ai_providers"
  ALTER COLUMN "status" SET DEFAULT 'DISABLED';
