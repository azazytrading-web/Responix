CREATE TYPE "PermissionOverrideEffect" AS ENUM ('GRANT', 'REVOKE');
CREATE TYPE "FeatureFlagState" AS ENUM ('ENABLED', 'DISABLED', 'HIDDEN');

ALTER TABLE "permissions" ADD COLUMN "permission_group_id" UUID;
ALTER TABLE "plans" ADD COLUMN "grace_period_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN "metadata" JSONB;
ALTER TABLE "subscriptions" ADD COLUMN "grace_ends_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "metadata" JSONB;
ALTER TABLE "feature_flags" ADD COLUMN "state" "FeatureFlagState" NOT NULL DEFAULT 'DISABLED';
ALTER TABLE "feature_flags" ADD COLUMN "experimental" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "feature_flags" ADD COLUMN "dependencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "feature_flags" ADD COLUMN "metadata" JSONB;
ALTER TABLE "feature_flags" DROP CONSTRAINT "feature_flags_feature_name_key";
CREATE UNIQUE INDEX "feature_flags_workspace_id_feature_name_key" ON "feature_flags"("workspace_id", "feature_name");

CREATE TABLE "permission_groups" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permission_groups_key_key" ON "permission_groups"("key");
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_permission_group_id_fkey" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "permissions_permission_group_id_idx" ON "permissions"("permission_group_id");

CREATE TABLE "permission_inheritance" (
  "id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "inherited_permission_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_inheritance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permission_inheritance_permission_id_inherited_permission_id_key" ON "permission_inheritance"("permission_id", "inherited_permission_id");
CREATE INDEX "permission_inheritance_inherited_permission_id_idx" ON "permission_inheritance"("inherited_permission_id");
ALTER TABLE "permission_inheritance" ADD CONSTRAINT "permission_inheritance_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permission_inheritance" ADD CONSTRAINT "permission_inheritance_inherited_permission_id_fkey" FOREIGN KEY ("inherited_permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "role_inheritance" (
  "id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "parent_role_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_inheritance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_inheritance_role_id_parent_role_id_key" ON "role_inheritance"("role_id", "parent_role_id");
CREATE INDEX "role_inheritance_parent_role_id_idx" ON "role_inheritance"("parent_role_id");
ALTER TABLE "role_inheritance" ADD CONSTRAINT "role_inheritance_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_inheritance" ADD CONSTRAINT "role_inheritance_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workspace_permission_overrides" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "effect" "PermissionOverrideEffect" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_permission_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspace_permission_overrides_workspace_id_permission_id_key" ON "workspace_permission_overrides"("workspace_id", "permission_id");
CREATE INDEX "workspace_permission_overrides_permission_id_idx" ON "workspace_permission_overrides"("permission_id");
ALTER TABLE "workspace_permission_overrides" ADD CONSTRAINT "workspace_permission_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_permission_overrides" ADD CONSTRAINT "workspace_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_permission_overrides" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "effect" "PermissionOverrideEffect" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_permission_overrides_workspace_id_user_id_permission_id_key" ON "user_permission_overrides"("workspace_id", "user_id", "permission_id");
CREATE INDEX "user_permission_overrides_workspace_id_user_id_idx" ON "user_permission_overrides"("workspace_id", "user_id");
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "plan_entitlements" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plan_entitlements_plan_id_key_key" ON "plan_entitlements"("plan_id", "key");
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workspace_branding" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "app_name" TEXT,
  "accent_color" TEXT,
  "dark_theme" JSONB,
  "light_theme" JSONB,
  "fonts" JSONB,
  "icons" JSONB,
  "favicon_metadata" JSONB,
  "email_branding" JSONB,
  "login_background" TEXT,
  "dashboard_style" JSONB,
  "locale" TEXT,
  "date_format" TEXT,
  "time_format" TEXT,
  "direction" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_branding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspace_branding_workspace_id_key" ON "workspace_branding"("workspace_id");
ALTER TABLE "workspace_branding" ADD CONSTRAINT "workspace_branding_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workspace_platform_manifests" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "schema_version" TEXT NOT NULL,
  "compatibility_version" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "manifest" JSONB NOT NULL,
  "migration_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_platform_manifests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspace_platform_manifests_workspace_id_key" ON "workspace_platform_manifests"("workspace_id");
ALTER TABLE "workspace_platform_manifests" ADD CONSTRAINT "workspace_platform_manifests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
