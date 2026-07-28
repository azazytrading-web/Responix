import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import {
  CreateKnowledgeDocumentDto,
  KnowledgeDocumentListQueryDto,
  RollbackKnowledgeDocumentDto
} from "./dto/knowledge-base.dto";

describe("KnowledgeBaseController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it("accepts complete metadata-only document configuration", async () => {
    await expect(pipe.transform({
      spaceId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
      collectionId: "ad0ed78e-4097-4489-a89a-4e5d0c90139a",
      name: "Employee Policy",
      slug: "employee-policy",
      sourceType: "URL",
      sourceUrl: "https://example.com/policy",
      mimeType: "text/html",
      sizeBytes: 1024,
      language: "en",
      checksum: "sha256:abc",
      parserMetadata: { parser: "html" },
      chunkStrategy: { kind: "fixed", size: 500 },
      embeddingStatusMetadata: { status: "not_started" },
      syncMetadata: { mode: "manual" },
      importMetadata: { source: "admin" },
      chunks: [{ ordinal: 0, tokenCount: 100, characterCount: 450 }]
    }, { type: "body", metatype: CreateKnowledgeDocumentDto })).resolves.toBeInstanceOf(CreateKnowledgeDocumentDto);
  });

  it.each([
    {
      spaceId: "invalid", name: "Policy", slug: "policy", sourceType: "FILE"
    },
    {
      spaceId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
      name: "URL", slug: "url", sourceType: "URL", sourceUrl: "not-a-url"
    },
    {
      spaceId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
      name: "Bad", slug: "Bad Slug", sourceType: "TEXT"
    }
  ])("rejects invalid document metadata %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body", metatype: CreateKnowledgeDocumentDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates rollback and transforms list pagination", async () => {
    await expect(pipe.transform({ revision: 0 }, {
      type: "body", metatype: RollbackKnowledgeDocumentDto
    })).rejects.toBeInstanceOf(BadRequestException);
    const query = await pipe.transform(
      { page: "2", limit: "50", status: "PUBLISHED", sourceType: "FILE" },
      { type: "query", metatype: KnowledgeDocumentListQueryDto }
    ) as KnowledgeDocumentListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "PUBLISHED", sourceType: "FILE" });
  });

  it("declares dedicated Knowledge Base permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.documents)).toEqual(["knowledge.base.read"]);
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.createDocument)).toEqual(["knowledge.base.write"]);
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.publish)).toEqual(["knowledge.base.publish"]);
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.rollback)).toEqual(["knowledge.base.rollback"]);
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.archive)).toEqual(["knowledge.base.archive"]);
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.deleteDocument)).toEqual(["knowledge.base.delete"]);
    expect(reflector.get("permissions", KnowledgeBaseController.prototype.createSpace)).toEqual(["knowledge.base.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
