import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { ProviderCredentialMetadata } from "./provider.types";

interface EncryptedProviderCredential extends ProviderCredentialMetadata {
  encryptedSecret: string;
}

const credentialSelection = {
  id: true,
  workspaceId: true,
  providerId: true,
  name: true,
  encryptedSecret: true,
  keyFingerprint: true,
  status: true,
  priority: true,
  dailyRequestLimit: true,
  dailyTokenLimit: true,
  lastUsedAt: true
} as const;

@Injectable()
export class CredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMetadata(
    workspaceId: string,
    providerId: string
  ): Promise<ProviderCredentialMetadata[]> {
    const credentials = await this.prisma.aiProviderCredential.findMany({
      where: { workspaceId, providerId, deletedAt: null },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      select: credentialSelection
    });
    return credentials.map((credential) => ({
      id: credential.id,
      workspaceId: credential.workspaceId,
      providerId: credential.providerId,
      name: credential.name,
      keyFingerprint: credential.keyFingerprint,
      status: credential.status,
      priority: credential.priority,
      dailyRequestLimit: credential.dailyRequestLimit,
      dailyTokenLimit: credential.dailyTokenLimit,
      lastUsedAt: credential.lastUsedAt
    }));
  }

  async findActiveEnvelope(
    workspaceId: string,
    providerId: string
  ): Promise<EncryptedProviderCredential | null> {
    const credential = await this.prisma.aiProviderCredential.findFirst({
      where: {
        workspaceId,
        providerId,
        status: "ACTIVE",
        deletedAt: null,
        provider: { status: "ACTIVE" }
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      select: credentialSelection
    });
    return credential
      ? {
          id: credential.id,
          workspaceId: credential.workspaceId,
          providerId: credential.providerId,
          name: credential.name,
          encryptedSecret: credential.encryptedSecret,
          keyFingerprint: credential.keyFingerprint,
          status: credential.status,
          priority: credential.priority,
          dailyRequestLimit: credential.dailyRequestLimit,
          dailyTokenLimit: credential.dailyTokenLimit,
          lastUsedAt: credential.lastUsedAt
        }
      : null;
  }
}
