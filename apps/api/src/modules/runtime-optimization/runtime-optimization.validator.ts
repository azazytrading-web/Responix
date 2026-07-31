import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  CacheImmutablePackageDto, CacheRetrievalRuntimeDto, CreateRuntimeContextSnapshotDto
} from "./dto/runtime-optimization.dto";
import { RuntimeOptimizationPackageType } from "@prisma/client";

@Injectable()
export class RuntimeOptimizationValidator {
  validateStaticVariables(variables: Record<string, unknown>): void {
    const names = Object.keys(variables);
    if (new Set(names).size !== names.length) {
      throw new BadRequestException("Static variable names must be unique");
    }
    for (const name of names) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,159}$/.test(name)) {
        throw new BadRequestException(`Invalid static variable name: ${name}`);
      }
      if (/^(user|message|conversation|history|execution|request|runtime|dynamic)(?:[._-]|$)/i
        .test(name)) {
        throw new BadRequestException(`Dynamic variable cannot be cached: ${name}`);
      }
      this.assertJson(variables[name], `staticVariables.${name}`, new Set());
    }
  }
  validateContext(dto: CreateRuntimeContextSnapshotDto): void {
    const references = [
      dto.agentRuntimeSnapshotId, dto.compiledPromptId, dto.providerRuntimeSnapshotId,
      dto.conversationRuntimeSnapshotId, dto.retrievalRuntimeSnapshotId,
      dto.executionPipelineSnapshotId, dto.executionProfileVersionId
    ].filter(Boolean);
    if (!references.length) throw new BadRequestException("Runtime context requires an asset");
    this.assertJson(dto.immutableMetadata ?? {}, "immutableMetadata", new Set());
  }
  validateRetrieval(dto: CacheRetrievalRuntimeDto): void {
    if (dto.languages && new Set(dto.languages).size !== dto.languages.length) {
      throw new BadRequestException("Retrieval languages must be unique");
    }
    for (const language of dto.languages ?? []) {
      if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language)) {
        throw new BadRequestException(`Invalid retrieval language: ${language}`);
      }
    }
    this.assertJson(dto.searchConfiguration ?? {}, "searchConfiguration", new Set());
  }
  validateImmutablePackage(dto: CacheImmutablePackageDto): void {
    const advanced = new Set<RuntimeOptimizationPackageType>([
      RuntimeOptimizationPackageType.CONVERSATION_PREFIX,
      RuntimeOptimizationPackageType.STUDIO_CONFIGURATION,
      RuntimeOptimizationPackageType.TOOL_DEFINITION,
      RuntimeOptimizationPackageType.WORKFLOW_PACKAGE,
      RuntimeOptimizationPackageType.EXECUTION_PLAN,
      RuntimeOptimizationPackageType.PROVIDER_PROMPT
    ]);
    if (!advanced.has(dto.type)) throw new BadRequestException("Package type requires its dedicated endpoint");
    if (!/^[A-Za-z0-9._:-]{1,300}$/.test(dto.scopeKey)) throw new BadRequestException("Cache scope key is invalid");
    this.assertJson(dto.payload, "payload", new Set());
    this.assertJson(dto.references ?? {}, "references", new Set());
    for (const [name, id] of Object.entries(dto.references ?? {})) {
      if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new BadRequestException(`Cache reference ${name} is invalid`);
      }
    }
    if (dto.type === RuntimeOptimizationPackageType.CONVERSATION_PREFIX ||
        dto.type === RuntimeOptimizationPackageType.STUDIO_CONFIGURATION ||
        dto.type === RuntimeOptimizationPackageType.TOOL_DEFINITION ||
        dto.type === RuntimeOptimizationPackageType.WORKFLOW_PACKAGE) {
      this.assertStatic(dto.payload, "payload");
    }
  }
  private assertStatic(value: unknown, path: string): void {
    if (Array.isArray(value)) return value.forEach((item, index) => this.assertStatic(item, `${path}.${index}`));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/^(userMessage|userInput|messages|conversation|history|memoryEntries|memoryReads|retrievalResults|toolOutputs|runtimeVariables|dynamicVariables)$/i.test(key)) {
        throw new BadRequestException(`Dynamic value cannot be cached at ${path}.${key}`);
      }
      this.assertStatic(item, `${path}.${key}`);
    }
  }
  private assertJson(value: unknown, path: string, seen: Set<object>): void {
    if (value === undefined || typeof value === "function" || typeof value === "symbol" ||
        typeof value === "bigint") throw new BadRequestException(`${path} must be JSON-compatible`);
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) throw new BadRequestException(`${path} contains a circular reference`);
    seen.add(value);
    if (Array.isArray(value)) value.forEach((item, index) =>
      this.assertJson(item, `${path}.${index}`, seen));
    else Object.entries(value).forEach(([key, item]) =>
      this.assertJson(item, `${path}.${key}`, seen));
    seen.delete(value);
  }
}
