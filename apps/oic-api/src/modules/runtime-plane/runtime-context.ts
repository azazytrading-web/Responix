import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OicRuntimeContext, OicRuntimeRequest, OicTenantSelector } from "@oic/contracts";
import { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { OicRuntimeException } from "./runtime-errors";

export type RuntimeRequestIdentity = { requestId?: string; traceId?: string; callerRequestId?: string };

@Injectable()
export class RuntimeContextResolver {
  constructor(private readonly db: OicDatabaseService) {}

  async resolve(actor: AuthenticatedPrincipal, request: Pick<OicRuntimeRequest, "tenant">, identity: RuntimeRequestIdentity): Promise<OicRuntimeContext> {
    const tenantId = await this.resolveTenant(actor, request.tenant);
    return {
      requestId: identity.requestId ?? randomUUID(),
      traceId: identity.traceId ?? randomUUID(),
      applicationId: actor.applicationId,
      principalId: actor.id,
      tenantId,
      callerRequestId: identity.callerRequestId
    };
  }

  private async resolveTenant(actor: AuthenticatedPrincipal, selector?: OicTenantSelector): Promise<string | null> {
    if (!selector) return null;
    let tenantId: string | undefined;
    if (selector.kind === "id") {
      const tenant = await this.db.oicTenant.findFirst({
        where: { id: selector.tenantId, applicationId: actor.applicationId, status: "ACTIVE" }, select: { id: true }
      });
      tenantId = tenant?.id;
    } else {
      const reference = await this.db.oicTenantExternalReference.findFirst({
        where: {
          applicationId: actor.applicationId, sourceType: selector.sourceType,
          externalId: selector.externalId, revokedAt: null, tenant: { status: "ACTIVE" }
        }, select: { tenantId: true }
      });
      tenantId = reference?.tenantId;
    }
    if (!tenantId || !actor.tenantIds.includes(tenantId)) throw new OicRuntimeException("TENANT_NOT_ALLOWED");
    return tenantId;
  }
}
