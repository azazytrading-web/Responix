import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PDFParse } from "pdf-parse";

export interface SourceFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface ExtractedDocument {
  content: string;
  totalPages: number | null;
  parserMetadata: Record<string, unknown>;
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  htm: "text/html"
};

/**
 * Normalizes uploaded document bytes into plain text suitable for chunking.
 * Supports PDF, plain text, Markdown, CSV, JSON and HTML in V1.
 */
@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  async extract(file: SourceFile): Promise<ExtractedDocument> {
    const mimeType = this.resolveMimeType(file.mimeType, file.fileName);
    switch (mimeType) {
      case "application/pdf":
        return this.extractPdf(file.buffer);
      case "text/plain":
        return this.extractText(file.buffer, "text");
      case "text/markdown":
        return this.extractText(file.buffer, "markdown");
      case "text/csv":
        return this.extractCsv(file.buffer);
      case "application/json":
        return this.extractJson(file.buffer);
      case "text/html":
        return this.extractHtml(file.buffer);
      default:
        throw new BadRequestException(`Unsupported knowledge document type: ${mimeType || file.fileName}`);
    }
  }

  resolveMimeType(mimeType: string, fileName: string): string {
    const normalized = (mimeType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
    if (normalized && normalized !== "application/octet-stream") return normalized;
    const extension = (fileName ?? "").toLowerCase().split(".").pop() ?? "";
    return EXTENSION_MIME_TYPES[extension] ?? "";
  }

  private static readonly PDF_MAX_ATTEMPTS = 3;
  private static readonly PDF_RETRY_BASE_DELAY_MS = 120;

  private async extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
    // pdf.js (bundled inside pdf-parse) runs on Node via a "fake worker" that
    // round-trips data over a worker_threads MessageChannel. Issuing two
    // operations (getText + getInfo) to that worker *concurrently* makes the
    // structured clone deterministically throw `Unable to deserialize cloned
    // data`. Awaiting them one after the other keeps the worker single-flight
    // and parses reliably. We still retry with a fresh buffer copy as a
    // safety net for genuinely transient worker round-trip failures.
    let lastError: unknown;
    for (let attempt = 1; attempt <= TextExtractorService.PDF_MAX_ATTEMPTS; attempt++) {
      let parser: InstanceType<typeof PDFParse> | undefined;
      try {
        parser = new PDFParse({ data: new Uint8Array(buffer) });
        const textResult = await parser.getText();
        const infoResult = await parser.getInfo();
        const info = (infoResult.info ?? {}) as Record<string, unknown>;
        return {
          content: textResult.text ?? "",
          totalPages: Number.isFinite(textResult.total) ? textResult.total : null,
          parserMetadata: {
            parser: "pdf-parse",
            totalPages: textResult.total,
            ...(typeof info.Title === "string" ? { title: info.Title } : {}),
            ...(typeof info.Author === "string" ? { author: info.Author } : {}),
            ...(typeof info.Producer === "string" ? { producer: info.Producer } : {})
          }
        };
      } catch (error) {
        lastError = error;
        if (attempt < TextExtractorService.PDF_MAX_ATTEMPTS) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `PDF extraction attempt ${attempt}/${TextExtractorService.PDF_MAX_ATTEMPTS} failed (${message}); retrying`
          );
          await delay(TextExtractorService.PDF_RETRY_BASE_DELAY_MS * attempt);
        }
      } finally {
        if (parser) await parser.destroy().catch(() => undefined);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`PDF extraction failed: ${String(lastError)}`);
  }

  private extractText(buffer: Buffer, kind: "text" | "markdown"): ExtractedDocument {
    return {
      content: buffer.toString("utf8"),
      totalPages: null,
      parserMetadata: { parser: kind, rawBytes: buffer.length }
    };
  }

  private extractCsv(buffer: Buffer): ExtractedDocument {
    const content = buffer.toString("utf8");
    const rows = content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    return {
      content,
      totalPages: null,
      parserMetadata: { parser: "csv", rows, rawBytes: buffer.length }
    };
  }

  private extractJson(buffer: Buffer): ExtractedDocument {
    const raw = buffer.toString("utf8");
    let valid = false;
    let content = raw;
    try {
      content = JSON.stringify(JSON.parse(raw), null, 2);
      valid = true;
    } catch {
      // Keep the raw payload so malformed JSON still becomes retrievable text.
    }
    return {
      content,
      totalPages: null,
      parserMetadata: { parser: "json", validJson: valid, rawBytes: buffer.length }
    };
  }

  private extractHtml(buffer: Buffer): ExtractedDocument {
    const raw = buffer.toString("utf8");
    const withoutBlocks = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ");
    const content = this.decodeEntities(withoutBlocks.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").trim();
    return {
      content,
      totalPages: null,
      parserMetadata: { parser: "html-strip", rawBytes: buffer.length }
    };
  }

  private decodeEntities(value: string): string {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
