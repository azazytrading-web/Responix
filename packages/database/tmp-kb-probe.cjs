const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const spaceSelect = {
  id: true, workspaceId: true, name: true, slug: true, description: true, categoryId: true,
  metadata: true, status: true, createdById: true, updatedById: true, createdAt: true,
  updatedAt: true, archivedAt: true, deletedAt: true
};
const chunkSelect = {
  id: true, ordinal: true, checksum: true, tokenCount: true, characterCount: true,
  strategyMetadata: true, metadata: true, createdAt: true, updatedAt: true
};
const taxonomySelect = {
  id: true, workspaceId: true, name: true, slug: true, metadata: true,
  createdAt: true, updatedAt: true
};
const documentSelect = {
  id: true, workspaceId: true, knowledgeBaseId: true, collectionId: true, folderId: true,
  categoryId: true, name: true, slug: true, description: true, sourceType: true,
  sourceMetadata: true, fileMetadata: true, urlMetadata: true, fileName: true,
  originalName: true, mimeType: true, fileSize: true, language: true, checksum: true,
  parserMetadata: true, chunkStrategy: true, embeddingStatusMetadata: true,
  indexingStatus: true, totalChunks: true,
  syncMetadata: true, importMetadata: true, metadata: true, status: true, revision: true,
  createdById: true, updatedById: true, createdAt: true, updatedAt: true,
  archivedAt: true, deletedAt: true,
  chunks: { select: chunkSelect, orderBy: { ordinal: "asc" } },
  tags: { select: { tag: { select: taxonomySelect } }, orderBy: { tag: { name: "asc" } } }
};

async function main() {
  const workspaces = await p.workspace.findMany({ take: 5, select: { id: true, name: true } });
  console.log("WORKSPACES", JSON.stringify(workspaces));
  if (!workspaces.length) return;
  const workspaceId = workspaces[0].id;

  const probes = {
    listSpaces: () => p.knowledgeBase.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { name: "asc" }, select: spaceSelect }),
    listDocuments: () => p.knowledgeDocument.findMany({ where: { workspaceId, deletedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: 0, take: 25, select: documentSelect }),
    listCollections: () => p.knowledgeCollection.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { name: "asc" } }),
    listFolders: () => p.knowledgeFolder.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { name: "asc" } }),
    listTags: () => p.knowledgeTag.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    listCategories: () => p.knowledgeCategory.findMany({ where: { workspaceId }, orderBy: { name: "asc" } })
  };
  for (const [name, fn] of Object.entries(probes)) {
    try {
      const r = await fn();
      console.log(`OK ${name} count=${r.length}`);
    } catch (e) {
      console.error(`FAIL ${name}:`, e.message.slice(0, 1500));
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("MAIN_ERR", e.message.slice(0, 800)); process.exit(1); });
