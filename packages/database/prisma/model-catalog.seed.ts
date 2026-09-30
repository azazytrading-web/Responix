import type { PrismaClient } from "@prisma/client";

/** Curates only built-in display/limit metadata, retaining identity, lifecycle and evidence. */
export async function seedBuiltInModel(prisma: PrismaClient, definition: {
  providerId: string; modelName: string; displayName: string; contextWindow: number;
}): Promise<{ id: string }> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`model-seed:${definition.providerId}`}))`;
    const existing = await tx.aiModel.findFirst({ where: { providerId: definition.providerId,
      providerModelId: definition.modelName, ownerWorkspaceId: null, source: "BUILT_IN" }, select: { id: true } });
    if (existing) return tx.aiModel.update({ where: { id: existing.id }, data: {
      displayName: definition.displayName, contextWindow: definition.contextWindow
    }, select: { id: true } });
    return tx.aiModel.create({ data: { ...definition, providerModelId: definition.modelName, source: "BUILT_IN",
      pricingRecords: { create: { state: "UNKNOWN", source: "PLATFORM_CURATED", effectiveFrom: new Date() } }
    }, select: { id: true } });
  });
}
