import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CompareRetrievalSnapshotsDto,
  PrepareRetrievalRuntimeDto,
  RetrievalRuntimeListQueryDto,
  RetrievalSnapshotListQueryDto
} from "./dto/retrieval-runtime.dto";
import { RetrievalRuntimeController } from "./retrieval-runtime.controller";

describe("RetrievalRuntimeController validation and permissions", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  });

  it("accepts nested retrieval metadata", async () => {
    const result = await pipe.transform({
      name: "Support Retrieval",
      knowledgeBaseId: "11111111-1111-4111-8111-111111111111",
      language: "en-US",
      allowedMimeTypes: ["text/plain"],
      sources: [{
        documentId: "22222222-2222-4222-8222-222222222222",
        versionId: "33333333-3333-4333-8333-333333333333",
        metadata: { priority: 1 }
      }],
      collections: [{
        collectionId: "44444444-4444-4444-8444-444444444444"
      }],
      filters: [{ key: "document.language", operator: "EQUALS", value: "en-US" }],
      variables: [{ name: "tenant.plan", type: "STRING", value: "enterprise" }]
    }, { type: "body", metatype: PrepareRetrievalRuntimeDto }) as PrepareRetrievalRuntimeDto;
    expect(result).toBeInstanceOf(PrepareRetrievalRuntimeDto);
    expect(result.sources?.[0]).toBeInstanceOf(Object);
  });

  it.each([
    {},
    { name: "Runtime", knowledgeBaseId: "invalid" },
    {
      name: "Runtime",
      knowledgeBaseId: "11111111-1111-4111-8111-111111111111",
      language: "not a language",
      unknown: true
    },
    {
      name: "Runtime",
      knowledgeBaseId: "11111111-1111-4111-8111-111111111111",
      filters: [{ key: "bad key", operator: "UNKNOWN" }]
    }
  ])("rejects invalid preparation DTO %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body",
      metatype: PrepareRetrievalRuntimeDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("transforms pagination and validates compare queries", async () => {
    const list = await pipe.transform({
      page: "2", limit: "50", status: "PUBLISHED",
      knowledgeBaseId: "11111111-1111-4111-8111-111111111111"
    }, { type: "query", metatype: RetrievalRuntimeListQueryDto }) as RetrievalRuntimeListQueryDto;
    const snapshots = await pipe.transform({
      page: "3", runtimeId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: RetrievalSnapshotListQueryDto }) as RetrievalSnapshotListQueryDto;
    expect(list).toMatchObject({ page: 2, limit: 50, status: "PUBLISHED" });
    expect(snapshots).toMatchObject({ page: 3 });
    await expect(pipe.transform({
      leftId: "11111111-1111-4111-8111-111111111111",
      rightId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: CompareRetrievalSnapshotsDto }))
      .resolves.toBeInstanceOf(CompareRetrievalSnapshotsDto);
  });

  it("declares every dedicated Retrieval Runtime permission", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.prepare))
      .toEqual(["retrieval.runtime.create"]);
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.validate))
      .toEqual(["retrieval.runtime.update"]);
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.publish))
      .toEqual(["retrieval.runtime.publish"]);
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.archive))
      .toEqual(["retrieval.runtime.archive"]);
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.restore))
      .toEqual(["retrieval.runtime.restore"]);
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.list))
      .toEqual(["retrieval.runtime.read"]);
    expect(reflector.get("permissions", RetrievalRuntimeController.prototype.compare))
      .toEqual(["retrieval.runtime.compare"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
