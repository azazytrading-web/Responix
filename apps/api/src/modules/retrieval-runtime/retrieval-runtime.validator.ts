import { Injectable } from "@nestjs/common";
import type { PrepareRetrievalRuntimeDto } from "./dto/retrieval-runtime.dto";
import {
  RetrievalFilterOperator,
  RetrievalVariableType
} from "./dto/retrieval-runtime.dto";

export interface RetrievalDiagnostic {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  path: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievalValidationResult {
  valid: boolean;
  diagnostics: RetrievalDiagnostic[];
  checkedAt: string;
}

@Injectable()
export class RetrievalRuntimeValidator {
  validate(dto: PrepareRetrievalRuntimeDto, sourceDiagnostics: RetrievalDiagnostic[] = []): RetrievalValidationResult {
    const diagnostics = [...sourceDiagnostics];
    this.duplicates(diagnostics, dto.collections?.map(({ collectionId }) => collectionId) ?? [],
      "DUPLICATE_COLLECTION", "collections");
    this.duplicates(diagnostics, dto.sources?.map(({ documentId }) => documentId) ?? [],
      "DUPLICATE_SOURCE", "sources.documentId");
    this.duplicates(diagnostics, dto.sources?.map(({ versionId }) => versionId) ?? [],
      "DUPLICATE_SOURCE_VERSION", "sources.versionId");
    this.duplicates(diagnostics, dto.variables?.map(({ name }) => name) ?? [],
      "DUPLICATE_VARIABLE", "variables");
    this.duplicates(diagnostics, dto.filters?.map(({ key, operator }) => `${key}:${operator}`) ?? [],
      "DUPLICATE_FILTER", "filters");
    this.duplicates(diagnostics, dto.folderIds ?? [], "DUPLICATE_FOLDER", "folderIds");
    this.duplicates(diagnostics, dto.categoryIds ?? [], "DUPLICATE_CATEGORY", "categoryIds");
    this.duplicates(diagnostics, dto.tagIds ?? [], "DUPLICATE_TAG", "tagIds");

    if (dto.language && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(dto.language)) {
      diagnostics.push(this.error("INVALID_LANGUAGE", "language", "Language must be a valid BCP-47 style tag"));
    }
    for (const [index, mime] of (dto.allowedMimeTypes ?? []).entries()) {
      if (!/^[a-z0-9!#$&^_.+-]+\/(?:[a-z0-9!#$&^_.+-]+|\*)$/i.test(mime)) {
        diagnostics.push(this.error("INVALID_MIME_TYPE", `allowedMimeTypes.${index}`, "Invalid MIME type"));
      }
    }
    this.duplicates(diagnostics, dto.allowedMimeTypes?.map((value) => value.toLowerCase()) ?? [],
      "DUPLICATE_MIME_TYPE", "allowedMimeTypes");
    dto.filters?.forEach((filter, index) => this.filter(diagnostics, filter, index));
    dto.variables?.forEach((variable, index) =>
      this.variable(diagnostics, variable.type, variable.value, index));

    if (!(dto.sources?.length || dto.collections?.length)) {
      diagnostics.push(this.error("MISSING_RETRIEVAL_SCOPE", "sources",
        "At least one published source or collection is required"));
    }
    return {
      valid: !diagnostics.some(({ severity }) => severity === "ERROR"),
      diagnostics,
      checkedAt: new Date().toISOString()
    };
  }

  private filter(
    diagnostics: RetrievalDiagnostic[],
    filter: { key: string; operator: RetrievalFilterOperator; value: unknown },
    index: number
  ) {
    const allowed = /^(document\.(language|mimeType|sourceType|categoryId|folderId|collectionId|tagId)|metadata\.[A-Za-z0-9_.-]+)$/;
    if (!allowed.test(filter.key)) {
      diagnostics.push(this.error("INVALID_FILTER_KEY", `filters.${index}.key`, "Unsupported metadata filter key"));
    }
    if ([RetrievalFilterOperator.IN, RetrievalFilterOperator.NOT_IN].includes(filter.operator) &&
      (!Array.isArray(filter.value) || filter.value.length === 0)) {
      diagnostics.push(this.error("INVALID_FILTER_VALUE", `filters.${index}.value`,
        "IN and NOT_IN filters require a non-empty array"));
    }
    if (filter.operator === RetrievalFilterOperator.EXISTS &&
      filter.value !== null && typeof filter.value !== "boolean") {
      diagnostics.push(this.error("INVALID_FILTER_VALUE", `filters.${index}.value`,
        "EXISTS filters require a boolean or null value"));
    }
    if (filter.operator !== RetrievalFilterOperator.EXISTS && filter.value === undefined) {
      diagnostics.push(this.error("MISSING_FILTER_VALUE", `filters.${index}.value`, "Filter value is required"));
    }
  }

  private variable(
    diagnostics: RetrievalDiagnostic[],
    type: RetrievalVariableType,
    value: unknown,
    index: number
  ) {
    const valid = type === RetrievalVariableType.NULL ? value === null
      : type === RetrievalVariableType.STRING ? typeof value === "string"
        : type === RetrievalVariableType.NUMBER ? typeof value === "number" && Number.isFinite(value)
          : type === RetrievalVariableType.BOOLEAN ? typeof value === "boolean"
            : type === RetrievalVariableType.ARRAY ? Array.isArray(value)
              : type === RetrievalVariableType.OBJECT
                ? value !== null && typeof value === "object" && !Array.isArray(value)
                : this.jsonCompatible(value);
    if (!valid) {
      diagnostics.push(this.error("VARIABLE_TYPE_MISMATCH", `variables.${index}.value`,
        `Value is incompatible with ${type}`));
    }
  }

  private jsonCompatible(value: unknown): boolean {
    if (value === null || ["string", "boolean"].includes(typeof value)) return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item) => this.jsonCompatible(item));
    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).every((item) => this.jsonCompatible(item));
    }
    return false;
  }

  private duplicates(
    diagnostics: RetrievalDiagnostic[],
    values: string[],
    code: string,
    path: string
  ) {
    if (new Set(values).size !== values.length) {
      diagnostics.push(this.error(code, path, "Values must be unique"));
    }
  }

  private error(code: string, path: string, message: string): RetrievalDiagnostic {
    return { severity: "ERROR", code, path, message };
  }
}
