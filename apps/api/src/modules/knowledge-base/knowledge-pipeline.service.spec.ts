import { ConflictException } from "@nestjs/common";
import { KnowledgePipelineService } from "./knowledge-pipeline.service";

const chunk = {
  ordinal: 0,
  checksum: "abc",
  tokenCount: 10,
  characterCount: 40,
  strategyMetadata: { strategy: "paragraph", maxTokens: 1000, overlapTokens: 100, index: 0 },
  metadata: { content: "The quarterly policy" }
};

const textFields = {
  spaceId: "space-1",
  name: "Policy",
  slug: "policy",
  content: "The quarterly policy text"
} as never;

describe("KnowledgePipelineService", () => {
  let repository: {
    createDocument: jest.Mock;
    beginProcessing: jest.Mock;
    persistProcessingResult: jest.Mock;
    failProcessing: jest.Mock;
  };
  let extract: jest.Mock;
  let chunkText: jest.Mock;
  let embed: jest.Mock;
  let service: KnowledgePipelineService;

  const readyDocument = { id: "document-1", status: "READY", indexingStatus: "COMPLETED" };
  const indexingDocument = { id: "document-1", status: "INDEXING", indexingStatus: "PROCESSING" };

  beforeEach(() => {
    repository = {
      createDocument: jest.fn(),
      beginProcessing: jest.fn(),
      persistProcessingResult: jest.fn(),
      failProcessing: jest.fn()
    };
    extract = jest.fn();
    chunkText = jest.fn();
    embed = jest.fn();
    service = new KnowledgePipelineService(
      repository as never,
      { extract } as never,
      { chunk: chunkText } as never,
      { embed } as never
    );
  });

  const mockSuccessfulFlow = () => {
    repository.createDocument.mockResolvedValue(readyDocument);
    repository.beginProcessing.mockResolvedValue(indexingDocument);
    extract.mockResolvedValue({ content: "The quarterly policy", totalPages: null, parserMetadata: { parser: "text" } });
    chunkText.mockReturnValue([chunk]);
    embed.mockResolvedValue({ status: "SKIPPED", reason: "NO_PROVIDER", vectors: [] });
    repository.persistProcessingResult.mockResolvedValue(readyDocument);
  };

  it("indexes uploaded text into a READY document", async () => {
    mockSuccessfulFlow();
    const result = await service.ingestText("workspace-1", "actor-1", textFields);

    expect(repository.createDocument).toHaveBeenCalledWith(
      "workspace-1",
      "actor-1",
      expect.objectContaining({
        spaceId: "space-1",
        name: "Policy",
        slug: "policy",
        sourceType: "TEXT",
        fileName: "policy.txt",
        originalName: "policy.txt",
        mimeType: "text/plain",
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        sizeBytes: 25
      })
    );
    expect(repository.beginProcessing).toHaveBeenCalledWith("workspace-1", "actor-1", "document-1");
    expect(embed).toHaveBeenCalledWith("workspace-1", [{ ordinal: 0, content: "The quarterly policy" }]);
    expect(repository.persistProcessingResult).toHaveBeenCalledWith(
      "workspace-1",
      "actor-1",
      "document-1",
      expect.objectContaining({
        chunks: [chunk],
        parserMetadata: { parser: "text" },
        chunkStrategy: { strategy: "paragraph", maxTokens: 1000, overlapTokens: 100, index: 0 },
        embeddingStatus: { status: "SKIPPED", reason: "NO_PROVIDER" },
        totalPages: null,
        fileSizeBytes: 25
      })
    );
    expect(result).toEqual(readyDocument);
  });

  it("derives the document name and slug from the uploaded file name", async () => {
    mockSuccessfulFlow();
    await service.ingestFile("workspace-1", "actor-1", {
      buffer: Buffer.from("hello"),
      originalName: "My Policy Doc.txt",
      mimeType: "text/plain"
    }, { spaceId: "space-1" } as never);

    expect(repository.createDocument).toHaveBeenCalledWith(
      "workspace-1",
      "actor-1",
      expect.objectContaining({
        name: "My Policy Doc",
        slug: "my-policy-doc",
        sourceType: "FILE",
        originalName: "My Policy Doc.txt"
      })
    );
  });

  it("retries with a suffixed slug when the original slug collides", async () => {
    mockSuccessfulFlow();
    repository.createDocument
      .mockRejectedValueOnce(new ConflictException("A knowledge resource with this name or slug already exists"))
      .mockResolvedValueOnce(readyDocument);

    await service.ingestText("workspace-1", "actor-1", textFields);

    expect(repository.createDocument).toHaveBeenCalledTimes(2);
    const secondCall = repository.createDocument.mock.calls[1][2] as { slug: string };
    expect(secondCall.slug).toMatch(/^policy-[a-f0-9]{8}$/);
  });

  it("marks the document FAILED and rethrows when extraction fails", async () => {
    repository.createDocument.mockResolvedValue(readyDocument);
    extract.mockRejectedValue(new Error("unsupported document type"));
    repository.failProcessing.mockResolvedValue(readyDocument);

    await expect(service.ingestText("workspace-1", "actor-1", textFields)).rejects.toThrow("unsupported document type");

    expect(repository.failProcessing).toHaveBeenCalledWith("workspace-1", "actor-1", "document-1", {
      code: "PROCESSING_FAILED",
      message: "unsupported document type"
    });
    expect(repository.persistProcessingResult).not.toHaveBeenCalled();
  });

  it("fails the document when it contains no extractable text", async () => {
    repository.createDocument.mockResolvedValue(readyDocument);
    repository.beginProcessing.mockResolvedValue(indexingDocument);
    extract.mockResolvedValue({ content: "", totalPages: null, parserMetadata: {} });
    chunkText.mockReturnValue([]);
    repository.failProcessing.mockResolvedValue(readyDocument);

    await expect(service.ingestText("workspace-1", "actor-1", textFields)).rejects.toThrow(
      "No extractable text was found in the document"
    );

    expect(repository.failProcessing).toHaveBeenCalledWith("workspace-1", "actor-1", "document-1", {
      code: "PROCESSING_FAILED",
      message: "No extractable text was found in the document"
    });
    expect(embed).not.toHaveBeenCalled();
  });
});