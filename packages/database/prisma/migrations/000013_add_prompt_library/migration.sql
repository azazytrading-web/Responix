CREATE TABLE "prompt_categories" ("id" UUID NOT NULL,"workspace_id" UUID NOT NULL,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,CONSTRAINT "prompt_categories_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "prompt_categories_workspace_id_slug_key" ON "prompt_categories"("workspace_id","slug");
CREATE TABLE "prompt_tags" ("id" UUID NOT NULL,"workspace_id" UUID NOT NULL,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "prompt_tags_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "prompt_tags_workspace_id_slug_key" ON "prompt_tags"("workspace_id","slug");
CREATE TABLE "prompt_library_items" ("id" UUID NOT NULL,"workspace_id" UUID NOT NULL,"category_id" UUID,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"description" TEXT,"status" "StudioProjectStatus" NOT NULL DEFAULT 'DRAFT',"draft" JSONB NOT NULL DEFAULT '{}',"variables" JSONB NOT NULL DEFAULT '[]',"metadata" JSONB NOT NULL DEFAULT '{}',"revision" INTEGER NOT NULL DEFAULT 0,"favorite" BOOLEAN NOT NULL DEFAULT false,"created_by" UUID NOT NULL,"updated_by" UUID NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,"deleted_at" TIMESTAMP(3),CONSTRAINT "prompt_library_items_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "prompt_library_items_workspace_id_slug_key" ON "prompt_library_items"("workspace_id","slug");
CREATE INDEX "prompt_library_items_workspace_id_status_deleted_at_idx" ON "prompt_library_items"("workspace_id","status","deleted_at");
CREATE TABLE "prompt_tag_assignments" ("prompt_id" UUID NOT NULL,"tag_id" UUID NOT NULL,CONSTRAINT "prompt_tag_assignments_pkey" PRIMARY KEY ("prompt_id","tag_id"));
CREATE TABLE "prompt_library_versions" ("id" UUID NOT NULL,"prompt_id" UUID NOT NULL,"revision" INTEGER NOT NULL,"snapshot" JSONB NOT NULL,"change_summary" TEXT,"created_by" UUID NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"published_at" TIMESTAMP(3),CONSTRAINT "prompt_library_versions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "prompt_library_versions_prompt_id_revision_key" ON "prompt_library_versions"("prompt_id","revision");
CREATE INDEX "prompt_library_versions_prompt_id_published_at_idx" ON "prompt_library_versions"("prompt_id","published_at");
ALTER TABLE "prompt_categories" ADD CONSTRAINT "prompt_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "prompt_library_items" ADD CONSTRAINT "prompt_library_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "prompt_library_items" ADD CONSTRAINT "prompt_library_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "prompt_categories"("id") ON DELETE SET NULL;
ALTER TABLE "prompt_tag_assignments" ADD CONSTRAINT "prompt_tag_assignments_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompt_library_items"("id") ON DELETE CASCADE;
ALTER TABLE "prompt_tag_assignments" ADD CONSTRAINT "prompt_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "prompt_tags"("id") ON DELETE CASCADE;
ALTER TABLE "prompt_library_versions" ADD CONSTRAINT "prompt_library_versions_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompt_library_items"("id") ON DELETE CASCADE;

INSERT INTO "permissions" ("id", "code", "created_at", "updated_at")
SELECT gen_random_uuid(), code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('prompt.library.read'),
  ('prompt.library.write'),
  ('prompt.library.publish'),
  ('prompt.library.rollback'),
  ('prompt.library.archive'),
  ('prompt.library.manage')
) AS prompt_permissions(code)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), roles.id, permissions.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" roles
CROSS JOIN "permissions" permissions
WHERE roles."workspace_id" IS NULL
  AND roles."name" IN ('Owner', 'Administrator')
  AND permissions."code" LIKE 'prompt.library.%'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
