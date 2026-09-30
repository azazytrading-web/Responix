import { Injectable } from "@nestjs/common";
import { OicDatabaseService } from "@oic/database";
import type { OicModelResolver, OicRuntimeContext, OicResolvedModel, OicRuntimeRequest, OicVisibleModel } from "@oic/contracts";

export const OIC_MODEL_RESOLVER = Symbol("OIC_MODEL_RESOLVER");

/** Production remains closed if the resolver is not wired. */
export class UnavailableOicModelResolver implements OicModelResolver {
  resolve(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<OicResolvedModel | null> {
    void model; void context;
    return Promise.resolve(null);
  }
  listVisible(context: OicRuntimeContext): Promise<OicVisibleModel[]> { void context; return Promise.resolve([]); }
}

type ResolvedOicModel = OicResolvedModel & { revisionId: string; variantId: string; bindingId: string };

/** Resolves only explicitly visible production editions with an active scope-matching binding. */
@Injectable()
export class DatabaseOicModelResolver implements OicModelResolver {
  constructor(private readonly db: OicDatabaseService) {}

  async resolve(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<OicResolvedModel | null> {
    const edition = await this.db.oicModelEdition.findFirst({
      where: {
        publicId: model, lifecycle: "PRODUCTION", visibility: { some: { applicationId: context.applicationId } },
        bindings: { some: { status: "ACTIVE", environment: "production", connection: { status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: { not: null } }, OR: [
          ...(context.tenantId ? [{ scope: "TENANT" as const, tenantId: context.tenantId, applicationId: context.applicationId }] : []),
          { scope: "APPLICATION", applicationId: context.applicationId }, { scope: "PLATFORM", applicationId: null, tenantId: null }
        ] } }
      },
      include: { bindings: { where: { status: "ACTIVE", environment: "production", connection: { status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: { not: null } } }, include: { variant: { include: { revision: true } } } } }
    });
    if (!edition) return null;
    const rank = (binding: (typeof edition.bindings)[number]) => binding.scope === "TENANT" && binding.tenantId === context.tenantId ? 0 : binding.scope === "APPLICATION" && binding.applicationId === context.applicationId ? 1 : binding.scope === "PLATFORM" ? 2 : 3;
    const binding = [...edition.bindings].filter((candidate) => rank(candidate) < 3).sort((left, right) => rank(left) - rank(right) || left.id.localeCompare(right.id))[0];
    if (!binding || binding.variant.revision.editionId !== edition.id) return null;
    return {
      id: edition.publicId as OicResolvedModel["id"], displayName: edition.displayName,
      capabilities: ["text.generate", "text.stream"], resolverVersion: "oic-model-resolver-v1",
      revisionId: binding.variant.revisionId, variantId: binding.variantId, bindingId: binding.id
    } as ResolvedOicModel;
  }

  async listVisible(context: OicRuntimeContext): Promise<OicVisibleModel[]> {
    const editions = await this.db.oicModelEdition.findMany({
      where: {
        lifecycle: "PRODUCTION", visibility: { some: { applicationId: context.applicationId } },
        bindings: { some: { status: "ACTIVE", environment: "production", connection: { status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: { not: null } }, OR: [
          ...(context.tenantId ? [{ scope: "TENANT" as const, tenantId: context.tenantId, applicationId: context.applicationId }] : []),
          { scope: "APPLICATION", applicationId: context.applicationId }, { scope: "PLATFORM", applicationId: null, tenantId: null }
        ] } }
      }, select: { publicId: true, displayName: true }, orderBy: [{ publicId: "asc" }, { id: "asc" }]
    });
    return editions.map((edition) => ({ id: edition.publicId as OicVisibleModel["id"], displayName: edition.displayName, capabilities: ["text.generate", "text.stream"] }));
  }
}
