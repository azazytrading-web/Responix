-- WorkspaceMembership is the authorization source of truth. Preserve existing
-- users and workspaces while creating active memberships for legacy records.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'workspace.read', 'View the current workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workspace.update', 'Update workspace settings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workspace.members.read', 'List workspace members', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workspace.members.manage', 'Manage workspace memberships', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" (
  "id", "workspace_id", "name", "description", "priority", "system_role", "created_at", "updated_at"
)
SELECT gen_random_uuid(), NULL, 'Owner', 'Workspace owner', 1_000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "roles" WHERE "workspace_id" IS NULL AND "name" = 'Owner'
);

INSERT INTO "roles" (
  "id", "workspace_id", "name", "description", "priority", "system_role", "created_at", "updated_at"
)
SELECT gen_random_uuid(), NULL, 'ClientUser', 'Default workspace member', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "roles" WHERE "workspace_id" IS NULL AND "name" = 'ClientUser'
);

INSERT INTO "role_permissions" (
  "id", "role_id", "permission_id", "created_at", "updated_at"
)
SELECT gen_random_uuid(), role."id", permission."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."workspace_id" IS NULL
  AND role."name" IN ('Owner', 'Administrator')
  AND permission."code" IN (
    'workspace.read',
    'workspace.update',
    'workspace.members.read',
    'workspace.members.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "workspace_users" (
  "id", "workspace_id", "user_id", "role_id", "status", "invited_at", "accepted_at", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  user_record."workspace_id",
  user_record."id",
  CASE
    WHEN workspace."owner_user_id" = user_record."id" THEN (
      SELECT "id" FROM "roles" WHERE "workspace_id" IS NULL AND "name" = 'Owner' LIMIT 1
    )
    ELSE COALESCE(
      user_record."role_id",
      (SELECT "id" FROM "roles" WHERE "workspace_id" IS NULL AND "name" = 'ClientUser' LIMIT 1)
    )
  END,
  'ACTIVE'::"MembershipStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" AS user_record
INNER JOIN "workspaces" AS workspace ON workspace."id" = user_record."workspace_id"
WHERE user_record."deleted_at" IS NULL
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

UPDATE "workspace_users" AS membership
SET "role_id" = (
  SELECT "id" FROM "roles" WHERE "workspace_id" IS NULL AND "name" = 'ClientUser' LIMIT 1
)
WHERE membership."role_id" IS NULL;

UPDATE "workspace_users" AS membership
SET "role_id" = (
  SELECT "id" FROM "roles" WHERE "workspace_id" IS NULL AND "name" = 'Owner' LIMIT 1
),
    "status" = 'ACTIVE'::"MembershipStatus",
    "accepted_at" = COALESCE(membership."accepted_at", CURRENT_TIMESTAMP),
    "suspended_at" = NULL,
    "removed_at" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
FROM "workspaces" AS workspace
WHERE workspace."id" = membership."workspace_id"
  AND workspace."owner_user_id" = membership."user_id";

ALTER TABLE "workspace_users" ALTER COLUMN "role_id" SET NOT NULL;

ALTER TABLE "workspace_users" DROP CONSTRAINT "workspace_users_role_id_fkey";
ALTER TABLE "workspace_users"
  ADD CONSTRAINT "workspace_users_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "workspace_users_user_id_workspace_id_status_idx"
  ON "workspace_users"("user_id", "workspace_id", "status");
CREATE UNIQUE INDEX "workspace_users_id_workspace_id_key"
  ON "workspace_users"("id", "workspace_id");
CREATE INDEX "workspace_users_active_workspace_user_idx"
  ON "workspace_users"("workspace_id", "user_id")
  WHERE "status" = 'ACTIVE';
