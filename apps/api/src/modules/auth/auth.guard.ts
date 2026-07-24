import { Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { TenantRequest } from "../tenant/tenant-context.service";
import type { AuthClaims } from "./auth.types";
import { SKIP_TENANT_CONTEXT } from "../tenant/tenant.metadata";
import { PermissionDeniedException } from "../../common/domain-errors";
export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Permissions = (...permissions: string[]) => SetMetadata("permissions", permissions);
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user?: AuthClaims }>();
    const required = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass()
    ]);
    if (required) return true;
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException();
    try {
      request.user = await this.jwt.verifyAsync<AuthClaims>(token, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET")
      });
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>("permissions", [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass()
    ]);
    const skipTenantContext = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CONTEXT, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic || skipTenantContext || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<TenantRequest>();
    if (!required.every((permission) => request.tenantContext?.permissions.includes(permission))) {
      throw new PermissionDeniedException();
    }
    return true;
  }
}
