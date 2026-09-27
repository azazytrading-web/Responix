import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";
import { KnowledgeEmbeddingService } from "./knowledge-embedding.service";
import { KnowledgePipelineService } from "./knowledge-pipeline.service";
import { TextChunkerService } from "./text-chunker.service";
import { TextExtractorService } from "./text-extractor.service";

const enabled = process.env.RUN_KNOWLEDGE_PIPELINE_DB_TEST === "1";
const describeDb = enabled ? describe : describe.skip;

describeDb("Knowledge pipeline PostgreSQL integration", () => {
  const prisma = new PrismaService();
  const repository = new KnowledgeBaseRepository(prisma);
  const embedding = new KnowledgeEmbeddingService(
    {} as never,
    {} as never,
    { discover: async () => [] } as never,
    { get: () => 30000 } as never
  );
  const pipeline = new KnowledgePipelineService(
    repository,
    new TextExtractorService(),
    new TextChunkerService(),
    embedding
  );
  const created = { spaceId: null as string | null, documentId: null as string | null };

  afterAll(async () => {
    if (created.documentId) {
      await prisma.embedding.deleteMany({ where: { documentId: created.documentId } });
      await prisma.knowledgeVersion.deleteMany({ where: { documentId: created.documentId } });
      await prisma.knowledgeChunkMetadata.deleteMany({ where: { documentId: created.documentId } });
      await prisma.auditLog.deleteMany({ where: { entityType: "KnowledgeDocument", entityId: created.documentId } });
      await prisma.knowledgeDocument.delete({ where: { id: created.documentId } });
    }
    if (created.spaceId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "KnowledgeSpace", entityId: created.spaceId } });
      await prisma.knowledgeBase.delete({ where: { id: created.spaceId } });
    }
    await prisma.$disconnect();
  });

  it("indexes, publishes and retrieves an ingested text document end to end", async () => {
    const owner = await prisma.channelConnection.findFirst({ select: { workspaceId: true, createdById: true } });
    if (!owner?.createdById) throw new Error("A development ChannelConnection with an actor is required");
    const workspaceId = owner.workspaceId;
    const actorId = owner.createdById;

    const space = await repository.createSpace(workspaceId, actorId, {
      name: `Pipeline Space ${randomUUID().slice(0, 8)}`,
      slug: `pipeline-space-${randomUUID().slice(0, 8)}`
    });
    created.spaceId = space.id;

    const document = await pipeline.ingestText(workspaceId, actorId, {
      spaceId: space.id,
      name: "Pipeline Retrieval Policy",
      slug: `pipeline-retrieval-${randomUUID().slice(0, 8)}`,
      content: [
        "The Zephyr retrieval policy defines how knowledge chunks are matched.",
        "Relevance scoring combines lexical overlap with vector similarity when embeddings exist.",
        "Operators can publish a knowledge space once every document is indexed.",
        "Fallback lexical matching keeps retrieval functional when no embedding provider is configured."
      ].join("\n\n")
    });
    created.documentId = document.id;

    expect(document.status).toBe("READY");
    expect(document.indexingStatus).toBe("COMPLETED");
    expect(document.totalChunks).toBeGreaterThan(1);

    const chunks = await prisma.knowledgeChunkMetadata.findMany({
      where: { documentId: document.id },
      orderBy: { ordinal: "asc" }
    });
    expect(chunks).toHaveLength(document.totalChunks);
    const contents = chunks.map((chunk) => String((chunk.metadata as { content: string }).content));
    expect(contents.join(" ")).toContain("Zephyr retrieval policy");
    expect(chunks[0]?.ordinal).toBe(0);
    expect(chunks[0]?.tokenCount).toBeGreaterThan(0);
    expect(chunks[0]?.characterCount).toBeGreaterThan(0);

    const publishedSpace = await repository.publishSpace(workspaceId, actorId, space.id);
    expect(publishedSpace.status).toBe("PUBLISHED");

    const published = await repository.publishDocument(workspaceId, actorId, document.id, "Pipeline publish");
    expect(published.document.status).toBe("PUBLISHED");
    expect(published.version).toBeDefined();

    const results = await repository.listDocuments({
      workspaceId,
      page: 1,
      limit: 25,
      search: "Retrieval Policy",
      spaceId: space.id
    });
    expect(results.data.map((doc) => doc.id)).toContain(document.id);
    expect(results.pagination.total).toBeGreaterThanOrEqual(1);
  });
});