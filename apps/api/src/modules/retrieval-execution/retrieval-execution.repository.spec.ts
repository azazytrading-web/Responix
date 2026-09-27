import { PrismaService } from "../../database/prisma.service";
import { ExecuteRetrievalDto } from "./dto/retrieval-execution.dto";
import { RetrievalExecutionRepository } from "./retrieval-execution.repository";
import type { RetrievalKnowledgePackage } from "./retrieval-execution.types";
import { RetrievalExecutionValidator } from "./retrieval-execution.validator";

type Chunk = { ordinal: number; tokenCount: number; content: string };

const CHUNK_COUNT = 15;
const FILLER = "lorem ipsum filler that matches no query term";
const snapshotId = crypto.randomUUID();
const versionId = crypto.randomUUID();
const documentId = crypto.randomUUID();

/** Builds an in-memory Prisma transaction harness for a single-document knowledge space. */
function createHarness(chunks: Chunk[]) {
  const validator = new RetrievalExecutionValidator();
  const transaction = jest.fn<Promise<unknown>, [callback: (client: unknown) => unknown]>();
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const repository = new RetrievalExecutionRepository(prisma, validator);
  const hash = (repository as unknown as { hash: (value: unknown) => string }).hash.bind(repository);

  const corePackage = { sources: [{ versionId }] };
  const packageHash = hash(corePackage);
  const checksum = hash({ packageHash, sourceVersions: [versionId] });
  const snapshotRow = { id: snapshotId, runtimeId: "runtime", knowledgeBaseId: "knowledge",
    packageHash, checksum, retrievalPackage: corePackage,
    runtime: { status: "PUBLISHED", archivedAt: null } };
  const versionRow = { id: versionId,
    snapshot: { chunks: chunks.map((chunk) => ({ ordinal: chunk.ordinal, metadata: { content: chunk.content } })) },
    document: { id: documentId, name: "Document", fileName: "document.txt", mimeType: "text/plain",
      chunks: chunks.map((chunk) => ({ id: crypto.randomUUID(), workspaceId: "workspace",
        documentId, ordinal: chunk.ordinal, tokenCount: chunk.tokenCount,
        characterCount: chunk.content.length, checksum: null, strategyMetadata: {},
        metadata: { content: chunk.content } })) } };

  const tx = {
    retrievalRuntimeSnapshot: { findFirst: jest.fn().mockResolvedValue(snapshotRow) },
    retrievalExecution: { findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "execution", ...data })) },
    knowledgeVersion: { findMany: jest.fn().mockResolvedValue([versionRow]) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit" }) },
  };
  transaction.mockImplementation((callback) => Promise.resolve(callback(tx)));

  const execute = (query: string, maxTokens?: number) =>
    repository.execute("workspace", "actor", { retrievalRuntimeSnapshotId: snapshotId, query,
      ...(maxTokens === undefined ? {} : { maxTokens }) } as ExecuteRetrievalDto)
      .then((value) => value as RetrievalKnowledgePackage);

  return { execute };
}

function chunksWithAnswer(answerOrdinal: number, answerText: string, tokenCount = 500): Chunk[] {
  return Array.from({ length: CHUNK_COUNT }, (_, ordinal) => ({
    ordinal, tokenCount, content: ordinal === answerOrdinal ? answerText : FILLER,
  }));
}
const firstDocument = (packageValue: RetrievalKnowledgePackage) => {
  const document = packageValue.documents[0];
  if (!document) throw new Error("Expected retrieval result to contain a document");
  return document;
};
const ordinals = (packageValue: RetrievalKnowledgePackage) =>
  firstDocument(packageValue).chunks.map((chunk) => chunk.ordinal);

describe("RetrievalExecutionRepository chunk access", () => {
  it("retrieves a late chunk (ordinal 12) even when the document exceeds the 4,000-token packaging budget", async () => {
    const { execute } = createHarness(chunksWithAnswer(12, "zebra unicorn answer"));
    const result = await execute("zebra unicorn"); // default maxTokens = 4000
    expect(result.documents.length).toBe(1);
    expect(ordinals(result)).toContain(12);
    expect(result.budget.usedTokens).toBeLessThanOrEqual(result.budget.maxTokens);
    expect(result.budget.truncated).toBe(true);
  });

  it("retrieves a matching chunk near the beginning", async () => {
    const { execute } = createHarness(chunksWithAnswer(0, "alpha marker here"));
    const result = await execute("alpha");
    expect(ordinals(result)).toContain(0);
  });

  it("retrieves a matching chunk in the middle", async () => {
    const { execute } = createHarness(chunksWithAnswer(7, "gamma marker here"));
    const result = await execute("gamma");
    expect(ordinals(result)).toContain(7);
  });

  it("retrieves a matching chunk near the end", async () => {
    const { execute } = createHarness(chunksWithAnswer(14, "omega marker here"));
    const result = await execute("omega");
    expect(ordinals(result)).toContain(14);
  });

  it("retrieves multiple matching chunks from different ordinals together", async () => {
    const chunks = Array.from({ length: CHUNK_COUNT }, (_, ordinal) => ({
      ordinal, tokenCount: 500,
      content: ordinal === 2 ? "alpha only" : ordinal === 9 ? "beta only" : ordinal === 14 ? "alpha beta together" : FILLER,
    }));
    const { execute } = createHarness(chunks);
    const result = await execute("alpha beta");
    expect(ordinals(result)).toEqual(expect.arrayContaining([2, 9, 14]));
  });

  it("returns the document when its total token count exceeds the budget (~14k regression)", async () => {
    const { execute } = createHarness(chunksWithAnswer(0, "introduction overview", 1000)); // 15 * 1000 = 15,000 > 4000
    const result = await execute("introduction");
    expect(result.documents.length).toBeGreaterThan(0);
    expect(ordinals(result)).toContain(0);
  });

  it("keeps returned chunks in ascending ordinal order", async () => {
    const { execute } = createHarness(chunksWithAnswer(12, "zebra unicorn answer"));
    const result = await execute("zebra unicorn");
    const actual = ordinals(result);
    expect([...actual].sort((a, b) => a - b)).toEqual(actual);
  });

  it("keeps citations stable for the single document", async () => {
    const { execute } = createHarness(chunksWithAnswer(12, "zebra answer"));
    const result = await execute("zebra");
    expect(result.citations).toHaveLength(1);
    expect(firstDocument(result).citation).toEqual(expect.objectContaining({
      index: 1, documentId, versionId,
    }));
  });

  it("never exceeds the packaging token budget", async () => {
    const { execute } = createHarness(chunksWithAnswer(12, "zebra answer", 1000));
    const result = await execute("zebra");
    expect(result.budget.usedTokens).toBeLessThanOrEqual(result.budget.maxTokens);
  });

  it("returns every chunk unchanged when the whole document fits the budget", async () => {
    const { execute } = createHarness(chunksWithAnswer(12, "zebra answer", 200)); // 15 * 200 = 3,000 < 4,000
    const result = await execute("zebra");
    expect(firstDocument(result).chunks).toHaveLength(CHUNK_COUNT);
    expect(result.budget.truncated).toBe(false);
  });
});
