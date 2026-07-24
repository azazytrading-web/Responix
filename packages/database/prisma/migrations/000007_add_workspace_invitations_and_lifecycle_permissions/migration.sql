INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'workspace.create', 'Create a workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" (
  "id", "role_id", "permission_id", "created_at", "updated_at"
)
SELECT gen_random_uuid(), role."id", permission."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" AS role
INNER JOIN "permissions" AS permission ON permission."code" = 'workspace.create'
WHERE role."workspace_id" IS NULL
  AND role."name" IN ('Owner', 'Administrator')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

CREATE TABLE "workspace_invitations" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "invited_by_user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_invitations_token_hash_key" ON "workspace_invitations"("token_hash");
CREATE INDEX "workspace_invitations_workspace_id_expires_at_idx"
  ON "workspace_invitations"("workspace_id", "expires_at");
CREATE INDEX "workspace_invitations_membership_id_created_at_idx"
  ON "workspace_invitations"("membership_id", "created_at");
CREATE INDEX "workspace_invitations_target_user_id_expires_at_idx"
  ON "workspace_invitations"("target_user_id", "expires_at");

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "workspace_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_last_active_workspace_owner_change"()
RETURNS TRIGGER AS $$
DECLARE
  old_role_is_owner BOOLEAN;
  new_role_is_owner BOOLEAN;
BEGIN
  SELECT "name" = 'Owner' INTO old_role_is_owner FROM "roles" WHERE "id" = OLD."role_id";
  SELECT "name" = 'Owner' INTO new_role_is_owner FROM "roles" WHERE "id" = NEW."role_id";

  IF OLD."status" = 'ACTIVE'
    AND COALESCE(old_role_is_owner, false)
    AND (NEW."status" <> 'ACTIVE' OR NOT COALESCE(new_role_is_owner, false))
    AND NOT EXISTS (
      SELECT 1
      FROM "workspace_users" AS membership
      INNER JOIN "roles" AS role ON role."id" = membership."role_id"
      WHERE membership."workspace_id" = OLD."workspace_id"
        AND membership."id" <> OLD."id"
        AND membership."status" = 'ACTIVE'
        AND role."name" = 'Owner'
        AND role."deleted_at" IS NULL
    ) THEN
    RAISE EXCEPTION 'A workspace must retain at least one active owner';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "workspace_users_prevent_last_owner_change"
BEFORE UPDATE OF "status", "role_id" ON "workspace_users"
FOR EACH ROW EXECUTE FUNCTION "prevent_last_active_workspace_owner_change"();
