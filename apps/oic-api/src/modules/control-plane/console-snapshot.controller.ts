import { Controller, ForbiddenException, Get, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OicDatabaseService } from "@oic/database";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { hasOicConsoleRead } from "../identity/foundation-policy";
import { registeredProvider } from "./provider-registry";
import { LOCAL_PROVIDER_FIXTURE_KEY, localProviderFixtureEnabled } from "./local-provider-fixture";

@ApiTags("OIC Operator Console")
@ApiBearerAuth()
@Controller("admin/console")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class ConsoleSnapshotController {
  constructor(private readonly db: OicDatabaseService) {}

  @Get("snapshot")
  @Version("1")
  async snapshot(@CurrentPrincipal() actor: AuthenticatedPrincipal) {
    if (!hasOicConsoleRead(actor.scopes)) throw new ForbiddenException();
    const [
      applications,
      tenants,
      principals,
      providers,
      connections,
      upstreamModels,
      modelFamilies,
      audit
    ] = await Promise.all([
      this.db.oicApplication.findMany({
        orderBy: { key: "asc" },
        include: { _count: { select: { tenants: true, principals: true } } }
      }),
      this.db.oicTenant.findMany({
        orderBy: [{ applicationId: "asc" }, { key: "asc" }],
        include: {
          application: { select: { id: true, key: true, displayName: true } },
          references: {
            select: { id: true, sourceType: true, externalId: true, createdAt: true, revokedAt: true }
          }
        }
      }),
      this.db.oicServicePrincipal.findMany({
        orderBy: [{ applicationId: "asc" }, { key: "asc" }],
        include: {
          application: { select: { id: true, key: true, displayName: true } },
          scopes: { where: { revokedAt: null }, select: { scope: true, grantedAt: true } },
          tenantGrants: { where: { revokedAt: null }, select: { tenantId: true, grantedAt: true } },
          credentials: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              expiresAt: true,
              revokedAt: true,
              lastUsedAt: true
            },
            orderBy: { createdAt: "desc" }
          }
        }
      }),
      this.db.oicProviderDefinition.findMany({
        orderBy: { key: "asc" },
        select: {
          id: true,
          key: true,
          displayName: true,
          authStrategy: true,
          transportProfiles: true,
          status: true
        }
      }),
      this.db.oicProviderConnection.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          providerDefinition: {
            select: { id: true, key: true, displayName: true, authStrategy: true }
          },
          credentials: {
            select: { id: true, version: true, status: true, createdAt: true, revokedAt: true },
            orderBy: { version: "desc" },
            take: 1
          },
          healthChecks: {
            select: { status: true, diagnosticCode: true, latencyMs: true, endpointHost: true, testedAt: true },
            orderBy: [{ testedAt: "desc" }, { id: "desc" }],
            take: 5
          },
          syncRuns: {
            select: { id: true, status: true, discoveredCount: true, createdCount: true, updatedCount: true, rejectedCount: true, diagnosticCode: true, startedAt: true, completedAt: true },
            orderBy: [{ startedAt: "desc" }, { id: "desc" }],
            take: 5
          },
          _count: { select: { upstreamModels: true, bindings: true } }
        }
      }),
      this.db.oicUpstreamModel.findMany({
        orderBy: [{ displayName: "asc" }, { upstreamModelId: "asc" }],
        include: {
          providerDefinition: { select: { key: true, displayName: true } },
          connection: { select: { id: true, displayName: true } },
          capabilityEvidence: { orderBy: [{ observedAt: "desc" }, { id: "desc" }] },
          pricingEvidence: { orderBy: [{ observedAt: "desc" }, { id: "desc" }], take: 1 }
        }
      }),
      this.db.oicModelFamily.findMany({
        orderBy: { familyKey: "asc" },
        include: {
          editions: {
            orderBy: { editionKey: "asc" },
            include: {
              revisions: {
                orderBy: { revision: "desc" },
                include: {
                  variants: {
                    orderBy: { variantKey: "asc" },
                    include: {
                      providerDefinition: { select: { key: true, displayName: true } },
                      upstreamModel: {
                        select: { id: true, upstreamModelId: true, displayName: true }
                      },
                      bindings: {
                        orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
                        include: {
                          application: { select: { id: true, key: true } },
                          tenant: { select: { id: true, key: true, displayName: true } },
                          connection: {
                            select: {
                              id: true,
                              displayName: true,
                              status: true,
                              healthStatus: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              visibility: {
                select: {
                  applicationId: true,
                  application: { select: { key: true, displayName: true } }
                }
              }
            }
          }
        }
      }),
      this.db.oicAuditEvent.findMany({
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 60,
        select: {
          id: true,
          occurredAt: true,
          actorPrincipalId: true,
          applicationId: true,
          tenantId: true,
          action: true,
          targetType: true,
          targetId: true,
          requestId: true,
          traceId: true
        }
      })
    ]);

    const models = upstreamModels.map((model) => {
      const latestCapabilities = new Map<string, (typeof model.capabilityEvidence)[number]>();
      for (const evidence of model.capabilityEvidence)
        if (!latestCapabilities.has(evidence.capability))
          latestCapabilities.set(evidence.capability, evidence);
      const price = model.pricingEvidence[0];
      return {
        id: model.id,
        connectionId: model.connectionId,
        connectionName: model.connection.displayName,
        providerKey: model.providerDefinition.key,
        providerName: model.providerDefinition.displayName,
        upstreamModelId: model.upstreamModelId,
        displayName: model.displayName,
        family: model.family,
        source: model.source,
        lifecycle: model.lifecycle,
        contextLimit: model.contextLimit,
        outputLimit: model.outputLimit,
        capabilities: [...latestCapabilities.values()].map(
          ({ capability, status, source, sourceRef, observedAt }) => ({
            capability,
            status,
            source,
            sourceRef,
            observedAt
          })
        ),
        pricing: price
          ? {
              status: price.status,
              inputRate: price.inputRate,
              outputRate: price.outputRate,
              cachedInputRate: price.cachedInputRate,
              currency: price.currency,
              unit: price.unit,
              sourceRef: price.sourceRef,
              effectiveAt: price.effectiveAt,
              observedAt: price.observedAt
            }
          : { status: "UNKNOWN" }
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      applications,
      tenants,
      principals,
      providers: localProviderFixtureEnabled()
        ? [...providers.filter(({ key }) => key !== LOCAL_PROVIDER_FIXTURE_KEY), { id: `development:${LOCAL_PROVIDER_FIXTURE_KEY}`, ...registeredProvider(LOCAL_PROVIDER_FIXTURE_KEY)!, status: "DEVELOPMENT" }].sort((left, right) => left.key.localeCompare(right.key))
        : providers.filter(({ key }) => key !== LOCAL_PROVIDER_FIXTURE_KEY),
      connections: connections.map(({ credentials, ...connection }) => {
        const credential = credentials[0];
        return {
          ...connection,
          credential: credential
            ? {
                id: credential.id,
                version: credential.version,
                status: credential.status,
                createdAt: credential.createdAt,
                revokedAt: credential.revokedAt
              }
            : null
        };
      }),
      upstreamModels: models,
      modelFamilies,
      audit
    };
  }
}
