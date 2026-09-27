import { AiContractError } from "../ai/contracts";
import { EMBEDDING_DIMENSIONS, KnowledgeEmbeddingService } from "./knowledge-embedding.service";

const vector = (value: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);

const provider = {
  id: "provider-1",
  providerName: "openai",
  apiBaseUrl: "https://api.example.com/v1/",
  authenticationType: "BEARER",
  status: "ACTIVE" as const,
  priority: 1,
  configuration: { id: "config-1", enabled: true, settings: { embeddingModel: "test-embed" } },
  credentialConfigured: true,
  models: []
};

describe("KnowledgeEmbeddingService", () => {
  let postJson: jest.Mock;
  let useCredential: jest.Mock;
  let discover: jest.Mock;
  let service: KnowledgeEmbeddingService;

  beforeEach(() => {
    postJson = jest.fn();
    useCredential = jest.fn(async (_workspaceId: string, _providerId: string, operation: (c: { id: string; secret: string }) => Promise<void>) => {
      await operation({ id: "credential-1", secret: "sk-test" });
    });
    discover = jest.fn(async () => [provider]);
    service = new KnowledgeEmbeddingService(
      { postJson } as never,
      { useCredential } as never,
      { discover } as never,
      { get: jest.fn().mockReturnValue(30000) } as never
    );
  });

  const chunk = (ordinal: number, content: string) => ({ ordinal, content });

  it("skips embedding when the workspace has no configured provider", async () => {
    discover.mockResolvedValue([]);
    const outcome = await service.embed("workspace-1", [chunk(0, "hello")]);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "NO_PROVIDER", vectors: [] });
    expect(postJson).not.toHaveBeenCalled();
  });

  it("skips embedding when there is no text", async () => {
    const outcome = await service.embed("workspace-1", [chunk(0, "   "), chunk(1, "")]);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "NO_TEXT", vectors: [] });
    expect(postJson).not.toHaveBeenCalled();
  });

  it("maps provider vectors back to their source chunks", async () => {
    postJson.mockResolvedValue({
      status: 200,
      bytes: 10,
      body: JSON.stringify({
        data: [
          { index: 0, embedding: vector(0.25) },
          { index: 1, embedding: vector(0.5) }
        ],
        model: "test-embed"
      })
    });
    const outcome = await service.embed("workspace-1", [chunk(0, "first"), chunk(1, "second")]);
    expect(outcome.status).toBe("EMBEDDED");
    expect(outcome.embeddingModel).toBe("test-embed");
    expect(outcome.vectors).toHaveLength(2);
    expect(outcome.vectors[0]).toMatchObject({
      chunkNumber: 0,
      chunkText: "first",
      embeddingModel: "test-embed",
      vector: vector(0.25)
    });
    expect(outcome.vectors[1]).toMatchObject({ chunkNumber: 1, chunkText: "second", vector: vector(0.5) });
    expect(postJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        url: "https://api.example.com/v1/embeddings",
        authorization: "Bearer sk-test"
      })
    );
  });

  it("batches chunks in groups of 64", async () => {
    postJson.mockImplementation(async ({ body }: { body: string }) => {
      const input = (JSON.parse(body) as { input: string[] }).input;
      return {
        status: 200,
        bytes: 10,
        body: JSON.stringify({ data: input.map((_text, index) => ({ index, embedding: vector(0.1) })) })
      };
    });
    const chunks = Array.from({ length: 70 }, (_unused, ordinal) => chunk(ordinal, `chunk ${ordinal}`));
    const outcome = await service.embed("workspace-1", chunks);
    expect(outcome.status).toBe("EMBEDDED");
    expect(postJson).toHaveBeenCalledTimes(2);
    expect(outcome.vectors).toHaveLength(70);
    expect(outcome.vectors[64]).toMatchObject({ chunkNumber: 64, chunkText: "chunk 64" });
  });

  it("skips embedding when dimensions do not match the vector column", async () => {
    postJson.mockResolvedValue({
      status: 200,
      bytes: 10,
      body: JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2] }] })
    });
    const outcome = await service.embed("workspace-1", [chunk(0, "hello")]);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "EMBEDDING_FAILED", vectors: [] });
  });

  it("skips embedding when the provider returns an error status", async () => {
    postJson.mockResolvedValue({ status: 429, bytes: 10, body: "{}" });
    const outcome = await service.embed("workspace-1", [chunk(0, "hello")]);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "EMBEDDING_FAILED", vectors: [] });
  });

  it("skips embedding when the credential is unavailable and reports the contract code", async () => {
    useCredential.mockRejectedValue(
      new AiContractError("CREDENTIAL_UNAVAILABLE", "No active provider credential found")
    );
    const outcome = await service.embed("workspace-1", [chunk(0, "hello")]);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "CREDENTIAL_UNAVAILABLE", vectors: [] });
    expect(postJson).not.toHaveBeenCalled();
  });
});