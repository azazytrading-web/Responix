import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException, HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OicDatabaseService } from "@oic/database";
import { verifyCredential } from "./credential.crypto";

export const REQUIRED_SCOPES = "oic:required-scopes";
export type AuthenticatedPrincipal = { id: string; applicationId: string; scopes: string[]; tenantIds: string[] };
const rateWindows = new Map<string, { start: number; count: number }>();
type HttpRequest = { headers: Record<string, string | string[] | undefined>; principal?: AuthenticatedPrincipal; ip?: string };
export const RequireScopes = (...scopes: string[]) => SetMetadata(REQUIRED_SCOPES, scopes);
export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<HttpRequest>().principal);

@Injectable()
export class OicAuthenticationGuard implements CanActivate {
  constructor(private readonly db: OicDatabaseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const now = Date.now();
    const key = req.ip && /^[A-Fa-f0-9:.]{2,64}$/.test(req.ip) ? req.ip : "unknown";
    let window = rateWindows.get(key);
    if (!window || now - window.start >= 60_000) { window = { start: now, count: 0 }; rateWindows.set(key, window); }
    if (rateWindows.size > 10_000) {
      for (const [entry, value] of rateWindows) if (now - value.start >= 60_000) rateWindows.delete(entry);
      while (rateWindows.size > 10_000) rateWindows.delete(rateWindows.keys().next().value as string);
    }
    window.count += 1;
    const maximum = Number(process.env.OIC_AUTH_REQUESTS_PER_MINUTE ?? 120);
    if (window.count > maximum) throw new HttpException("Too many requests", 429);
    const authorization = req.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const match = /^Bearer oic_v1\.([A-Za-z0-9_-]{20,24})\.([A-Za-z0-9_-]{40,50})$/.exec(header ?? "");
    if (!match) throw new UnauthorizedException();
    const selector = match[1]; const secret = match[2];
    if (!selector || !secret) throw new UnauthorizedException();
    const credential = await this.db.oicMachineCredential.findUnique({
      where: { selector },
      include: { principal: { include: { application: true, scopes: { where: { revokedAt: null } }, tenantGrants: { where: { revokedAt: null } } } } }
    });
    if (credential?.status === "ACTIVE" && credential.expiresAt && credential.expiresAt <= new Date()) {
      void this.db.$transaction(async (tx) => {
        const changed = await tx.oicMachineCredential.updateMany({ where: { id: credential.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
        if (changed.count) await tx.oicAuditEvent.create({ data: { actorPrincipalId: null, applicationId: credential.principal.applicationId, action: "credential.expired", targetType: "credential", targetId: credential.id, metadata: { selector: credential.selector } } });
      }).catch(() => undefined);
      throw new UnauthorizedException();
    }
    if (!credential || credential.status !== "ACTIVE" || credential.revokedAt ||
      credential.principal.status !== "ACTIVE" || credential.principal.application.status !== "ACTIVE" ||
      !(await verifyCredential(secret, credential.verifier))) throw new UnauthorizedException();
    req.principal = {
      id: credential.principal.id,
      applicationId: credential.principal.applicationId,
      scopes: credential.principal.scopes.map((grant) => grant.scope),
      tenantIds: credential.principal.tenantGrants.map((grant) => grant.tenantId)
    };
    const staleBefore = new Date(Date.now() - 5 * 60_000);
    void this.db.oicMachineCredential.updateMany({
      where: { id: credential.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }] },
      data: { lastUsedAt: new Date() }
    }).catch(() => undefined);
    return true;
  }
}

@Injectable()
export class OicScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [context.getHandler(), context.getClass()]) ?? [];
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const scopes = req.principal?.scopes ?? [];
    if (required.every((scope) => scopes.includes(scope))) return true;
    throw new ForbiddenException();
  }
}