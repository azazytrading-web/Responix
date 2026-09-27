type UnknownRecord = Record<string, unknown>;

/**
 * Serializes a knowledge document record for API responses.
 *
 * Prisma maps `KnowledgeDocument.fileSize` to a `BigInt` (see
 * `packages/database/prisma/schema.prisma`). `JSON.stringify` throws
 * `Do not know how to serialize a BigInt` when a raw record is returned,
 * which surfaced as a 500 on `GET /knowledge` endpoints. This mirrors the
 * `WorkspaceResponseDto` convention of converting `bigint -> number` at the
 * response-DTO boundary so the repository can keep returning Prisma types.
 */
export class KnowledgeDocumentResponseDto {
  static toSerializable(value: UnknownRecord | null | undefined): UnknownRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value as UnknownRecord;
    const source = value as { fileSize?: unknown };
    const fileSize = source.fileSize;
    return {
      ...value,
      fileSize:
        typeof fileSize === "bigint"
          ? Number(fileSize)
          : typeof fileSize === "number"
            ? fileSize
            : fileSize === null
              ? null
              : Number(fileSize ?? 0)
    };
  }

  static from(value: UnknownRecord | null | undefined): UnknownRecord {
    return KnowledgeDocumentResponseDto.toSerializable(value);
  }
}