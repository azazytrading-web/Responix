import { Injectable } from "@nestjs/common";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { OicModelResolver, OicRuntimeContext, OicResolvedModel, OicRuntimeRequest, OicVisibleModel } from "@oic/contracts";
import { policyFromRevision, FAST_POLICY } from "../intelligence/engines/profile-policy";

export const OIC_MODEL_RESOLVER = Symbol("OIC_MODEL_RESOLVER");

export type SafeModelResolutionDiagnostic = {
  operationId: "OIC_MODEL_EDITION_FIND_FIRST";
  prismaErrorType: string;
  prismaErrorCode: string | null;
  modelName: "OicModelEdition";
  safeDatabaseMeta: Record<string, string>;
  inputShape: { applicationScoped: true; tenantScoped: boolean; modelIdValid: boolean };
};

export class OicModelResolutionOperationError extends Error {
  readonly safeDiagnostic: SafeModelResolutionDiagnostic;
  constructor(error: unknown, inputShape: SafeModelResolutionDiagnostic["inputShape"]) {
    super("Canonical model edition lookup failed", { cause: error });
    this.name = "OicModelResolutionOperationError";
    const source = error instanceof Error ? error as Error & { code?: unknown; meta?: unknown } : null;
    const safeMeta: Record<string, string> = {};
    if (source?.meta && typeof source.meta === "object") {
      for (const key of ["constraint", "field_name", "column_name", "table_name", "relation_name", "modelName", "code"] as const) {
        const value = (source.meta as Record<string, unknown>)[key];
        if (typeof value === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(value)) safeMeta[key] = value;
      }
    }
    const type = source?.constructor?.name ?? "UnknownError";
    const code = typeof source?.code === "string" && /^P[0-9]{4}$/.test(source.code) ? source.code : null;
    this.safeDiagnostic = {
      operationId: "OIC_MODEL_EDITION_FIND_FIRST",
      prismaErrorType: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(type) ? type : "UnknownError",
      prismaErrorCode: code,
      modelName: "OicModelEdition",
      safeDatabaseMeta: safeMeta,
      inputShape
    };
  }
}

/** Production remains closed if the resolver is not wired. */
export class UnavailableOicModelResolver implements OicModelResolver {
  resolve(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<OicResolvedModel | null> {
    void model; void context;
    return Promise.resolve(null);
  }
  listVisible(context: OicRuntimeContext): Promise<OicVisibleModel[]> { void context; return Promise.resolve([]); }
}

type ResolvedOicModel = OicResolvedModel & {
  revisionId: string;
  variantId: string;
  bindingId: string;
  providerConnectionId: string;
  providerDefinitionId: string;
  providerKey: string;
  upstreamModelRef: string | null;
  transportProfile: string;
};

/** Resolves only explicitly visible production editions with an active scope-matching binding. */
@Injectable()
export class DatabaseOicModelResolver implements OicModelResolver {
  constructor(private readonly db: OicDatabaseService) {}

  async resolve(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<OicResolvedModel | null> {
    const resolved = await this.resolveRaw(model, context);
    if (!resolved) return null;
    return {
      id: resolved.id,
      displayName: resolved.displayName,
      capabilities: resolved.capabilities,
      resolverVersion: resolved.resolverVersion,
      revisionId: resolved.revisionId,
      intelligenceProfile: resolved.intelligenceProfile,
      variantId: resolved.variantId,
      bindingId: resolved.bindingId
    } as OicResolvedModel;
  }

  /** Internal evidence path; provider details are excluded from ordinary resolver responses. */
  async resolveForEvaluation(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<ResolvedOicModel | null> {
    return this.resolveRaw(model, context);
  }

  private async resolveRaw(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<ResolvedOicModel | null> {
    const lookup = {
      where: {
        publicId: model, lifecycle: "PRODUCTION", visibility: { some: { applicationId: context.applicationId } },
        bindings: { some: { status: "ACTIVE", environment: "production", connection: { status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: { not: null } }, OR: [
          ...(context.tenantId ? [{ scope: "TENANT" as const, tenantId: context.tenantId, applicationId: context.applicationId }] : []),
          { scope: "APPLICATION" as const, applicationId: context.applicationId }, { scope: "PLATFORM" as const, applicationId: null, tenantId: null }
        ] } }
      },
      include: {
        bindings: {
          where: { status: "ACTIVE", environment: "production", connection: { status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: { not: null } } },
          include: {
            connection: { include: { providerDefinition: true } },
            variant: { include: {
              providerDefinition: true,
              upstreamModel: true,
              revision: { include: { intelligenceProfileRevision: { include: { profile: true } } } }
            } }
          }
        }
      }
    } satisfies Prisma.OicModelEditionFindFirstArgs;
    let edition: Prisma.OicModelEditionGetPayload<typeof lookup> | null;
    try {
      edition = await this.db.oicModelEdition.findFirst(lookup);
    } catch (error) {
      throw new OicModelResolutionOperationError(error, {
        applicationScoped: true,
        tenantScoped: context.tenantId !== null,
        modelIdValid: /^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(model)
      });
    }
    if (!edition) return null;
    const rank = (binding: (typeof edition.bindings)[number]) => binding.scope === "TENANT" && binding.tenantId === context.tenantId ? 0 : binding.scope === "APPLICATION" && binding.applicationId === context.applicationId ? 1 : binding.scope === "PLATFORM" ? 2 : 3;
    const binding = [...edition.bindings].filter((candidate) => rank(candidate) < 3).sort((left, right) => rank(left) - rank(right) || left.id.localeCompare(right.id))[0];
    if (!binding || binding.variant.revision.editionId !== edition.id) return null;
    const profileRevision = binding.variant.revision.intelligenceProfileRevision;
    if (profileRevision && profileRevision.profile.lifecycle !== "ACTIVE") return null;
    const providerDefinition = binding.connection.providerDefinition;
    const upstreamModel = binding.variant.upstreamModel;
    if (binding.variant.providerDefinitionId !== providerDefinition.id || (upstreamModel && (upstreamModel.providerDefinitionId !== providerDefinition.id || upstreamModel.connectionId !== binding.connectionId))) return null;
    return {
      id: edition.publicId as OicResolvedModel["id"], displayName: edition.displayName,
      capabilities: ["text.generate", "text.stream"], resolverVersion: "oic-model-resolver-v1",
      revisionId: binding.variant.revisionId,
      intelligenceProfile: profileRevision ? policyFromRevision(profileRevision) : { ...FAST_POLICY, id: "builtin-fast-unassigned", profileId: "builtin-fast-unassigned", profileKey: "FAST", displayName: "Fast (default)", revision: 1 },
      variantId: binding.variantId,
      bindingId: binding.id,
      providerConnectionId: binding.connectionId,
      providerDefinitionId: providerDefinition.id,
      providerKey: providerDefinition.key,
      upstreamModelRef: upstreamModel?.upstreamModelId ?? null,
      transportProfile: binding.connection.transportProfile
    };
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
