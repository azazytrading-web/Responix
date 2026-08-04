import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC } from "../auth/auth.guard";
import type { TenantRequest } from "./tenant-context.service";
import { SKIP_TENANT_CONTEXT } from "./tenant.metadata";

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context) || this.shouldSkipTenantContext(context)) return true;
    const tenantContext = context.switchToHttp().getRequest<TenantRequest>().tenantContext;
    if (!tenantContext) {
      throw new UnauthorizedException("Tenant context has not been resolved");
    }
    if (tenantContext.membership.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace membership is required");
    }
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass()
      ]) ?? false
    );
  }

  private shouldSkipTenantContext(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CONTEXT, [
        context.getHandler(),
        context.getClass()
      ]) ?? false
    );
  }
}
