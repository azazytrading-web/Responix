ALTER TABLE "ai_models"
  ADD COLUMN "version" TEXT,
  ADD COLUMN "supports_function_calling" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supports_video" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supports_mcp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
