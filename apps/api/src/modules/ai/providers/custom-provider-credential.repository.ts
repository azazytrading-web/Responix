import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class CustomProviderCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    workspaceId: string;
    customProviderId: string;
    name: string;
    encryptedSecret: string;
    keyFingerprint: string;
  }) {
    return this.prisma.customAiProviderCredential.upsert({
      where: { workspaceId_customProviderId_name: {
        workspaceId: input.workspaceId, customProviderId: input.customProviderId, name: input.name
      } },
      create: input,
      update: {
        encryptedSecret: input.encryptedSecret, keyFingerprint: input.keyFingerprint,
        encryptionVersion: 1, status: "ACTIVE", deletedAt: null
      },
      select: { id: true, workspaceId: true, customProviderId: true, name: true, keyFingerprint: true, status: true }
    });
  }

  listMetadata(workspaceId: string, customProviderId: string) {
    return this.prisma.customAiProviderCredential.findMany({
      where: { workspaceId, customProviderId, deletedAt: null },
      orderBy: [{ priority: "desc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      select: {
        id: true, workspaceId: true, customProviderId: true, name: true, keyFingerprint: true,
        status: true, priority: true, lastUsedAt: true
      }
    });
  }

  async findActiveEnvelope(workspaceId: string, customProviderId: string) {
    const credential = await this.prisma.customAiProviderCredential.findFirst({
      where: {
        workspaceId, customProviderId, status: "ACTIVE", deletedAt: null,
        customProvider: { workspaceId, status: "ACTIVE" }
      },
      orderBy: [{ priority: "desc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      select: {
        id: true, workspaceId: true, customProviderId: true, name: true,
        encryptedSecret: true, keyFingerprint: true, status: true, priority: true,
        lastUsedAt: true
      }
    });
    if (!credential) return null;
    await this.prisma.customAiProviderCredential.updateMany({
      where: { id: credential.id, workspaceId, customProviderId, status: "ACTIVE", deletedAt: null },
      data: { lastUsedAt: new Date() }
    });
    return credential;
  }

  async findValidationEnvelope(workspaceId: string, customProviderId: string) {
    const credential = await this.prisma.customAiProviderCredential.findFirst({
      where: {
        workspaceId,
        customProviderId,
        status: "ACTIVE",
        deletedAt: null,
        customProvider: { workspaceId, status: { in: ["ACTIVE", "DISABLED"] } }
      },
      orderBy: [{ priority: "desc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      select: {
        id: true, workspaceId: true, customProviderId: true, name: true,
        encryptedSecret: true, keyFingerprint: true, status: true, priority: true,
        lastUsedAt: true
      }
    });
    if (!credential) return null;
    await this.prisma.customAiProviderCredential.updateMany({
      where: { id: credential.id, workspaceId, customProviderId, status: "ACTIVE", deletedAt: null },
      data: { lastUsedAt: new Date() }
    });
    return credential;
  }
}
