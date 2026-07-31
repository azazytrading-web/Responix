export interface ChannelCredentialAccessor {
  get(name: string): string;
  has(name: string): boolean;
  fingerprint(name: string): string | undefined;
  names(): readonly string[];
}

export interface ChannelCredentialReference {
  id: string;
  connectionId: string;
  name: string;
  fingerprint: string;
  version: number;
  expiresAt?: Date;
}

export interface ChannelCredentialStore {
  resolve(workspaceId: string, connectionId: string): Promise<ChannelCredentialAccessor>;
  rotate(workspaceId: string, actorId: string, connectionId: string, name: string, secret: string,
    expectedVersion: number, expiresAt?: Date): Promise<ChannelCredentialReference>;
}

