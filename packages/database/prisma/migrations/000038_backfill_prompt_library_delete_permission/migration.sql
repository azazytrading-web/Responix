INSERT INTO "permissions" ("id", "code", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'prompt.library.delete', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), roles."id", permissions."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles"
JOIN "permissions" ON permissions."code" = 'prompt.library.delete'
WHERE roles."workspace_id" IS NULL
  AND roles."name" IN ('Owner', 'Administrator')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
