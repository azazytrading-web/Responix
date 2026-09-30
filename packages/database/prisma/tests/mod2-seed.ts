import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { seedBuiltInModel } from "../model-catalog.seed";
const url = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/responix_mod2_catalog_test");
const prisma = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
const seedBuiltInModelForTest = seedBuiltInModel as unknown as (
  client: PrismaClient,
  definition: { providerId: string; modelName: string; displayName: string; contextWindow: number }
) => Promise<{ id: string }>;
try {
  const builtin = await prisma.aiModel.findMany({ where: { source: "BUILT_IN", providerModelId: { not: { startsWith: "identity-" } }, modelName: { not: "Legacy/TRUE" } } });
  assert.equal(builtin.length, 6);
  const workspace = await prisma.workspace.create({ data: { name: "Seed test", slug: randomUUID() } });
  const target = builtin[0]!;
  const custom = await prisma.aiModel.create({ data: { providerId: target.providerId, ownerWorkspaceId: workspace.id, source: "CUSTOM", modelName: target.modelName, providerModelId: target.providerModelId, displayName: "Workspace alias" } });
  for (let pass = 0; pass < 2; pass++) for (const model of builtin) {
    assert.equal((await seedBuiltInModelForTest(prisma, { providerId: model.providerId!, modelName: model.modelName, displayName: model.displayName, contextWindow: model.contextWindow! })).id, model.id);
  }
  assert.equal((await prisma.aiModel.findUniqueOrThrow({ where: { id: custom.id } })).displayName, "Workspace alias");
  console.log("PASS: 12 seed upserts preserve six built-in UUIDs and workspace model metadata.");
} finally { await prisma.$disconnect(); }
