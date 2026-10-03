ALTER TABLE "OicIntelligenceKnowledge"
ADD COLUMN "dependsOn" JSONB NOT NULL DEFAULT '[]'::jsonb;
