import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@oic/database";
import { createHash } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import { AuthenticatedPrincipal } from "./auth.guard";
import { issueCredential } from "./credential.crypto";
import { OIC_FOUNDATION_ADMIN_SCOPES } from "./foundation-policy";
import { FoundationAuditWriter, OIC_FOUNDATION_AUDIT_WRITER } from "./foundation-audit-writer";

export const OIC_SCOPES = OIC_FOUNDATION_ADMIN_SCOPES;
export type AuditContext = { requestId?: string; traceId?: string };
type IdempotencyResult<T> = { value: T; replayed: boolean };
type MakeResult<T> = { value: T; resultRef: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function isUniqueConflict(error: unknown): boolean { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"; }
function safeMeta(request: AuditContext) {
  const bounded = (value: string | undefined) => value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : undefined;
  return { requestId: bounded(request.requestId), traceId: bounded(request.traceId) };
}

@Injectable()
export class FoundationService {
  constructor(private readonly db: OicDatabaseService, @Inject(OIC_FOUNDATION_AUDIT_WRITER) private readonly auditWriter: FoundationAuditWriter) {}

  private requireApp(actor: AuthenticatedPrincipal, applicationId: string): void {
    if (!actor.scopes.includes("oic:foundation:admin") && actor.applicationId !== applicationId) throw new NotFoundException();
  }
  private async requireTenant(actor: AuthenticatedPrincipal, tenantId: string): Promise<{ id: string; applicationId: string }> {
    const tenant = await this.db.oicTenant.findUnique({ where: { id: tenantId }, select: { id: true, applicationId: true, status: true } });
    if (!tenant || tenant.status !== "ACTIVE") throw new NotFoundException();
    this.requireApp(actor, tenant.applicationId);
    if (!actor.scopes.includes("oic:foundation:admin") && !actor.tenantIds.includes(tenant.id)) throw new NotFoundException();
    return { id: tenant.id, applicationId: tenant.applicationId };
  }  private audit(tx: Prisma.TransactionClient, actor: AuthenticatedPrincipal, action: string, targetType: string, targetId: string, applicationId: string | null, tenantId: string | null, request: AuditContext, metadata: Prisma.InputJsonObject = {}) {
    const ids = safeMeta(request);
    return this.auditWriter.write(tx, {
      actorPrincipalId: actor.id, applicationId, tenantId, action, targetType, targetId,
      requestId: ids.requestId, traceId: ids.traceId, metadata
    });
  }  private async idempotent<T>(actor: AuthenticatedPrincipal, scope: string, operation: string, key: string, input: unknown,
    make: (tx: Prisma.TransactionClient) => Promise<MakeResult<T>>,
    replay: (tx: Prisma.TransactionClient, resultRef: string) => Promise<T>): Promise<IdempotencyResult<T>> {
    if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) throw new ConflictException("A valid Idempotency-Key is required");
    const requestHash = createHash("sha256").update(canonical(input)).digest("hex");
    const run = () => this.db.$transaction(async (tx) => {
      const where = { principalId_scope_operation_key: { principalId: actor.id, scope, operation, key } };
      const existing = await tx.oicIdempotencyRecord.findUnique({ where });
      if (existing) {
        if (existing.expiresAt <= new Date()) await tx.oicIdempotencyRecord.delete({ where: { id: existing.id } });
        else {
          if (existing.requestHash !== requestHash) throw new ConflictException("Idempotency key conflicts with another request");
          if (!existing.resultRef) throw new ConflictException("Idempotent result is unavailable");
          return { value: await replay(tx, existing.resultRef), replayed: true };
        }
      }
      const result = await make(tx);
      await tx.oicIdempotencyRecord.create({ data: {
        principalId: actor.id, scope, operation, key, requestHash, resultRef: result.resultRef,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000), status: "COMPLETED"
      } });
      return { value: result.value, replayed: false };
    });
    try { return await run(); }
    catch (error) {
      if (!isUniqueConflict(error)) throw error;
      return run();
    }
  }
  private assertGrantAuthority(actor: AuthenticatedPrincipal, scope: string): void {
    if (!OIC_SCOPES.includes(scope as typeof OIC_SCOPES[number])) throw new ForbiddenException();
    if (!actor.scopes.includes("oic:foundation:admin") && !actor.scopes.includes(scope)) throw new ForbiddenException();
  }

  async createApplication(actor: AuthenticatedPrincipal, input: { key: string; displayName: string }, key: string, request: AuditContext) {
    if (!actor.scopes.includes("oic:foundation:admin")) throw new ForbiddenException();
    return this.idempotent(actor, "oic:applications:manage", "application.create", key, input,
      async (tx) => {
        const value = await tx.oicApplication.create({ data: input });
        await this.audit(tx, actor, "application.created", "application", value.id, value.id, null, request);
        return { value, resultRef: value.id };
      }, async (tx, id) => tx.oicApplication.findUniqueOrThrow({ where: { id } }));
  }
  async getApplication(actor: AuthenticatedPrincipal, id: string) {
    this.requireApp(actor, id);
    const value = await this.db.oicApplication.findUnique({ where: { id } });
    if (!value) throw new NotFoundException();
    return value;
  }
  async createTenant(actor: AuthenticatedPrincipal, applicationId: string, input: { key?: string; displayName: string }, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    const application = await this.db.oicApplication.findFirst({ where: { id: applicationId, status: "ACTIVE" }, select: { id: true } });
    if (!application) throw new NotFoundException();
    return this.idempotent(actor, "oic:tenants:manage", "tenant.create", key, { applicationId, ...input },
      async (tx) => {
        const value = await tx.oicTenant.create({ data: { applicationId, ...input } });
        await this.audit(tx, actor, "tenant.created", "tenant", value.id, applicationId, value.id, request);
        return { value, resultRef: value.id };
      }, async (tx,id) => tx.oicTenant.findUniqueOrThrow({ where: { id } }));
  }
  async getTenant(actor: AuthenticatedPrincipal, id: string) {
    await this.requireTenant(actor, id);
    return this.db.oicTenant.findUniqueOrThrow({ where: { id }, include: { references: { where: { revokedAt: null }, select: { id: true, sourceType: true, externalId: true, createdAt: true } } } });
  }
  async createExternalReference(actor: AuthenticatedPrincipal, applicationId: string, tenantId: string, input: { sourceType: string; externalId: string }, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    const tenant = await this.requireTenant(actor, tenantId);
    if (tenant.applicationId !== applicationId) throw new NotFoundException();
    return this.idempotent(actor, "oic:tenants:manage", "tenant.external-reference.create", key, { applicationId, tenantId, ...input },
      async (tx) => {
        const value = await tx.oicTenantExternalReference.create({ data: { applicationId, tenantId, ...input } });
        await this.audit(tx, actor, "tenant.external-reference.created", "external-reference", value.id, applicationId, tenantId, request, { sourceType: input.sourceType });
        return { value: { id: value.id, sourceType: value.sourceType, externalId: value.externalId, tenantId: value.tenantId }, resultRef: value.id };
      }, async (tx,id) => {
        const value = await tx.oicTenantExternalReference.findUniqueOrThrow({ where: { id } });
        return { id: value.id, sourceType: value.sourceType, externalId: value.externalId, tenantId: value.tenantId };
      });
  }
  async createPrincipal(actor: AuthenticatedPrincipal, applicationId: string, input: { key: string; displayName: string }, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    const application = await this.db.oicApplication.findFirst({ where: { id: applicationId, status: "ACTIVE" }, select: { id: true } });
    if (!application) throw new NotFoundException();
    return this.idempotent(actor, "oic:principals:manage", "principal.create", key, { applicationId, ...input },
      async (tx) => {
        const value = await tx.oicServicePrincipal.create({ data: { applicationId, ...input } });
        await this.audit(tx, actor, "principal.created", "service-principal", value.id, applicationId, null, request);
        return { value, resultRef: value.id };
      }, async (tx,id) => tx.oicServicePrincipal.findUniqueOrThrow({ where: { id } }));
  }
  async grantScope(actor: AuthenticatedPrincipal, applicationId: string, principalId: string, scope: string, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId); this.assertGrantAuthority(actor, scope);
    if (scope === "oic:foundation:admin" && !actor.scopes.includes("oic:foundation:admin")) throw new ForbiddenException();
    const principal = await this.db.oicServicePrincipal.findFirst({ where: { id: principalId, applicationId }, select: { id: true } });
    if (!principal) throw new NotFoundException();
    return this.idempotent(actor, "oic:principals:manage", "principal.scope.grant", key, { applicationId, principalId, scope },
      async (tx) => {
        const value = await tx.oicPrincipalScopeGrant.upsert({
          where: { principalId_scope: { principalId, scope } },
          create: { applicationId, principalId, scope, grantedBy: actor.id },
          update: { revokedAt: null, grantedBy: actor.id, grantedAt: new Date() }
        });
        await this.audit(tx, actor, "principal.scope.granted", "service-principal", principalId, applicationId, null, request, { scope });
        return { value: { id: value.id, principalId, scope, grantedAt: value.grantedAt }, resultRef: value.id };
      }, async (tx,id) => {
        const value = await tx.oicPrincipalScopeGrant.findUniqueOrThrow({ where: { id } });
        return { id: value.id, principalId: value.principalId, scope: value.scope, grantedAt: value.grantedAt };
      });
  }
  async grantTenant(actor: AuthenticatedPrincipal, applicationId: string, principalId: string, tenantId: string, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    if (!actor.scopes.includes("oic:foundation:admin") && !actor.scopes.includes("oic:tenants:manage")) throw new ForbiddenException();
    const targetTenant = await this.requireTenant(actor, tenantId);
    if (targetTenant.applicationId !== applicationId) throw new NotFoundException();
    const [principal, tenant] = await Promise.all([
      this.db.oicServicePrincipal.findFirst({ where: { id: principalId, applicationId }, select: { id: true } }),
      this.db.oicTenant.findFirst({ where: { id: tenantId, applicationId }, select: { id: true } })
    ]);
    if (!principal || !tenant) throw new NotFoundException();
    return this.idempotent(actor, "oic:tenants:manage", "principal.tenant.grant", key, { applicationId, principalId, tenantId },
      async (tx) => {
        const value = await tx.oicPrincipalTenantGrant.upsert({
          where: { principalId_tenantId: { principalId, tenantId } },
          create: { applicationId, principalId, tenantId, grantedBy: actor.id },
          update: { revokedAt: null, grantedBy: actor.id, grantedAt: new Date() }
        });
        await this.audit(tx, actor, "principal.tenant.granted", "service-principal", principalId, applicationId, tenantId, request);
        return { value: { id: value.id, principalId, tenantId }, resultRef: value.id };
      }, async (tx,id) => {
        const value = await tx.oicPrincipalTenantGrant.findUniqueOrThrow({ where: { id } });
        return { id: value.id, principalId: value.principalId, tenantId: value.tenantId };
      });
  }
  async revokeTenant(actor: AuthenticatedPrincipal, applicationId: string, principalId: string, tenantId: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    if (!actor.scopes.includes("oic:foundation:admin") && !actor.scopes.includes("oic:tenants:manage")) throw new ForbiddenException();
    const tenant = await this.db.oicTenant.findFirst({ where: { id: tenantId, applicationId }, select: { id: true } });
    if (!tenant) throw new NotFoundException();
    await this.db.$transaction(async (tx) => {
      const changed = await tx.oicPrincipalTenantGrant.updateMany({ where: { principalId, tenantId, applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (changed.count) await this.audit(tx, actor, "principal.tenant.revoked", "service-principal", principalId, applicationId, tenantId, request);
    });
    return { revoked: true };
  }
  async issueCredential(actor: AuthenticatedPrincipal, applicationId: string, principalId: string, expiresAt: Date | null, replacesId: string | null, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    const principal = await this.db.oicServicePrincipal.findFirst({ where: { id: principalId, applicationId, status: "ACTIVE" }, select: { id: true } });
    if (!principal) throw new NotFoundException();
    if (expiresAt && expiresAt <= new Date()) throw new ConflictException("Credential expiry must be in the future");
    const issued = await issueCredential();
    try {
      const result = await this.idempotent<{ id: string; selector: string; status: string; createdAt: Date; expiresAt: Date | null; credential: string | null }>(actor, "oic:credentials:rotate", "credential.issue", key, { applicationId, principalId, expiresAt: expiresAt?.toISOString() ?? null, replacesId },
        async (tx) => {
          if (replacesId) {
            const old = await tx.oicMachineCredential.findFirst({ where: { id: replacesId, principalId, status: "ACTIVE", revokedAt: null } });
            if (!old) throw new NotFoundException();
          }
          const value = await tx.oicMachineCredential.create({ data: { principalId, selector: issued.selector, verifier: issued.verifier, expiresAt, replaces: replacesId ? { connect: { id: replacesId } } : undefined } });
          if (replacesId) await tx.oicMachineCredential.update({ where: { id: replacesId }, data: { status: "REVOKED", revokedAt: new Date(), replacedById: value.id } });
          await this.audit(tx, actor, replacesId ? "credential.rotated" : "credential.issued", "credential", value.id, applicationId, null, request, { selector: value.selector, verifierVersion: 1 });
          return { value: { id: value.id, selector: value.selector, status: value.status, createdAt: value.createdAt, expiresAt: value.expiresAt, credential: issued.token }, resultRef: value.id };
        }, async (tx,id) => {
          const value = await tx.oicMachineCredential.findUniqueOrThrow({ where: { id } });
          return { id: value.id, selector: value.selector, status: value.status, createdAt: value.createdAt, expiresAt: value.expiresAt, credential: null };
        });
      return { ...result.value, replayed: result.replayed };
    } finally { issued.verifier = ""; issued.token = ""; }
  }
  async revokeCredential(actor: AuthenticatedPrincipal, applicationId: string, credentialId: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    await this.db.$transaction(async (tx) => {
      const credential = await tx.oicMachineCredential.findFirst({ where: { id: credentialId, principal: { applicationId } }, select: { id: true, status: true } });
      if (!credential) throw new NotFoundException();
      if (credential.status === "ACTIVE") {
        await tx.oicMachineCredential.update({ where: { id: credential.id }, data: { status: "REVOKED", revokedAt: new Date() } });
        await this.audit(tx, actor, "credential.revoked", "credential", credential.id, applicationId, null, request);
      }
    });
    return { revoked: true };
  }
  async revokeScope(actor: AuthenticatedPrincipal, applicationId: string, principalId: string, scope: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    this.assertGrantAuthority(actor, scope);
    if (scope === "oic:foundation:admin" && (!actor.scopes.includes("oic:foundation:admin") || actor.id === principalId)) throw new ForbiddenException();
    return this.db.$transaction(async (tx) => {
      const grant = await tx.oicPrincipalScopeGrant.findFirst({ where: { applicationId, principalId, scope, revokedAt: null } });
      if (!grant) return { revoked: true };
      await tx.oicPrincipalScopeGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
      await this.audit(tx, actor, "principal.scope.revoked", "service-principal", principalId, applicationId, null, request, { scope });
      return { revoked: true };
    });
  }

  async remapExternalReference(actor: AuthenticatedPrincipal, applicationId: string, referenceId: string, tenantId: string, key: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    const reference = await this.db.oicTenantExternalReference.findFirst({ where: { id: referenceId, applicationId }, select: { id: true, tenantId: true, sourceType: true, revokedAt: true } });
    if (!reference || !reference.revokedAt) throw new NotFoundException();
    await this.requireTenant(actor, reference.tenantId);
    const destination = await this.requireTenant(actor, tenantId);
    if (destination.applicationId !== applicationId) throw new NotFoundException();
    return this.idempotent(actor, "oic:tenants:manage", "tenant.external-reference.remap", key, { applicationId, referenceId, tenantId },
      async (tx) => {
        const value = await tx.oicTenantExternalReference.update({ where: { id: reference.id }, data: { tenantId, revokedAt: null } });
        await this.audit(tx, actor, "tenant.external-reference.remapped", "external-reference", value.id, applicationId, tenantId, request, { fromTenantId: reference.tenantId, sourceType: reference.sourceType });
        return { value: { id: value.id, sourceType: value.sourceType, tenantId: value.tenantId, externalId: value.externalId }, resultRef: value.id };
      }, async (tx,id) => {
        const value = await tx.oicTenantExternalReference.findUniqueOrThrow({ where: { id } });
        return { id: value.id, sourceType: value.sourceType, tenantId: value.tenantId, externalId: value.externalId };
      });
  }
  async revokeExternalReference(actor: AuthenticatedPrincipal, applicationId: string, referenceId: string, request: AuditContext) {
    this.requireApp(actor, applicationId);
    const reference = await this.db.oicTenantExternalReference.findFirst({ where: { id: referenceId, applicationId }, select: { id: true, tenantId: true, revokedAt: true } });
    if (!reference) throw new NotFoundException();
    await this.requireTenant(actor, reference.tenantId);
    if (reference.revokedAt) return { revoked: true };
    await this.db.$transaction(async (tx) => {
      await tx.oicTenantExternalReference.update({ where: { id: reference.id }, data: { revokedAt: new Date() } });
      await this.audit(tx, actor, "tenant.external-reference.revoked", "external-reference", reference.id, applicationId, reference.tenantId, request);
    });
    return { revoked: true };
  }

  async getPrincipal(actor: AuthenticatedPrincipal, applicationId: string, principalId: string) {
    this.requireApp(actor, applicationId);
    const value = await this.db.oicServicePrincipal.findFirst({
      where: { id: principalId, applicationId },
      include: {
        scopes: { where: { revokedAt: null }, select: { scope: true, grantedAt: true } },
        tenantGrants: { where: { revokedAt: null }, select: { tenantId: true, grantedAt: true } },
        credentials: { select: { id: true, selector: true, status: true, createdAt: true, expiresAt: true, revokedAt: true, lastUsedAt: true, replacedById: true } }
      }
    });
    if (!value) throw new NotFoundException();
    return value;
  }

  async changeLifecycle(actor: AuthenticatedPrincipal, kind: "application" | "tenant" | "principal", applicationId: string, id: string, status: "ACTIVE" | "SUSPENDED" | "ARCHIVED", request: AuditContext) {
    this.requireApp(actor, applicationId);
    if (!actor.scopes.includes("oic:foundation:admin")) throw new ForbiddenException();
    return this.db.$transaction(async (tx) => {
      if (kind === "application") {
        if (id !== applicationId) throw new NotFoundException();
        const current = await tx.oicApplication.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!current) throw new NotFoundException();
        if (current.status === "ARCHIVED" && status !== "ARCHIVED") throw new ConflictException("Archived identity cannot be reactivated");
        const updated = await tx.oicApplication.update({ where: { id }, data: { status } });
        if (current.status !== status) await this.audit(tx, actor, "application.status.changed", "application", id, applicationId, null, request, { from: current.status, to: status });
        return updated;
      }
      if (kind === "tenant") {
        const current = await tx.oicTenant.findFirst({ where: { id, applicationId }, select: { id: true, status: true } });
        if (!current) throw new NotFoundException();
        if (current.status === "ARCHIVED" && status !== "ARCHIVED") throw new ConflictException("Archived identity cannot be reactivated");
        const updated = await tx.oicTenant.update({ where: { id }, data: { status } });
        if (current.status !== status) await this.audit(tx, actor, "tenant.status.changed", "tenant", id, applicationId, id, request, { from: current.status, to: status });
        return updated;
      }
      const current = await tx.oicServicePrincipal.findFirst({ where: { id, applicationId }, select: { id: true, status: true } });
      if (!current) throw new NotFoundException();
      if (current.status === "ARCHIVED" && status !== "ARCHIVED") throw new ConflictException("Archived identity cannot be reactivated");
      const updated = await tx.oicServicePrincipal.update({ where: { id }, data: { status } });
      if (current.status !== status) await this.audit(tx, actor, "principal.status.changed", "service-principal", id, applicationId, null, request, { from: current.status, to: status });
      return updated;
    });
  }
  async readAudit(actor: AuthenticatedPrincipal, applicationId: string | undefined, limit: number) {
    if (!actor.scopes.includes("oic:foundation:admin")) {
      if (applicationId && applicationId !== actor.applicationId) throw new NotFoundException();
      applicationId = actor.applicationId;
    }
    const where: Prisma.OicAuditEventWhereInput = applicationId ? { applicationId } : {};
    if (!actor.scopes.includes("oic:foundation:admin")) where.OR = [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }];
    return this.db.oicAuditEvent.findMany({ where, orderBy: { occurredAt: "desc" }, take: Math.min(100, Math.max(1, limit)) });
  }
}
