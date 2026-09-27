import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { KnowledgeChunkMetadataDto } from "./dto/knowledge-base.dto";

/** Approximate tokens per character (matches the retrieval-execution token heuristic). */
export const TOKENS_PER_CHAR = 4;

export const DEFAULT_MAX_CHUNK_TOKENS = 1000;
export const DEFAULT_OVERLAP_TOKENS = 100;

export interface ChunkOptions {
  /** Target maximum chunk size in tokens. Defaults to 1000. */
  maxTokens?: number;
  /** Overlap between consecutive chunks in tokens. Defaults to 100. */
  overlapTokens?: number;
}

/**
 * Splits raw document text into deterministic, paragraph-aware retrieval chunks.
 * Each chunk carries its content in `metadata.content` so published snapshots
 * expose the text to lexical retrieval, plus checksum and token/character counts.
 */
@Injectable()
export class TextChunkerService {
  chunk(text: string, options: ChunkOptions = {}): KnowledgeChunkMetadataDto[] {
    const maxTokens = Math.max(64, options.maxTokens ?? DEFAULT_MAX_CHUNK_TOKENS);
    const overlapTokens = Math.max(0, Math.min(options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS, maxTokens / 2));
    const maxChars = maxTokens * TOKENS_PER_CHAR;
    const overlapChars = overlapTokens * TOKENS_PER_CHAR;
    const normalized = this.normalize(text);
    if (!normalized) return [];
    const pieces = this.toHardPieces(normalized, maxChars, 0);
    const contents = this.packPieces(pieces, maxChars, overlapChars);
    return contents.map((content, ordinal) => ({
      ordinal,
      checksum: createHash("sha256").update(content).digest("hex"),
      tokenCount: Math.ceil(content.length / TOKENS_PER_CHAR),
      characterCount: content.length,
      strategyMetadata: {
        strategy: "paragraph",
        maxTokens,
        overlapTokens,
        index: ordinal
      },
      metadata: { content }
    }));
  }

  normalize(text: string): string {
    return text
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private toHardPieces(text: string, maxChars: number, level: number): string[] {
    if (text.length <= maxChars) return [text];
    const boundaries: Array<(piece: string) => string[]> = [
      (piece) => piece.split(/\n{2,}/).filter(Boolean),
      (piece) => piece.split("\n").filter(Boolean),
      (piece) => piece.match(/[^.!?;:]+[.!?;:]*/g) ?? [piece],
      (piece) => piece.split(/(?<=\s)/).filter(Boolean)
    ];
    const boundary =
      boundaries[Math.min(level, boundaries.length - 1)] ?? ((piece: string) => [piece]);
    const parts = boundary(text).filter(Boolean);
    if (parts.length <= 1) {
      // No usable boundary (e.g. a single long token): hard slice.
      const pieces: string[] = [];
      for (let offset = 0; offset < text.length; offset += maxChars) {
        pieces.push(text.slice(offset, offset + maxChars));
      }
      return pieces;
    }
    return parts.flatMap((part) => this.toHardPieces(part, maxChars, level + 1));
  }

  private packPieces(pieces: string[], maxChars: number, overlapChars: number): string[] {
    const chunks: string[] = [];
    let current = "";
    for (const piece of pieces) {
      if (current && current.length + 1 + piece.length > maxChars) {
        chunks.push(current);
        const previous = chunks[chunks.length - 1] ?? "";
        const overlap = this.overlapTail(previous, overlapChars);
        current = overlap && overlap.length + 1 + piece.length <= maxChars
          ? `${overlap}\n${piece}`
          : piece;
      } else {
        current = current ? `${current}\n${piece}` : piece;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  private overlapTail(previous: string, overlapChars: number): string {
    if (!overlapChars || previous.length <= overlapChars) return "";
    const tail = previous.slice(-overlapChars);
    const boundary = tail.search(/\s/);
    return (boundary >= 0 ? tail.slice(boundary + 1) : tail).trimStart();
  }
}
