import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ProviderCredentialCryptoService } from "../ai/security/provider-credential-crypto.service";
import type { ChannelCredentialAccessor, ChannelCredentialReference, ChannelCredentialStore } from "./contracts/channel-credential.contract";

class ResolvedCredentials implements ChannelCredentialAccessor {
  constructor(private readonly values: ReadonlyMap<string, { secret: string; fingerprint: string }>) {}
  get(name: string): string { const value = this.values.get(name); if (!value) throw new NotFoundException(`Channel credential ${name} is unavailable`); return value.secret; }
  has(name: string) { return this.values.has(name); }
  fingerprint(name: string) { return this.values.get(name)?.fingerprint; }
  names() { return Object.freeze([...this.values.keys()]); }
}

@Injectable()
export class ChannelCredentialService implements ChannelCredentialStore {
  constructor(private readonly prisma: PrismaService, private readonly crypto: ProviderCredentialCryptoService) {}
  async resolve(workspaceId: string, connectionId: string): Promise<ChannelCredentialAccessor> {
    const connection = await this.prisma.channelConnection.findFirst({ where: { id: connectionId, workspaceId }, include: { credentialReferences: true } });
    if (!connection) throw new NotFoundException("Channel connection was not found");
    const values = new Map(connection.credentialReferences.filter((item) => item.revokedAt === null && (!item.expiresAt || item.expiresAt > new Date()))
      .map((item) => [item.name, { secret: this.crypto.decrypt(item.encryptedSecret), fingerprint: item.fingerprint }]));
    if (connection.encryptedAccessToken && !values.has("accessToken")) values.set("accessToken", { secret: this.crypto.decrypt(connection.encryptedAccessToken), fingerprint: connection.accessTokenFingerprint ?? "" });
    if (connection.encryptedVerifyToken && !values.has("verifyToken")) values.set("verifyToken", { secret: this.crypto.decrypt(connection.encryptedVerifyToken), fingerprint: this.crypto.fingerprint(this.crypto.decrypt(connection.encryptedVerifyToken)) });
    if (connection.encryptedAppSecret && !values.has("appSecret")) values.set("appSecret", { secret: this.crypto.decrypt(connection.encryptedAppSecret), fingerprint: this.crypto.fingerprint(this.crypto.decrypt(connection.encryptedAppSecret)) });
    return new ResolvedCredentials(values);
  }
  async rotate(workspaceId: string, actorId: string, connectionId: string, name: string, secret: string,
    expectedVersion: number, expiresAt?: Date): Promise<ChannelCredentialReference> {
    return this.prisma.$transaction(async (tx) => { const connection = await tx.channelConnection.findFirst({ where: { id: connectionId, workspaceId } });
      if (!connection) throw new NotFoundException("Channel connection was not found");
      const current = await tx.channelCredentialReference.findFirst({ where: { connectionId, name, revokedAt: null }, orderBy: { version: "desc" } });
      if ((current?.version ?? 0) !== expectedVersion) throw new ConflictException("Channel credential version changed");
      if (current) await tx.channelCredentialReference.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
      const value = await tx.channelCredentialReference.create({ data: { workspaceId, connectionId, name, version: expectedVersion + 1,
        encryptedSecret: this.crypto.encrypt(secret), fingerprint: this.crypto.fingerprint(secret), expiresAt, createdById: actorId } });
      await tx.auditLog.create({ data: { workspaceId, userId: actorId, action: "channel.credential.rotated", entityType: "ChannelConnection",
        entityId: connectionId, oldValues: Prisma.JsonNull, newValues: { name, version: value.version, fingerprint: value.fingerprint, expiresAt: expiresAt?.toISOString() } } });
      return { id: value.id, connectionId, name, fingerprint: value.fingerprint, version: value.version, ...(expiresAt ? { expiresAt } : {}) }; });
  }
}
