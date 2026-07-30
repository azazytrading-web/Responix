import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  CacheRetrievalRuntimeDto, CreateRuntimeContextSnapshotDto
} from "./dto/runtime-optimization.dto";

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
