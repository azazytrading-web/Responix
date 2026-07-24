import { SetMetadata } from "@nestjs/common";

export const ALLOW_INACTIVE_WORKSPACE = "allowInactiveWorkspace";
export const SKIP_TENANT_CONTEXT = "skipTenantContext";

export const AllowInactiveWorkspace = () => SetMetadata(ALLOW_INACTIVE_WORKSPACE, true);
export const SkipTenantContext = () => SetMetadata(SKIP_TENANT_CONTEXT, true);
