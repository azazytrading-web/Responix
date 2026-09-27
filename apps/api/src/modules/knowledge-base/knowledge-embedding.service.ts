import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AiContractError } from "../ai/contracts";
import { ProviderCredentialService } from "../ai/providers/provider-credential.service";
import { ProviderDiscoveryService } from "../ai/providers/provider-discovery.service";
import type { WorkspaceProvider } from "../ai/providers/provider.types";
import { ProviderHttpClient } from "../ai/security/provider-http-client.service";

export interface EmbeddingVector {
  chunkNumber: number;
  chunkText: string;
  vector: number[];
  embeddingModel: string;
  tokenCount: number;
}

export interface EmbeddingOutcome {
  status: "EMBEDDED" | "SKIPPED";
  reason?: string;
  embeddingModel?: string;
  vectors: EmbeddingVector[];
}

export interface EmbeddingChunk {
  ordinal: number;
  content: string;
}

/** Matches the `vector(1536)` column on the Embedding model. */
export const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 64;
const TOKENS_PER_CHAR = 4;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

const embeddingResponseSchema = z.object({
  data: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        embedding: z.array(z.number())
      })
    )
    .min(1),
  model: z.string().optional(),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative()
    })
    .optional()
});

/**
 * Calls an OpenAI-compatible `/embeddings` endpoint through the secured provider
 * HTTP client. Embedding is a best-effort enhancement for V1: when no provider is
 * configured (or the call fails) the outcome is a graceful skip so that chunks
 * still persist and lexical retrieval keeps working.
 */
@Injectable()
export class KnowledgeEmbeddingService {
  private readonly logger = new Logger(KnowledgeEmbeddingService.name);

  constructor(
    private readonly http: ProviderHttpClient,
    private readonly credentials: ProviderCredentialService,
    private readonly discovery: ProviderDiscoveryService,
    private readonly config: ConfigService
  ) {}

  async embed(workspaceId: string, chunks: EmbeddingChunk[]): Promise<EmbeddingOutcome> {
    const texts = chunks.filter((chunk) => chunk.content.trim().length > 0);
    if (!texts.length) return { status: "SKIPPED", reason: "NO_TEXT", vectors: [] };
    const provider = (await this.discovery.discover(workspaceId)).find(
      (item) => item.credentialConfigured
    );
    if (!provider) {
      this.logger.warn(`Embedding skipped for workspace ${workspaceId}: no configured provider`);
      return { status: "SKIPPED", reason: "NO_PROVIDER", vectors: [] };
    }
    const model = this.resolveModel(provider);
    const baseUrl = (provider.apiBaseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const timeoutMs = Number(this.config.get<number>("ai.requestTimeoutMs")) || 30000;
    try {
      const vectors: EmbeddingVector[] = [];
      await this.credentials.useCredential(workspaceId, provider.id, async (credential) => {
        for (const batch of this.batches(texts)) {
          const response = await this.http.postJson({
            provider: provider.providerName,
            url: `${baseUrl}/embeddings`,
            authorization: `Bearer ${credential.secret}`,
            body: JSON.stringify({ model, input: batch.map((item) => item.content), encoding_format: "float" }),
            signal: AbortSignal.timeout(timeoutMs)
          });
          if (response.status < 200 || response.status >= 300) {
            throw new Error(`Embedding provider returned HTTP ${response.status}`);
          }
          let payload: unknown;
          try {
            payload = JSON.parse(response.body);
          } catch {
            throw new Error("Embedding provider returned invalid JSON");
          }
          const parsed = embeddingResponseSchema.safeParse(payload);
          if (!parsed.success) throw new Error("Embedding provider response was invalid");
          for (const item of parsed.data.data) {
            if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
              throw new Error(`Embedding dimension ${item.embedding.length} does not match ${EMBEDDING_DIMENSIONS}`);
            }
            const source = batch[item.index];
            if (!source) throw new Error("Embedding response index is out of range");
            vectors.push({
              chunkNumber: source.ordinal,
              chunkText: source.content,
              vector: item.embedding,
              embeddingModel: model,
              tokenCount: Math.ceil(source.content.length / TOKENS_PER_CHAR)
            });
          }
        }
      });
      return { status: "EMBEDDED", embeddingModel: model, vectors };
    } catch (error) {
      const reason = error instanceof AiContractError ? error.code : "EMBEDDING_FAILED";
      this.logger.warn(
        `Embedding skipped for workspace ${workspaceId}: ${reason}${error instanceof Error ? ` (${error.message})` : ""}`
      );
      return { status: "SKIPPED", reason, vectors: [] };
    }
  }

  private resolveModel(provider: WorkspaceProvider): string {
    const settings = provider.configuration?.settings ?? {};
    const configured = settings.embeddingModel;
    return typeof configured === "string" && configured.length > 0
      ? configured
      : DEFAULT_EMBEDDING_MODEL;
  }

  private batches(items: EmbeddingChunk[]): EmbeddingChunk[][] {
    const batches: EmbeddingChunk[][] = [];
    for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
      batches.push(items.slice(offset, offset + BATCH_SIZE));
    }
    return batches;
  }
}
