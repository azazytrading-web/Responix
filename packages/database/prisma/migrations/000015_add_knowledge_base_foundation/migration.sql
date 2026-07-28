ALTER TYPE "KnowledgeStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
CREATE TYPE "KnowledgeSourceType" AS ENUM ('FILE', 'URL', 'TEXT', 'IMPORT', 'API');

ALTER TABLE "knowledge_bases"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "category_id" UUID,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "knowledge_bases_workspace_id_slug_key"
  ON "knowledge_bases"("workspace_id", "slug");

CREATE TABLE "knowledge_collections" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "knowledge_collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_collections_knowledge_base_id_slug_key"
  ON "knowledge_collections"("knowledge_base_id", "slug");
CREATE INDEX "knowledge_collections_workspace_id_knowledge_base_id_deleted_at_idx"
  ON "knowledge_collections"("workspace_id", "knowledge_base_id", "deleted_at");

CREATE TABLE "knowledge_folders" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "collection_id" UUID,
  "parent_id" UUID,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "knowledge_folders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_folders_workspace_id_knowledge_base_id_collection_id_parent_id_idx"
  ON "knowledge_folders"("workspace_id", "knowledge_base_id", "collection_id", "parent_id");

CREATE TABLE "knowledge_categories" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_categories_workspace_id_slug_key"
  ON "knowledge_categories"("workspace_id", "slug");

CREATE TABLE "knowledge_tags" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_tags_workspace_id_slug_key"
  ON "knowledge_tags"("workspace_id", "slug");

ALTER TABLE "knowledge_documents"
  ADD COLUMN "collection_id" UUID,
  ADD COLUMN "folder_id" UUID,
  ADD COLUMN "category_id" UUID,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "source_type" "KnowledgeSourceType" NOT NULL DEFAULT 'FILE',
  ADD COLUMN "source_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "file_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "url_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "language" TEXT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "parser_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "chunk_strategy" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "embedding_status_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "sync_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "import_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "knowledge_documents_workspace_id_slug_key"
  ON "knowledge_documents"("workspace_id", "slug");

CREATE TABLE "knowledge_chunk_metadata" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "checksum" TEXT,
  "token_count" INTEGER,
  "character_count" INTEGER,
  "strategy_metadata" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_chunk_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_chunk_metadata_document_id_ordinal_key"
  ON "knowledge_chunk_metadata"("document_id", "ordinal");
CREATE INDEX "knowledge_chunk_metadata_workspace_id_document_id_idx"
  ON "knowledge_chunk_metadata"("workspace_id", "document_id");

CREATE TABLE "knowledge_versions" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "change_summary" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_versions_document_id_revision_key"
  ON "knowledge_versions"("document_id", "revision");
CREATE INDEX "knowledge_versions_document_id_published_at_idx"
  ON "knowledge_versions"("document_id", "published_at");

CREATE TABLE "knowledge_tag_assignments" (
  "document_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  CONSTRAINT "knowledge_tag_assignments_pkey" PRIMARY KEY ("document_id", "tag_id")
);

ALTER TABLE "knowledge_bases"
  ADD CONSTRAINT "knowledge_bases_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL;
ALTER TABLE "knowledge_collections"
  ADD CONSTRAINT "knowledge_collections_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_collections"
  ADD CONSTRAINT "knowledge_collections_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_folders"
  ADD CONSTRAINT "knowledge_folders_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_folders"
  ADD CONSTRAINT "knowledge_folders_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_folders"
  ADD CONSTRAINT "knowledge_folders_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "knowledge_collections"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_folders"
  ADD CONSTRAINT "knowledge_folders_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "knowledge_folders"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_categories"
  ADD CONSTRAINT "knowledge_categories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "knowledge_tags"
  ADD CONSTRAINT "knowledge_tags_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "knowledge_collections"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "knowledge_folders"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL;
ALTER TABLE "knowledge_chunk_metadata"
  ADD CONSTRAINT "knowledge_chunk_metadata_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "knowledge_chunk_metadata"
  ADD CONSTRAINT "knowledge_chunk_metadata_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE;
ALTER TABLE "knowledge_versions"
  ADD CONSTRAINT "knowledge_versions_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE;
ALTER TABLE "knowledge_tag_assignments"
  ADD CONSTRAINT "knowledge_tag_assignments_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE;
ALTER TABLE "knowledge_tag_assignments"
  ADD CONSTRAINT "knowledge_tag_assignments_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "knowledge_tags"("id") ON DELETE CASCADE;

INSERT INTO "permissions" ("id", "code", "created_at", "updated_at")
SELECT gen_random_uuid(), code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('knowledge.base.read'),
  ('knowledge.base.write'),
  ('knowledge.base.publish'),
  ('knowledge.base.rollback'),
  ('knowledge.base.archive'),
  ('knowledge.base.delete'),
  ('knowledge.base.manage')
) AS knowledge_permissions(code)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), roles.id, permissions.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" roles
CROSS JOIN "permissions" permissions
WHERE roles."workspace_id" IS NULL
  AND roles."name" IN ('Owner', 'Administrator')
  AND permissions."code" LIKE 'knowledge.base.%'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
