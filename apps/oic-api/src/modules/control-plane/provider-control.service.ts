import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { OicDatabaseService, Prisma } from "@oic/database";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { hasOicConsoleManage, hasOicConsoleRead } from "../identity/foundation-policy";
import { decryptProviderCredential, encryptProviderCredential } from "./provider-credential.crypto";
import { resolvePublicHttpsEndpoint } from "./provider-endpoint";
import type { ResolvedProviderEndpoint } from "./provider-endpoint";
import { registeredProvider } from "./provider-registry";
import { isLocalFixtureConnection, LOCAL_PROVIDER_FIXTURE_CATALOG, LOCAL_PROVIDER_FIXTURE_ENDPOINT, LOCAL_PROVIDER_FIXTURE_KEY, localProviderFixtureEnabled } from "./local-provider-fixture";

export type ProviderConnectionInput = {
  providerKey: string;
  scope: "PLATFORM" | "APPLICATION" | "TENANT";
  applicationId?: string;
  tenantId?: string;
  displayName: string;
  endpointUrl?: string;
  transportProfile: string;
};
type ProviderProbeResult = { statusCode: number; body: Buffer; contentType: string };
type ProviderControlTestNetwork = {
  resolveEndpoint(input: string): Promise<ResolvedProviderEndpoint>;
  request(url: URL, headers: Record<string, string>, timeoutMs: number): Promise<ProviderProbeResult>;
  timeoutMs?: number;
};

@Injectable()
export class ProviderControlService {
  private testNetwork?: ProviderControlTestNetwork;
  constructor(private readonly db: OicDatabaseService) {}

  static forTest(db: OicDatabaseService, network: ProviderControlTestNetwork): ProviderControlService {
    if (!process.env.NODE_TEST_CONTEXT) throw new Error("Test-only provider control network injection is unavailable outside Node test execution");
    const service = new ProviderControlService(db);
    service.testNetwork = network;
    return service;
  }

  private requireScope(actor: AuthenticatedPrincipal, scope: string): void {
    if (!actor.scopes.includes("oic:foundation:admin") && !actor.scopes.includes(scope)) throw new ForbiddenException();
  }

  private canManageScope(actor: AuthenticatedPrincipal, scope: ProviderConnectionInput["scope"], applicationId?: string, tenantId?: string): void {
    if (hasOicConsoleManage(actor.scopes)) return;
    if (scope === "PLATFORM" || applicationId !== actor.applicationId) throw new ForbiddenException();
    if (scope === "TENANT" && (!tenantId || !actor.tenantIds.includes(tenantId))) throw new ForbiddenException();
  }

  private canReadConnection(actor: AuthenticatedPrincipal, connection: { scope: string; applicationId: string | null; tenantId: string | null }): boolean {
    if (hasOicConsoleRead(actor.scopes)) return true;
    if (connection.scope === "PLATFORM") return false;
    if (connection.applicationId !== actor.applicationId) return false;
    return connection.scope !== "TENANT" || (!!connection.tenantId && actor.tenantIds.includes(connection.tenantId));
  }

  async listDefinitions(actor: AuthenticatedPrincipal) {
    this.requireScope(actor, "oic:providers:read");
    const definitions = await this.db.oicProviderDefinition.findMany({
      where: { status: "ACTIVE" }, orderBy: { key: "asc" },
      select: { id: true, key: true, displayName: true, authStrategy: true, transportProfiles: true, defaultEndpoint: true, status: true }
    });
    if (!localProviderFixtureEnabled()) return definitions.filter(({ key }) => key !== LOCAL_PROVIDER_FIXTURE_KEY);
    const registration = registeredProvider(LOCAL_PROVIDER_FIXTURE_KEY)!;
    return [...definitions.filter(({ key }) => key !== LOCAL_PROVIDER_FIXTURE_KEY), {
      id: `development:${LOCAL_PROVIDER_FIXTURE_KEY}`, ...registration, status: "DEVELOPMENT"
    }].sort((left, right) => left.key.localeCompare(right.key));
  }

  async listConnections(actor: AuthenticatedPrincipal) {
    this.requireScope(actor, "oic:providers:read");
    return this.db.oicProviderConnection.findMany({
      where: hasOicConsoleRead(actor.scopes) ? {} : { applicationId: actor.applicationId, OR: [{ scope: "APPLICATION" }, { scope: "TENANT", tenantId: { in: actor.tenantIds } }] },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, providerDefinitionId: true, scope: true, applicationId: true, tenantId: true, displayName: true, endpointUrl: true, transportProfile: true, status: true, healthStatus: true, lastValidatedAt: true, createdAt: true, credentials: { select: { id: true, version: true, status: true, createdAt: true, revokedAt: true }, orderBy: { version: "desc" }, take: 1 } }
    });
  }

  async getConnection(actor: AuthenticatedPrincipal, id: string) {
    this.requireScope(actor, "oic:providers:read");
    const connection = await this.db.oicProviderConnection.findUnique({
      where: { id },
      select: { id: true, providerDefinitionId: true, scope: true, applicationId: true, tenantId: true, displayName: true, endpointUrl: true, transportProfile: true, status: true, healthStatus: true, lastValidatedAt: true, createdAt: true, updatedAt: true, credentials: { select: { id: true, version: true, status: true, createdAt: true, revokedAt: true }, orderBy: { version: "desc" } } }
    });
    if (!connection || !this.canReadConnection(actor, connection)) throw new NotFoundException();
    return connection;
  }

  async requireConnectionAccess(actor: AuthenticatedPrincipal, id: string, requiredScope: "oic:catalog:read" | "oic:catalog:manage" | "oic:models:manage") {
    this.requireScope(actor, requiredScope);
    const connection = await this.db.oicProviderConnection.findUnique({ where: { id }, include: { providerDefinition: { select: { key: true } } } });
    if (!connection || !this.canReadConnection(actor, connection)) throw new NotFoundException();
    return connection;
  }

  async localFixtureCatalog(actor: AuthenticatedPrincipal, id: string) {
    const connection = await this.requireConnectionAccess(actor, id, "oic:catalog:manage");
    if (!localProviderFixtureEnabled() || !isLocalFixtureConnection(connection)) throw new NotFoundException();
    return LOCAL_PROVIDER_FIXTURE_CATALOG;
  }

  async createConnection(actor: AuthenticatedPrincipal, input: ProviderConnectionInput, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:connections:manage");
    this.canManageScope(actor, input.scope, input.applicationId, input.tenantId);
    if ((input.scope === "PLATFORM" && (input.applicationId || input.tenantId)) ||
      (input.scope === "APPLICATION" && (!input.applicationId || input.tenantId)) ||
      (input.scope === "TENANT" && (!input.applicationId || !input.tenantId))) throw new ConflictException("Provider connection scope and owner do not match");
    const registration = registeredProvider(input.providerKey);
    if (!registration) throw new NotFoundException();
    const isFixture = input.providerKey === LOCAL_PROVIDER_FIXTURE_KEY;
    let definition = await this.db.oicProviderDefinition.findFirst({ where: { key: input.providerKey, status: "ACTIVE" } });
    if (isFixture && localProviderFixtureEnabled()) {
      definition = await this.db.oicProviderDefinition.upsert({
        where: { key: LOCAL_PROVIDER_FIXTURE_KEY },
        create: { key: LOCAL_PROVIDER_FIXTURE_KEY, displayName: registration.displayName, authStrategy: "BEARER", transportProfiles: ["openai-chat-completions-v1"], defaultEndpoint: LOCAL_PROVIDER_FIXTURE_ENDPOINT },
        update: { displayName: registration.displayName, authStrategy: "BEARER", transportProfiles: ["openai-chat-completions-v1"], defaultEndpoint: LOCAL_PROVIDER_FIXTURE_ENDPOINT, status: "ACTIVE" }
      });
    }
    if (!definition || !registration.transportProfiles.includes(input.transportProfile) || !definition.transportProfiles.includes(input.transportProfile)) throw new ConflictException("Provider transport is not registered");
    if (input.scope !== "PLATFORM") {
      const app = await this.db.oicApplication.findFirst({ where: { id: input.applicationId, status: "ACTIVE" }, select: { id: true } });
      if (!app) throw new NotFoundException();
    }
    if (input.scope === "TENANT") {
      const tenant = await this.db.oicTenant.findFirst({ where: { id: input.tenantId, applicationId: input.applicationId, status: "ACTIVE" }, select: { id: true } });
      if (!tenant) throw new NotFoundException();
    }
    const endpointUrl = input.endpointUrl ?? registration.defaultEndpoint ?? "";
    if (isFixture && endpointUrl !== LOCAL_PROVIDER_FIXTURE_ENDPOINT) throw new ConflictException("Local fixture endpoint identity is invalid");
    const endpoint = isFixture ? { url: new URL(LOCAL_PROVIDER_FIXTURE_ENDPOINT), hostname: "local-fixture.oic.invalid", addresses: [] } : await resolvePublicHttpsEndpoint(endpointUrl).catch(() => { throw new ConflictException("Provider endpoint is not allowed"); });
    const id = randomUUID();
    const result = await this.db.$transaction(async (tx) => {
      const connection = await tx.oicProviderConnection.create({ data: {
        id, providerDefinitionId: definition.id, scope: input.scope, applicationId: input.applicationId ?? null, tenantId: input.tenantId ?? null,
        displayName: input.displayName, endpointUrl: endpoint.url.toString(), transportProfile: input.transportProfile
      }, select: { id: true, providerDefinitionId: true, scope: true, applicationId: true, tenantId: true, displayName: true, endpointUrl: true, transportProfile: true, status: true, healthStatus: true, createdAt: true } });
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: input.applicationId ?? null, tenantId: input.tenantId ?? null,
        action: "provider.connection.created", targetType: "provider-connection", targetId: connection.id,
        requestId, traceId, metadata: { providerKey: definition.key, scope: input.scope, transportProfile: input.transportProfile } satisfies Prisma.InputJsonObject
      } });
      return connection;
    });
    return result;
  }

  async setCredential(actor: AuthenticatedPrincipal, id: string, secret: string, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:connections:manage");
    const connection = await this.db.oicProviderConnection.findUnique({ where: { id }, include: { providerDefinition: { select: { authStrategy: true } } } });
    if (!connection || !this.canReadConnection(actor, connection)) throw new NotFoundException();
    if (connection.providerDefinition.authStrategy === "NONE") throw new ConflictException("This provider does not accept credentials");
    const active = await this.db.oicProviderCredential.aggregate({ where: { connectionId: id }, _max: { version: true } });
    const version = (active._max.version ?? 0) + 1;
    let encrypted;
    try { encrypted = encryptProviderCredential(secret, id, version); }
    catch (error) {
      if (error instanceof Error && error.message === "Provider credential encryption is not configured") throw new ServiceUnavailableException("Provider credential storage is not configured");
      throw new ConflictException("Provider credential is invalid");
    }
    return this.db.$transaction(async (tx) => {
      await tx.oicProviderCredential.updateMany({ where: { connectionId: id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
      const credential = await tx.oicProviderCredential.create({ data: { connectionId: id, version, ...encrypted }, select: { id: true, connectionId: true, version: true, status: true, createdAt: true } });
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: connection.applicationId, tenantId: connection.tenantId,
        action: "provider.credential.rotated", targetType: "provider-credential", targetId: credential.id,
        requestId, traceId, metadata: { connectionId: id, version } satisfies Prisma.InputJsonObject
      } });
      return credential;
    });
  }

  async revokeCredential(actor: AuthenticatedPrincipal, id: string, credentialId: string, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:connections:manage");
    const connection = await this.db.oicProviderConnection.findUnique({ where: { id } });
    if (!connection || !this.canReadConnection(actor, connection)) throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      const result = await tx.oicProviderCredential.updateMany({ where: { id: credentialId, connectionId: id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
      if (result.count === 0) throw new NotFoundException();
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: connection.applicationId, tenantId: connection.tenantId,
        action: "provider.credential.revoked", targetType: "provider-credential", targetId: credentialId,
        requestId, traceId, metadata: { connectionId: id } satisfies Prisma.InputJsonObject
      } });
      return { revoked: true };
    });
  }

  async decryptActiveCredential(connectionId: string): Promise<string | null> {
    const credential = await this.db.oicProviderCredential.findFirst({ where: { connectionId, status: "ACTIVE" }, orderBy: { version: "desc" } });
    if (!credential) return null;
    return decryptProviderCredential(credential, connectionId, credential.version);
  }

  async testConnection(actor: AuthenticatedPrincipal, id: string, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:connections:manage");
    const connection = await this.db.oicProviderConnection.findUnique({ where: { id }, include: { providerDefinition: true } });
    if (!connection || !this.canReadConnection(actor, connection)) throw new NotFoundException();
    if (connection.status === "ARCHIVED") throw new ConflictException("Archived provider connections cannot be tested");
    if (connection.providerDefinition.key === LOCAL_PROVIDER_FIXTURE_KEY && (!localProviderFixtureEnabled() || !isLocalFixtureConnection(connection))) throw new ConflictException("Local provider fixture is unavailable or has an invalid endpoint identity");
    if (connection.transportProfile !== "openai-chat-completions-v1" || connection.providerDefinition.authStrategy === "API_KEY_HEADER") throw new ConflictException("No connection test is registered for this provider transport");
    const fixture = localProviderFixtureEnabled() && isLocalFixtureConnection(connection);
    const endpoint = fixture
      ? { url: new URL(LOCAL_PROVIDER_FIXTURE_ENDPOINT), hostname: "local-fixture.oic.invalid", addresses: [] }
      : await (this.testNetwork ? this.testNetwork.resolveEndpoint(connection.endpointUrl ?? "") : resolvePublicHttpsEndpoint(connection.endpointUrl ?? "")).catch(() => { throw new ConflictException("Provider endpoint is not allowed"); });
    const credentialRecord = await this.db.oicProviderCredential.findFirst({ where: { connectionId: id, status: "ACTIVE" }, orderBy: { version: "desc" } });
    let token: string | null = null;
    if (connection.providerDefinition.authStrategy === "BEARER") {
      if (!credentialRecord) throw new ConflictException("Active provider credential is required for connection testing");
      try { token = decryptProviderCredential(credentialRecord, id, credentialRecord.version); }
      catch { throw new ConflictException("Provider credential could not be opened"); }
    }
    const testedAt = new Date();
    const started = Date.now();
    let statusCode: number | null = null;
    let diagnosticCode = "PROVIDER_UNAVAILABLE";
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const path = new URL("models", endpoint.url.toString().replace(/\/?$/, "/"));
      const result = fixture
        ? { statusCode: 200, contentType: "application/json", body: Buffer.from(JSON.stringify({ data: LOCAL_PROVIDER_FIXTURE_CATALOG.map(({ upstreamModelId }) => ({ id: upstreamModelId })) })) }
        : this.testNetwork
        ? await this.testNetwork.request(path, headers, this.testNetwork.timeoutMs ?? 5_000)
        : await this.requestModels(endpoint, path, headers);
      statusCode = result.statusCode;
      const isOpenAiModelList = result.contentType.toLowerCase().includes("application/json") && this.isModelListResponse(result.body);
      diagnosticCode = statusCode >= 200 && statusCode < 300
        ? isOpenAiModelList ? "CONNECTION_OK" : "PROVIDER_RESPONSE_INVALID"
        : statusCode === 401 ? "PROVIDER_AUTHENTICATION_FAILED"
          : statusCode === 403 ? "PROVIDER_AUTHORIZATION_FAILED"
            : statusCode === 408 ? "PROVIDER_TIMEOUT"
              : statusCode === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_REJECTED";
    } catch (error) {
      diagnosticCode = error instanceof Error && /timeout/i.test(error.message) ? "PROVIDER_TIMEOUT"
        : error instanceof Error && /response bound exceeded/i.test(error.message) ? "PROVIDER_RESPONSE_INVALID"
          : "PROVIDER_UNAVAILABLE";
    }
    const healthy = diagnosticCode === "CONNECTION_OK";
    const latencyMs = Math.min(Date.now() - started, 2_147_483_647);
    await this.db.$transaction(async (tx) => {
      await tx.oicProviderHealthCheck.create({ data: { connectionId: id, status: healthy ? "HEALTHY" : "UNHEALTHY", diagnosticCode, latencyMs, endpointHost: endpoint.hostname, testedAt } });
      await tx.oicProviderConnection.update({ where: { id }, data: { healthStatus: healthy ? "HEALTHY" : "UNHEALTHY", lastValidatedAt: healthy ? testedAt : null } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: connection.applicationId, tenantId: connection.tenantId, action: "provider.connection.tested", targetType: "provider-connection", targetId: id, requestId, traceId, metadata: { diagnosticCode, statusCode: statusCode ?? undefined, latencyMs } satisfies Prisma.InputJsonObject } });
    });
    return { healthy, diagnosticCode, latencyMs, testedAt: testedAt.toISOString() };
  }

  private isModelListResponse(body: Buffer): boolean {
    try {
      const value = JSON.parse(body.toString("utf8")) as { data?: unknown };
      return !!value && typeof value === "object" && Array.isArray(value.data) && value.data.every((item) => !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string");
    } catch { return false; }
  }

  private requestModels(endpoint: ResolvedProviderEndpoint, url: URL, headers: Record<string, string>): Promise<ProviderProbeResult> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const request = httpsRequest(url, {
        method: "GET", headers, timeout: 5_000, servername: endpoint.hostname,
        lookup: (_hostname: string, _options: unknown, callback: (error: Error | null, address: string, family: number) => void) => callback(null, endpoint.addresses[0]!.address, endpoint.addresses[0]!.family)
      }, (response: IncomingMessage) => {
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 64 * 1024) { response.destroy(new Error("provider test response bound exceeded")); return; }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks), contentType: response.headers["content-type"] ?? "" }));
      });
      request.on("timeout", () => request.destroy(new Error("provider test timeout")));
      request.on("error", reject);
      request.end();
    });
  }

  async changeConnectionStatus(actor: AuthenticatedPrincipal, id: string, status: "ACTIVE" | "SUSPENDED" | "ARCHIVED", requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:connections:manage");
    const connection = await this.db.oicProviderConnection.findUnique({ where: { id }, include: { providerDefinition: { select: { key: true } } } });
    if (!connection || !this.canReadConnection(actor, connection)) throw new NotFoundException();
    if (connection.providerDefinition.key === LOCAL_PROVIDER_FIXTURE_KEY && (!localProviderFixtureEnabled() || !isLocalFixtureConnection(connection))) throw new ConflictException("Local provider fixture is unavailable or has an invalid endpoint identity");
    if (connection.status === "ARCHIVED" && status !== "ARCHIVED") throw new ConflictException("Archived provider connections cannot be reactivated");
    if (status === "ACTIVE") {
      if (connection.healthStatus !== "HEALTHY" || !connection.lastValidatedAt) throw new ConflictException("Provider connection must pass a connection test before activation");
      if (connection.providerDefinitionId && await this.db.oicProviderDefinition.findFirst({ where: { id: connection.providerDefinitionId, authStrategy: { not: "NONE" } } }) && await this.db.oicProviderCredential.count({ where: { connectionId: id, status: "ACTIVE" } }) === 0) throw new ConflictException("Active provider credential is required");
    }
    return this.db.$transaction(async (tx) => {
      const updated = await tx.oicProviderConnection.update({ where: { id }, data: { status } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: connection.applicationId, tenantId: connection.tenantId, action: "provider.connection.status.changed", targetType: "provider-connection", targetId: id, requestId, traceId, metadata: { from: connection.status, to: status } } });
      return { id: updated.id, status: updated.status, healthStatus: updated.healthStatus, lastValidatedAt: updated.lastValidatedAt };
    });
  }
}
