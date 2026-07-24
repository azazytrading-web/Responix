CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

CREATE TABLE "workspace_users" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_users_workspace_id_user_id_key" ON "workspace_users"("workspace_id", "user_id");
CREATE INDEX "workspace_users_workspace_id_status_idx" ON "workspace_users"("workspace_id", "status");
CREATE INDEX "workspace_users_user_id_status_idx" ON "workspace_users"("user_id", "status");
ALTER TABLE "workspace_users" ADD CONSTRAINT "workspace_users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_users" ADD CONSTRAINT "workspace_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_users" ADD CONSTRAINT "workspace_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
