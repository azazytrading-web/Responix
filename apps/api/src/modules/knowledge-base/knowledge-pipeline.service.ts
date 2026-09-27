import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import {
  CreateKnowledgeTextDocumentDto,
  UploadKnowledgeDocumentDto
} from "./dto/knowledge-base.dto";
import { KnowledgeEmbeddingService } from "./knowledge-embedding.service";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";
import { TextChunkerService } from "./text-chunker.service";
import { TextExtractorService } from "./text-extractor.service";

export interface IngestedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

interface IngestionInput {
  spaceId: string;
  collectionId?: string;
  folderId?: string;
  categoryId?: string;
  name: string;
  slug: string;
  description?: string;
  language?: string;
  sourceType: "FILE" | "TEXT";
  fileName: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  metadata?: Record<string, unknown>;
}

/**
 * Orchestrates the V1 knowledge pipeline:
 * upload (draft) -> extract -> chunk -> embed (best-effort) -> index (READY | FAILED).
 */
@Injectable()
export class KnowledgePipelineService {
  private readonly logger = new Logger(KnowledgePipelineService.name);

  constructor(
    private readonly repository: KnowledgeBaseRepository,
    private readonly extractor: TextExtractorService,
    private readonly chunker: TextChunkerService,
    private readonly embeddingService: KnowledgeEmbeddingService
  ) {}

  ingestFile(
    workspaceId: string,
    actorId: string,
    file: IngestedFile,
    fields: UploadKnowledgeDocumentDto
  ) {
    const baseName = file.originalName.replace(/\.[^.]+$/, "");
    return this.ingest(workspaceId, actorId, {
      spaceId: fields.spaceId,
      collectionId: fields.collectionId,
      folderId: fields.folderId,
      categoryId: fields.categoryId,
      name: fields.name ?? baseName,
      slug: fields.slug ?? this.slugify(baseName),
      description: fields.description,
      language: fields.language,
      sourceType: "FILE",
      fileName: fields.name ?? baseName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      buffer: file.buffer,
      metadata: fields.metadata
    });
  }

  ingestText(
    workspaceId: string,
    actorId: string,
    dto: CreateKnowledgeTextDocumentDto
  ) {
    return this.ingest(workspaceId, actorId, {
      spaceId: dto.spaceId,
      collectionId: dto.collectionId,
      folderId: dto.folderId,
      categoryId: dto.categoryId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      language: dto.language,
      sourceType: "TEXT",
      fileName: `${dto.slug}.txt`,
      originalName: `${dto.slug}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(dto.content, "utf8"),
      metadata: dto.metadata
    });
  }

  private async ingest(workspaceId: string, actorId: string, input: IngestionInput) {
    const sizeBytes = input.buffer.length;
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    const document = await this.createDraft(workspaceId, actorId, input, sizeBytes, checksum);
    try {
      const indexing = await this.repository.beginProcessing(workspaceId, actorId, document.id);
      const extracted = await this.extractor.extract({
        buffer: input.buffer,
        mimeType: input.mimeType,
        fileName: input.originalName
      });
      const chunks = this.chunker.chunk(extracted.content);
      if (!chunks.length) throw new Error("No extractable text was found in the document");
      const embedding = await this.embeddingService.embed(
        workspaceId,
        chunks.map((chunk) => ({
          ordinal: chunk.ordinal,
          content: String(chunk.metadata?.content ?? "")
        }))
      );
      const result = await this.repository.persistProcessingResult(workspaceId, actorId, indexing.id, {
        chunks,
        embeddings: embedding.vectors,
        parserMetadata: extracted.parserMetadata,
        chunkStrategy: { ...(chunks[0]?.strategyMetadata ?? {}) },
        embeddingStatus: this.embeddingStatus(embedding),
        totalPages: extracted.totalPages,
        fileSizeBytes: sizeBytes
      });
      this.logger.log(`Knowledge document ${document.id} indexed with ${chunks.length} chunks`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository
        .failProcessing(workspaceId, actorId, document.id, { code: "PROCESSING_FAILED", message })
        .catch((failure: unknown) =>
          this.logger.error(`Failed to mark document ${document.id} as FAILED: ${failure}`)
        );
      throw error;
    }
  }

  private async createDraft(
    workspaceId: string,
    actorId: string,
    input: IngestionInput,
    sizeBytes: number,
    checksum: string
  ) {
    const slugCandidates = [input.slug, `${input.slug}-${randomUUID().slice(0, 8)}`];
    for (const slug of slugCandidates) {
      try {
        return await this.repository.createDocument(workspaceId, actorId, {
          spaceId: input.spaceId,
          collectionId: input.collectionId,
          folderId: input.folderId,
          categoryId: input.categoryId,
          name: input.name,
          slug,
          description: input.description,
          sourceType: input.sourceType,
          fileName: input.fileName,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes,
          checksum,
          language: input.language,
          sourceMetadata: { ingestion: "knowledge-pipeline-v1" },
          metadata: input.metadata
        });
      } catch (error) {
        if (error instanceof ConflictException) continue;
        throw error;
      }
    }
    throw new ConflictException("A knowledge resource with this name or slug already exists");
  }

  private embeddingStatus(embedding: Awaited<ReturnType<KnowledgeEmbeddingService["embed"]>>) {
    return embedding.status === "EMBEDDED"
      ? { status: "COMPLETED", model: embedding.embeddingModel, chunkCount: embedding.vectors.length }
      : { status: "SKIPPED", reason: embedding.reason ?? "UNKNOWN" };
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
    return slug || "document";
  }
}

