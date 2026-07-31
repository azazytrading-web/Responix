import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  ToolAuthenticationType,
  ToolDefinitionType,
  ToolRegistryStatus,
  ToolVisibility
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { createHash } from "node:crypto";
import type {
  CreateToolDefinitionDto,
  CreateToolGroupDto,
  ToolCapabilityDto,
  ToolDefinitionMetadataDto,
  ToolParameterDto,
  ToolPermissionDto,
  ToolSchemaDto,
  ToolTaxonomyDto,
  UpdateToolDefinitionDto,
  UpdateToolGroupDto,
  UpdateToolTaxonomyDto
} from "./dto/tool-registry.dto";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

type ToolSnapshot = {
  categoryId: string | null;
  groupId: string | null;
  name: string;
  slug: string;
  description: string | null;
  type: ToolDefinitionType;
  visibility: ToolVisibility;
  authenticationType: ToolAuthenticationType;
  metadata: JsonRecord;
  providerMetadata: JsonRecord;
  authenticationMetadata: JsonRecord;
  rateLimitMetadata: JsonRecord;
  executionPolicyMetadata: JsonRecord;
  timeoutMetadata: JsonRecord;
  retryPolicyMetadata: JsonRecord;
  costMetadata: JsonRecord;
  compatibilityMetadata: JsonRecord;
  healthMetadata: JsonRecord;
  mcpMetadata: JsonRecord;
  parameters: ToolParameterDto[];
  schemas: ToolSchemaDto[];
  capabilities: ToolCapabilityDto[];
  permissions: ToolPermissionDto[];
};

@Injectable()
export class ToolRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  createCategory(workspaceId: string, actorId: string, dto: ToolTaxonomyDto) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const category = await tx.toolCategory.create({
          data: {
            workspaceId, name: dto.name, slug: dto.slug, description: dto.description,
            metadata: json(dto.metadata ?? {})
          },
          select: this.categorySelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.category.created", "ToolCategory", category.id, null, category);
        return category;
      })
    );
  }

  updateCategory(
    workspaceId: string,
    actorId: string,
    id: string,
    dto: UpdateToolTaxonomyDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireCategory(tx, workspaceId, id);
        const category = await tx.toolCategory.update({
          where: { id },
          data: {
            name: dto.name, slug: dto.slug, description: dto.description,
            metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
          },
          select: this.categorySelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.category.updated", "ToolCategory", id, current, category);
        return category;
      })
    );
  }

  listCategories(workspaceId: string) {
    return this.prisma.toolCategory.findMany({
      where: { workspaceId }, orderBy: { name: "asc" }, select: this.categorySelect
    });
  }

  deleteCategory(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireCategory(tx, workspaceId, id);
      const [groups, tools] = await Promise.all([
        tx.toolGroup.count({ where: { workspaceId, categoryId: id } }),
        tx.toolDefinition.count({ where: { workspaceId, categoryId: id, deletedAt: null } })
      ]);
      if (groups || tools) throw new ConflictException("Tool category is in use");
      await tx.toolCategory.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "tool.category.deleted", "ToolCategory", id, current, null);
    });
  }

  createGroup(workspaceId: string, actorId: string, dto: CreateToolGroupDto) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        if (dto.categoryId) await this.requireCategory(tx, workspaceId, dto.categoryId);
        const group = await tx.toolGroup.create({
          data: {
            workspaceId, categoryId: dto.categoryId, name: dto.name, slug: dto.slug,
            description: dto.description, metadata: json(dto.metadata ?? {})
          },
          select: this.groupSelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.group.created", "ToolGroup", group.id, null, group);
        return group;
      })
    );
  }

  updateGroup(workspaceId: string, actorId: string, id: string, dto: UpdateToolGroupDto) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireGroup(tx, workspaceId, id);
        if (dto.categoryId) await this.requireCategory(tx, workspaceId, dto.categoryId);
        const group = await tx.toolGroup.update({
          where: { id },
          data: {
            categoryId: dto.categoryId, name: dto.name, slug: dto.slug,
            description: dto.description,
            metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
          },
          select: this.groupSelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.group.updated", "ToolGroup", id, current, group);
        return group;
      })
    );
  }

  listGroups(workspaceId: string, categoryId?: string) {
    return this.prisma.toolGroup.findMany({
      where: { workspaceId, categoryId }, orderBy: { name: "asc" }, select: this.groupSelect
    });
  }

  deleteGroup(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireGroup(tx, workspaceId, id);
      const tools = await tx.toolDefinition.count({ where: { workspaceId, groupId: id, deletedAt: null } });
      if (tools) throw new ConflictException("Tool group is in use");
      await tx.toolGroup.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "tool.group.deleted", "ToolGroup", id, current, null);
    });
  }

  create(workspaceId: string, actorId: string, dto: CreateToolDefinitionDto) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        await this.validateReferences(tx, workspaceId, dto.categoryId, dto.groupId);
        await this.validateChildren(tx, dto.parameters ?? [], dto.schemas ?? [], dto.capabilities ?? [], dto.permissions ?? []);
        const tool = await tx.toolDefinition.create({
          data: {
            workspaceId, categoryId: dto.categoryId, groupId: dto.groupId,
            name: dto.name, slug: dto.slug, description: dto.description, type: dto.type,
            visibility: dto.visibility ?? "WORKSPACE",
            authenticationType: dto.authenticationType ?? "NONE",
            ...this.metadataData(dto.metadata),
            status: "DRAFT", revision: 0, createdById: actorId, updatedById: actorId,
            parameters: { create: this.parameterData(dto.parameters ?? []) },
            schemas: { create: this.schemaData(dto.schemas ?? []) },
            capabilities: { create: this.capabilityData(dto.capabilities ?? []) },
            permissions: { create: this.permissionData(dto.permissions ?? []) }
          },
          select: this.toolSelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.definition.created", "ToolDefinition", tool.id, null, tool);
        return tool;
      })
    );
  }

  updateDraft(
    workspaceId: string,
    actorId: string,
    toolId: string,
    dto: UpdateToolDefinitionDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireTool(tx, workspaceId, toolId);
        this.assertDraft(current.status);
        const categoryId = dto.categoryId ?? current.categoryId ?? undefined;
        const groupId = dto.groupId ?? current.groupId ?? undefined;
        await this.validateReferences(tx, workspaceId, categoryId, groupId);
        if (dto.parameters || dto.schemas || dto.capabilities || dto.permissions) {
          await this.validateChildren(
            tx,
            dto.parameters ?? this.parameters(current),
            dto.schemas ?? this.schemas(current),
            dto.capabilities ?? this.capabilities(current),
            dto.permissions ?? this.permissions(current)
          );
        }
        const tool = await tx.toolDefinition.update({
          where: { id: toolId },
          data: {
            categoryId: dto.categoryId, groupId: dto.groupId, name: dto.name, slug: dto.slug,
            description: dto.description, type: dto.type, visibility: dto.visibility,
            authenticationType: dto.authenticationType,
            ...(dto.metadata ? this.metadataData(dto.metadata, true) : {}),
            updatedById: actorId,
            parameters: dto.parameters === undefined ? undefined : { deleteMany: {}, create: this.parameterData(dto.parameters) },
            schemas: dto.schemas === undefined ? undefined : { deleteMany: {}, create: this.schemaData(dto.schemas) },
            capabilities: dto.capabilities === undefined ? undefined : { deleteMany: {}, create: this.capabilityData(dto.capabilities) },
            permissions: dto.permissions === undefined ? undefined : { deleteMany: {}, create: this.permissionData(dto.permissions) }
          },
          select: this.toolSelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.definition.draft_updated", "ToolDefinition", tool.id, current, tool);
        return tool;
      })
    );
  }

  publish(workspaceId: string, actorId: string, toolId: string, changeSummary?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireTool(tx, workspaceId, toolId);
      this.assertDraft(current.status);
      const snapshot = this.snapshot(current);
      this.validatePublishable(snapshot);
      const revision = current.revision + 1;
      const snapshotHash = this.hash(snapshot);
      const version = await tx.toolVersion.create({
        data: {
          toolId, revision, snapshot: json(snapshot), changeSummary,
          createdById: actorId, publishedAt: new Date(), snapshotHash,
          checksum: this.hash({ snapshotHash, workspaceId, toolId, revision }),
          compatibilityVersion: "1.0"
        },
        select: this.versionSelect
      });
      const tool = await tx.toolDefinition.update({
        where: { id: toolId },
        data: { status: "PUBLISHED", revision, updatedById: actorId },
        select: this.toolSelect
      });
      await this.audit(tx, workspaceId, actorId, "tool.definition.published", "ToolDefinition", tool.id, current, { tool, version });
      return { tool, version };
    });
  }

  rollback(
    workspaceId: string,
    actorId: string,
    toolId: string,
    sourceRevision: number,
    changeSummary?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireTool(tx, workspaceId, toolId, true);
      const source = await tx.toolVersion.findFirst({
        where: { toolId, revision: sourceRevision, tool: { workspaceId } },
        select: this.versionSelect
      });
      if (!source) throw new NotFoundException("Published tool version was not found");
      const snapshot = this.readSnapshot(source.snapshot);
      if (this.hash(snapshot) !== source.snapshotHash ||
        this.hash({ snapshotHash: source.snapshotHash, workspaceId, toolId,
          revision: source.revision }) !== source.checksum) {
        throw new ConflictException("Published tool version integrity validation failed");
      }
      await this.validateReferences(tx, workspaceId, snapshot.categoryId ?? undefined, snapshot.groupId ?? undefined);
      await this.validateChildren(tx, snapshot.parameters, snapshot.schemas, snapshot.capabilities, snapshot.permissions);
      this.validatePublishable(snapshot);
      const revision = current.revision + 1;
      const snapshotHash = this.hash(snapshot);
      const version = await tx.toolVersion.create({
        data: {
          toolId, revision, snapshot: json(snapshot),
          changeSummary: changeSummary ?? `Rollback to revision ${sourceRevision}`,
          createdById: actorId, publishedAt: new Date(), snapshotHash,
          checksum: this.hash({ snapshotHash, workspaceId, toolId, revision }),
          compatibilityVersion: source.compatibilityVersion
        },
        select: this.versionSelect
      });
      const tool = await tx.toolDefinition.update({
        where: { id: toolId },
        data: {
          ...this.snapshotData(snapshot), status: "PUBLISHED", revision,
          archivedAt: null, deletedAt: null, updatedById: actorId,
          parameters: { deleteMany: {}, create: this.parameterData(snapshot.parameters) },
          schemas: { deleteMany: {}, create: this.schemaData(snapshot.schemas) },
          capabilities: { deleteMany: {}, create: this.capabilityData(snapshot.capabilities) },
          permissions: { deleteMany: {}, create: this.permissionData(snapshot.permissions) }
        },
        select: this.toolSelect
      });
      await this.audit(tx, workspaceId, actorId, "tool.definition.rolled_back", "ToolDefinition", tool.id, current, { sourceRevision, tool, version });
      return { tool, version };
    });
  }

  clone(workspaceId: string, actorId: string, toolId: string, name: string, slug: string) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const source = await this.requireTool(tx, workspaceId, toolId, true);
        const snapshot = this.snapshot(source);
        await this.validateReferences(tx, workspaceId, snapshot.categoryId ?? undefined, snapshot.groupId ?? undefined);
        await this.validateChildren(
          tx,
          snapshot.parameters,
          snapshot.schemas,
          snapshot.capabilities,
          snapshot.permissions
        );
        const tool = await tx.toolDefinition.create({
          data: {
            workspaceId, ...this.snapshotData({ ...snapshot, name, slug }), name, slug,
            status: "DRAFT", revision: 0, createdById: actorId, updatedById: actorId,
            archivedAt: null, deletedAt: null,
            parameters: { create: this.parameterData(snapshot.parameters) },
            schemas: { create: this.schemaData(snapshot.schemas) },
            capabilities: { create: this.capabilityData(snapshot.capabilities) },
            permissions: { create: this.permissionData(snapshot.permissions) }
          },
          select: this.toolSelect
        });
        await this.audit(tx, workspaceId, actorId, "tool.definition.cloned", "ToolDefinition", tool.id, null, { sourceToolId: source.id, tool });
        return tool;
      })
    );
  }

  archive(workspaceId: string, actorId: string, toolId: string) {
    return this.stateMutation(workspaceId, actorId, toolId, "archive");
  }
  restore(workspaceId: string, actorId: string, toolId: string) {
    return this.stateMutation(workspaceId, actorId, toolId, "restore");
  }
  softDelete(workspaceId: string, actorId: string, toolId: string) {
    return this.stateMutation(workspaceId, actorId, toolId, "delete");
  }

  get(workspaceId: string, toolId: string) {
    return this.requireTool(this.prisma, workspaceId, toolId);
  }

  async history(workspaceId: string, toolId: string) {
    await this.requireTool(this.prisma, workspaceId, toolId, true);
    return this.prisma.toolVersion.findMany({
      where: { toolId, tool: { workspaceId } }, orderBy: { revision: "desc" },
      select: this.versionSelect
    });
  }

  async publishedVersion(workspaceId: string, versionId: string) {
    const version = await this.prisma.toolVersion.findFirst({ where: {
      id: versionId, tool: { workspaceId, status: "PUBLISHED", archivedAt: null, deletedAt: null }
    }, select: { ...this.versionSelect, tool: { select: { id: true, workspaceId: true } } } });
    if (!version) throw new NotFoundException("Published tool version was not found");
    const snapshot = this.readSnapshot(version.snapshot);
    if (version.compatibilityVersion !== "1.0" || this.hash(snapshot) !== version.snapshotHash ||
      this.hash({ snapshotHash: version.snapshotHash, workspaceId, toolId: version.toolId,
        revision: version.revision }) !== version.checksum) {
      throw new ConflictException("Published tool version integrity validation failed");
    }
    return { ...version, snapshot };
  }

  async list(input: {
    workspaceId: string;
    page: number;
    limit: number;
    search?: string;
    status?: ToolRegistryStatus;
    type?: ToolDefinitionType;
    visibility?: ToolVisibility;
    categoryId?: string;
    groupId?: string;
  }) {
    const where: Prisma.ToolDefinitionWhereInput = {
      workspaceId: input.workspaceId, deletedAt: null, status: input.status,
      type: input.type, visibility: input.visibility, categoryId: input.categoryId, groupId: input.groupId,
      ...(input.search ? { OR: [
        { name: { contains: input.search, mode: "insensitive" } },
        { slug: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } }
      ] } : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.toolDefinition.findMany({
        where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit, take: input.limit, select: this.toolSelect
      }),
      this.prisma.toolDefinition.count({ where })
    ]);
    return { data, pagination: {
      page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit)
    } };
  }

  private readonly categorySelect = {
    id: true, workspaceId: true, name: true, slug: true, description: true,
    metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly groupSelect = {
    id: true, workspaceId: true, categoryId: true, name: true, slug: true,
    description: true, metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly parameterSelect = {
    id: true, name: true, location: true, required: true, schema: true,
    metadata: true, sortOrder: true, createdAt: true, updatedAt: true
  } as const;
  private readonly schemaSelect = {
    id: true, kind: true, schema: true, metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly capabilitySelect = {
    id: true, code: true, enabled: true, metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly permissionSelect = {
    id: true, permissionCode: true, metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly toolSelect = {
    id: true, workspaceId: true, categoryId: true, groupId: true, name: true, slug: true,
    description: true, type: true, status: true, visibility: true, authenticationType: true,
    revision: true, metadata: true, providerMetadata: true, authenticationMetadata: true,
    rateLimitMetadata: true, executionPolicyMetadata: true, timeoutMetadata: true,
    retryPolicyMetadata: true, costMetadata: true, compatibilityMetadata: true,
    healthMetadata: true, mcpMetadata: true, createdById: true, updatedById: true,
    createdAt: true, updatedAt: true, archivedAt: true, deletedAt: true,
    parameters: { select: this.parameterSelect, orderBy: { sortOrder: "asc" as const } },
    schemas: { select: this.schemaSelect, orderBy: { kind: "asc" as const } },
    capabilities: { select: this.capabilitySelect, orderBy: { code: "asc" as const } },
    permissions: { select: this.permissionSelect, orderBy: { permissionCode: "asc" as const } }
  } as const;
  private readonly versionSelect = {
    id: true, toolId: true, revision: true, snapshot: true, snapshotHash: true,
    checksum: true, compatibilityVersion: true, changeSummary: true,
    createdById: true, createdAt: true, publishedAt: true
  } as const;

  private requireCategory(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.toolCategory.findFirst({ where: { id, workspaceId }, select: this.categorySelect }).then((item) => {
      if (!item) throw new NotFoundException("Tool category was not found");
      return item;
    });
  }
  private requireGroup(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.toolGroup.findFirst({ where: { id, workspaceId }, select: this.groupSelect }).then((item) => {
      if (!item) throw new NotFoundException("Tool group was not found");
      return item;
    });
  }
  private requireTool(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    includeDeleted = false
  ) {
    return client.toolDefinition.findFirst({
      where: { id, workspaceId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: this.toolSelect
    }).then((item) => {
      if (!item) throw new NotFoundException("Tool definition was not found");
      return item;
    });
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    categoryId?: string,
    groupId?: string
  ) {
    if (categoryId) await this.requireCategory(tx, workspaceId, categoryId);
    if (groupId) {
      const group = await this.requireGroup(tx, workspaceId, groupId);
      if (categoryId && group.categoryId !== categoryId) {
        throw new BadRequestException("Tool group is not in the selected category");
      }
    }
  }

  private async validateChildren(
    tx: Prisma.TransactionClient,
    parameters: ToolParameterDto[],
    schemas: ToolSchemaDto[],
    capabilities: ToolCapabilityDto[],
    permissions: ToolPermissionDto[]
  ) {
    this.assertUnique(parameters.map((item) => `${item.location}:${item.name}`), "Tool parameters");
    this.assertUnique(schemas.map((item) => item.kind), "Tool schemas");
    this.assertUnique(capabilities.map((item) => item.code), "Tool capabilities");
    this.assertUnique(permissions.map((item) => item.permissionCode), "Tool permissions");
    if (permissions.length) {
      const codes = permissions.map((item) => item.permissionCode);
      const count = await tx.permission.count({ where: { code: { in: codes } } });
      if (count !== codes.length) throw new BadRequestException("One or more tool permissions are not registered");
    }
  }

  private assertUnique(values: string[], label: string) {
    if (new Set(values).size !== values.length) throw new BadRequestException(`${label} must be unique`);
  }

  private validatePublishable(snapshot: ToolSnapshot) {
    if (!snapshot.schemas.some((item) => item.kind === "INPUT")) {
      throw new BadRequestException("Published tools require an input schema");
    }
    const provider = snapshot.providerMetadata;
    if (["HTTP", "REST", "WEBHOOK"].includes(snapshot.type)) {
      this.requireMetadataString(provider, "endpoint", "REST and webhook tools require a provider endpoint");
    } else if (snapshot.type === "OPENAPI") {
      if (typeof provider.specUrl !== "string" && typeof provider.documentReference !== "string") {
        throw new BadRequestException("OpenAPI tools require a spec URL or document reference");
      }
    } else if (snapshot.type === "INTERNAL_SERVICE") {
      this.requireMetadataString(provider, "service", "Internal service tools require a service identifier");
    } else if (snapshot.type === "FUNCTION") {
      this.requireMetadataString(provider, "function", "Function tools require a function identifier");
    } else if (snapshot.type === "MCP") {
      this.requireMetadataString(snapshot.mcpMetadata, "server", "MCP tools require server metadata");
    } else if (["INTERNAL", "DATABASE", "FILE", "STORAGE"].includes(snapshot.type)) {
      this.requireMetadataString(provider, "handler", "Internal tools require a registered handler identifier");
    } else if (snapshot.type === "WORKFLOW") {
      this.requireMetadataString(provider, "workflowVersionId", "Workflow tools require workflowVersionId");
    } else if (snapshot.type === "AGENT") {
      if (!provider.execution || typeof provider.execution !== "object") {
        throw new BadRequestException("Agent tools require execution metadata");
      }
    } else if (snapshot.type === "COMPOSITE") {
      if (!Array.isArray(provider.toolVersionIds) || !provider.toolVersionIds.length ||
        provider.toolVersionIds.some((id) => typeof id !== "string")) {
        throw new BadRequestException("Composite tools require toolVersionIds");
      }
    }
    this.validateAuthentication(snapshot.authenticationType, snapshot.authenticationMetadata);
  }

  private validateAuthentication(type: ToolAuthenticationType, metadata: JsonRecord) {
    if (type === "NONE") return;
    if (type === "API_KEY") {
      if (typeof metadata.headerName !== "string" && typeof metadata.parameterName !== "string") {
        throw new BadRequestException("API key authentication requires a header or parameter name");
      }
    } else if (type === "OAUTH2") {
      this.requireMetadataString(metadata, "authorizationUrl", "OAuth requires an authorization URL");
      this.requireMetadataString(metadata, "tokenUrl", "OAuth requires a token URL");
    } else if (Object.keys(metadata).length === 0) {
      throw new BadRequestException("Authentication metadata is required");
    }
  }

  private requireMetadataString(metadata: JsonRecord, key: string, message: string) {
    if (typeof metadata[key] !== "string" || metadata[key].length === 0) {
      throw new BadRequestException(message);
    }
  }

  private metadataData(metadata?: ToolDefinitionMetadataDto, partial = false) {
    const value = (item: JsonRecord | undefined) =>
      item === undefined && partial ? undefined : json(item ?? {});
    return {
      providerMetadata: value(metadata?.provider),
      authenticationMetadata: value(metadata?.authentication),
      rateLimitMetadata: value(metadata?.rateLimit),
      executionPolicyMetadata: value(metadata?.executionPolicy),
      timeoutMetadata: value(metadata?.timeout),
      retryPolicyMetadata: value(metadata?.retryPolicy),
      costMetadata: value(metadata?.cost),
      compatibilityMetadata: value(metadata?.compatibility),
      healthMetadata: value(metadata?.health),
      mcpMetadata: value(metadata?.mcp),
      metadata: value(metadata?.custom)
    };
  }

  private parameterData(items: ToolParameterDto[]) {
    return items.map((item) => ({
      name: item.name, location: item.location, required: item.required ?? false,
      schema: json(item.schema), metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }
  private schemaData(items: ToolSchemaDto[]) {
    return items.map((item) => ({ kind: item.kind, schema: json(item.schema), metadata: json(item.metadata ?? {}) }));
  }
  private capabilityData(items: ToolCapabilityDto[]) {
    return items.map((item) => ({ code: item.code, enabled: item.enabled ?? true, metadata: json(item.metadata ?? {}) }));
  }
  private permissionData(items: ToolPermissionDto[]) {
    return items.map((item) => ({ permissionCode: item.permissionCode, metadata: json(item.metadata ?? {}) }));
  }

  private parameters(tool: Awaited<ReturnType<ToolRegistryRepository["requireTool"]>>): ToolParameterDto[] {
    return tool.parameters.map((item) => ({
      name: item.name, location: item.location, required: item.required, schema: record(item.schema),
      metadata: record(item.metadata), sortOrder: item.sortOrder
    }));
  }
  private schemas(tool: Awaited<ReturnType<ToolRegistryRepository["requireTool"]>>): ToolSchemaDto[] {
    return tool.schemas.map((item) => ({ kind: item.kind, schema: record(item.schema), metadata: record(item.metadata) }));
  }
  private capabilities(tool: Awaited<ReturnType<ToolRegistryRepository["requireTool"]>>): ToolCapabilityDto[] {
    return tool.capabilities.map((item) => ({ code: item.code, enabled: item.enabled, metadata: record(item.metadata) }));
  }
  private permissions(tool: Awaited<ReturnType<ToolRegistryRepository["requireTool"]>>): ToolPermissionDto[] {
    return tool.permissions.map((item) => ({ permissionCode: item.permissionCode, metadata: record(item.metadata) }));
  }

  private snapshot(tool: Awaited<ReturnType<ToolRegistryRepository["requireTool"]>>): ToolSnapshot {
    return {
      categoryId: tool.categoryId, groupId: tool.groupId, name: tool.name, slug: tool.slug,
      description: tool.description, type: tool.type, visibility: tool.visibility,
      authenticationType: tool.authenticationType, metadata: record(tool.metadata),
      providerMetadata: record(tool.providerMetadata),
      authenticationMetadata: record(tool.authenticationMetadata),
      rateLimitMetadata: record(tool.rateLimitMetadata),
      executionPolicyMetadata: record(tool.executionPolicyMetadata),
      timeoutMetadata: record(tool.timeoutMetadata),
      retryPolicyMetadata: record(tool.retryPolicyMetadata),
      costMetadata: record(tool.costMetadata),
      compatibilityMetadata: record(tool.compatibilityMetadata),
      healthMetadata: record(tool.healthMetadata), mcpMetadata: record(tool.mcpMetadata),
      parameters: this.parameters(tool), schemas: this.schemas(tool),
      capabilities: this.capabilities(tool), permissions: this.permissions(tool)
    };
  }

  private snapshotData(snapshot: ToolSnapshot) {
    return {
      categoryId: snapshot.categoryId, groupId: snapshot.groupId, name: snapshot.name,
      slug: snapshot.slug, description: snapshot.description, type: snapshot.type,
      visibility: snapshot.visibility, authenticationType: snapshot.authenticationType,
      metadata: json(snapshot.metadata), providerMetadata: json(snapshot.providerMetadata),
      authenticationMetadata: json(snapshot.authenticationMetadata),
      rateLimitMetadata: json(snapshot.rateLimitMetadata),
      executionPolicyMetadata: json(snapshot.executionPolicyMetadata),
      timeoutMetadata: json(snapshot.timeoutMetadata),
      retryPolicyMetadata: json(snapshot.retryPolicyMetadata),
      costMetadata: json(snapshot.costMetadata),
      compatibilityMetadata: json(snapshot.compatibilityMetadata),
      healthMetadata: json(snapshot.healthMetadata), mcpMetadata: json(snapshot.mcpMetadata)
    };
  }

  private readSnapshot(value: Prisma.JsonValue): ToolSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("Published tool version has an invalid snapshot");
    }
    const snapshot = value as Record<string, unknown>;
    if (
      typeof snapshot.name !== "string" || typeof snapshot.slug !== "string" ||
      typeof snapshot.type !== "string" || !Array.isArray(snapshot.parameters) ||
      !Array.isArray(snapshot.schemas) || !Array.isArray(snapshot.capabilities) ||
      !Array.isArray(snapshot.permissions)
    ) throw new ConflictException("Published tool version has an invalid snapshot");
    return snapshot as ToolSnapshot;
  }

  private stateMutation(
    workspaceId: string,
    actorId: string,
    toolId: string,
    operation: "archive" | "restore" | "delete"
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireTool(tx, workspaceId, toolId, operation === "restore");
      if (operation === "restore" && current.status !== "ARCHIVED" && !current.deletedAt) {
        throw new ConflictException("Only archived or deleted tools can be restored");
      }
      const now = new Date();
      const data = operation === "restore"
        ? {
            status: current.revision > 0 ? ("PUBLISHED" as const) : ("DRAFT" as const),
            archivedAt: null, deletedAt: null, updatedById: actorId
          }
        : {
            status: "ARCHIVED" as const, archivedAt: now,
            deletedAt: operation === "delete" ? now : undefined, updatedById: actorId
          };
      const tool = await tx.toolDefinition.update({
        where: { id: toolId }, data, select: this.toolSelect
      });
      await this.audit(
        tx, workspaceId, actorId,
        `tool.definition.${operation === "delete" ? "deleted" : `${operation}d`}`,
        "ToolDefinition", tool.id, current, tool
      );
      return tool;
    });
  }

  private assertDraft(status: ToolRegistryStatus) {
    if (status !== "DRAFT") throw new BadRequestException("Only draft tools can be modified");
  }

  private async audit(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action, entityType, entityId,
      oldValues: before === null ? Prisma.JsonNull : json(before),
      newValues: after === null ? Prisma.JsonNull : json(after)
    } });
  }

  private async withUniqueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A tool registry resource with this slug already exists");
      }
      throw error;
    }
  }

  private hash(value: unknown) {
    return createHash("sha256").update(this.stable(value)).digest("hex");
  }
  private stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stable(item)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stable(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
  }
}
