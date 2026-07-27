ALTER TABLE "workspaces" ADD COLUMN "permission_revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "temporary_role_assignments" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "start_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "temporary_role_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "temporary_role_assignments_workspace_id_user_id_start_at_expires_at_idx"
  ON "temporary_role_assignments"("workspace_id", "user_id", "start_at", "expires_at");
ALTER TABLE "temporary_role_assignments" ADD CONSTRAINT "temporary_role_assignments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_role_assignments" ADD CONSTRAINT "temporary_role_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_role_assignments" ADD CONSTRAINT "temporary_role_assignments_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "temporary_permission_assignments" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "effect" "PermissionOverrideEffect" NOT NULL,
  "start_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "temporary_permission_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "temporary_permission_assignments_workspace_id_user_id_start_at_expires_at_idx"
  ON "temporary_permission_assignments"("workspace_id", "user_id", "start_at", "expires_at");
ALTER TABLE "temporary_permission_assignments" ADD CONSTRAINT "temporary_permission_assignments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_permission_assignments" ADD CONSTRAINT "temporary_permission_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_permission_assignments" ADD CONSTRAINT "temporary_permission_assignments_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
