import { Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
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
      .getRequest<{ headers: { authorization?: string }; user?: unknown }>();
    const required = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass()
    ]);
    if (required) return true;
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException();
    try {
      request.user = await this.jwt.verifyAsync(token, {
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

  canActivate(context: ExecutionContext) {
    const required =
      this.reflector.getAllAndOverride<string[]>("permissions", [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    const user = context.switchToHttp().getRequest<{ user?: { permissions?: string[] } }>().user;
    return required.every((permission) => user?.permissions?.includes(permission));
  }
}
