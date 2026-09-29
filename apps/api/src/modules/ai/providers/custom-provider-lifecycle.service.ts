import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ProviderDestinationPolicy, ProviderDestinationRejectedError } from "../security/provider-destination-policy.service";
import { CustomProviderCredentialService } from "./custom-provider-credential.service";
import { normalizeCustomProviderName } from "./custom-provider-name";
import { CustomProviderRepository } from "./custom-provider.repository";
import type { CreateCustomProviderDto, UpdateCustomProviderDto } from "../dto/custom-provider.dto";

const PROTOCOL = "openai-chat-completions-v1";

@Injectable()
export class CustomProviderLifecycleService {
  constructor(
    private readonly repository: CustomProviderRepository,
    private readonly credentials: CustomProviderCredentialService,
    private readonly destinations: ProviderDestinationPolicy
  ) {}

  async list(workspaceId: string) {
    const providers = await this.repository.list(workspaceId);
    return Promise.all(providers.map((provider) => this.toSafeResponse(provider)));
  }

  async get(workspaceId: string, id: string) {
    return this.toSafeResponse(await this.repository.get(workspaceId, id));
  }

  async create(workspaceId: string, actorId: string, dto: CreateCustomProviderDto) {
    if (dto.protocolId !== PROTOCOL) throw new BadRequestException("Custom Provider protocol is not supported");
    if (!normalizeCustomProviderName(dto.displayName)) throw new BadRequestException("Custom Provider name must not be empty");
    if (!dto.validationModelId.trim()) throw new BadRequestException("Validation model ID must not be empty");
    const baseUrl = await this.validateUrl(dto.baseUrl);
    const provider = await this.repository.createDefinition({
      workspaceId, actorId, displayName: dto.displayName.trim(), protocolId: PROTOCOL,
      baseUrl, validationModelId: dto.validationModelId.trim(),
      supportsStreaming: dto.supportsStreaming ?? false, supportsTools: dto.supportsTools ?? false
    });
    return this.toSafeResponse(provider);
  }

  async update(workspaceId: string, actorId: string, id: string, dto: UpdateCustomProviderDto) {
    const current = await this.repository.get(workspaceId, id);
    if (current.status === "ARCHIVED") throw new NotFoundException("Custom Provider was not found");
    const data: Parameters<CustomProviderRepository["updateDefinition"]>[0]["data"] = {};
    if (dto.displayName !== undefined) {
      const displayName = dto.displayName.trim();
      if (!normalizeCustomProviderName(displayName)) throw new BadRequestException("Custom Provider name must not be empty");
      data.displayName = displayName;
      data.normalizedName = normalizeCustomProviderName(displayName);
    }
    if (dto.baseUrl !== undefined) data.baseUrl = await this.validateUrl(dto.baseUrl);
    if (dto.validationModelId !== undefined) {
      const validationModelId = dto.validationModelId.trim();
      if (!validationModelId) throw new BadRequestException("Validation model ID must not be empty");
      data.validationModelId = validationModelId;
    }
    if (dto.supportsStreaming !== undefined) data.supportsStreaming = dto.supportsStreaming;
    if (dto.supportsTools !== undefined) data.supportsTools = dto.supportsTools;
    if (!Object.keys(data).length) throw new BadRequestException("No Custom Provider fields were supplied");
    return this.toSafeResponse(await this.repository.updateDefinition({
      workspaceId, actorId, id, data
    }));
  }

  async enable(workspaceId: string, actorId: string, id: string) {
    const provider = await this.repository.get(workspaceId, id);
    if (provider.status === "ARCHIVED") throw new ConflictException("Archived Custom Providers cannot be enabled");
    if (provider.protocolId !== PROTOCOL || !provider.baseUrl || !provider.validationModelId.trim()) {
      throw new ConflictException("Custom Provider configuration is incomplete");
    }
    await this.validateUrl(provider.baseUrl);
    const metadata = await this.credentials.listMetadata(workspaceId, id);
    if (!metadata.some((credential) => credential.status === "ACTIVE")) {
      throw new ConflictException("Custom Provider requires an active credential before it can be enabled");
    }
    return this.toSafeResponse(await this.repository.transition({ workspaceId, actorId, id, action: "enable" }));
  }

  async disable(workspaceId: string, actorId: string, id: string) {
    return this.toSafeResponse(await this.repository.transition({ workspaceId, actorId, id, action: "disable" }));
  }

  async archive(workspaceId: string, actorId: string, id: string) {
    return this.toSafeResponse(await this.repository.transition({ workspaceId, actorId, id, action: "archive" }));
  }

  async restore(workspaceId: string, actorId: string, id: string) {
    const provider = await this.repository.get(workspaceId, id);
    if (provider.status !== "ARCHIVED") throw new ConflictException("Custom Provider is not archived");
    await this.validateUrl(provider.baseUrl);
    return this.toSafeResponse(await this.repository.transition({ workspaceId, actorId, id, action: "restore" }));
  }

  async listCredentials(workspaceId: string, id: string) {
    await this.repository.get(workspaceId, id);
    const credentials = await this.credentials.listMetadata(workspaceId, id);
    return credentials.map(({ id: credentialId, name, status, priority, lastUsedAt }) => ({
      id: credentialId, name, status, priority,
      ...(lastUsedAt ? { lastUsedAt: lastUsedAt.toISOString() } : {})
    }));
  }

  async replaceCredential(workspaceId: string, actorId: string, id: string, input: { name?: string; secret: string }) {
    const provider = await this.repository.get(workspaceId, id);
    if (provider.status === "ARCHIVED") throw new NotFoundException("Custom Provider was not found");
    if (!input.secret.trim()) throw new BadRequestException("Credential secret must not be empty");
    const name = input.name?.trim() || "default";
    const before = await this.credentials.listMetadata(workspaceId, id);
    const existing = before.some((credential) => credential.name === name);
    const credential = await this.credentials.create({ workspaceId, customProviderId: id, name, secret: input.secret });
    await this.repository.auditEvent(
      workspaceId, actorId,
      existing ? "ai.custom-provider.credential.replaced" : "ai.custom-provider.credential.created",
      id, { credentialId: credential.id, name }
    );
    return { id: credential.id, name: credential.name, status: credential.status };
  }

  private async validateUrl(value: string): Promise<string> {
    try { return await this.destinations.validateCustomProviderBaseUrl(value.trim()); }
    catch (error) {
      if (error instanceof ProviderDestinationRejectedError) throw new BadRequestException("Custom Provider endpoint is not a valid public HTTPS destination");
      throw error;
    }
  }

  private async toSafeResponse(provider: Awaited<ReturnType<CustomProviderRepository["get"]>>) {
    const credentials = await this.credentials.listMetadata(provider.workspaceId, provider.id);
    return {
      id: provider.id, displayName: provider.displayName, protocolId: provider.protocolId,
      baseUrl: provider.baseUrl, validationModelId: provider.validationModelId,
      supportsStreaming: provider.supportsStreaming, supportsTools: provider.supportsTools,
      status: provider.status, credentialConfigured: credentials.some((item) => item.status === "ACTIVE"),
      credentials: credentials.map(({ id, name, status, priority, lastUsedAt }) => ({
        id, name, status, priority,
        ...(lastUsedAt ? { lastUsedAt: lastUsedAt.toISOString() } : {})
      })),
      ...(provider.archivedAt ? { archivedAt: provider.archivedAt.toISOString() } : {}),
      createdAt: provider.createdAt.toISOString(), updatedAt: provider.updatedAt.toISOString()
    };
  }
}
