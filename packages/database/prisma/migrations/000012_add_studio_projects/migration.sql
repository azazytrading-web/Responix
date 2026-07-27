CREATE TYPE "StudioProjectStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "studio_projects" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "StudioProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "draft" JSONB NOT NULL DEFAULT '{}',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "studio_projects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "studio_projects_workspace_id_slug_key" ON "studio_projects"("workspace_id", "slug");
CREATE INDEX "studio_projects_workspace_id_status_updated_at_idx" ON "studio_projects"("workspace_id", "status", "updated_at");
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "studio_project_revisions" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "change_summary" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "studio_project_revisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "studio_project_revisions_project_id_revision_key" ON "studio_project_revisions"("project_id", "revision");
CREATE INDEX "studio_project_revisions_project_id_published_at_idx" ON "studio_project_revisions"("project_id", "published_at");
ALTER TABLE "studio_project_revisions" ADD CONSTRAINT "studio_project_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
