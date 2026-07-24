import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { TenantRequest } from "../tenant/tenant-context.service";
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<TenantRequest>().tenantContext?.user
);
export const CurrentWorkspace = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<TenantRequest>().tenantContext?.workspace
);
export const CurrentMembership = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<TenantRequest>().tenantContext?.membership
);
