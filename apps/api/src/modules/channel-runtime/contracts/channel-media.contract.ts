export interface ChannelMediaUpload {
  content: Buffer;
  mimeType: string;
  fileName?: string;
  checksum: string;
}

export interface ChannelTemporaryStorage {
  put(workspaceId: string, media: ChannelMediaUpload, expiresAt: Date): Promise<string>;
  get(workspaceId: string, reference: string): Promise<Buffer>;
  remove(workspaceId: string, reference: string): Promise<void>;
}

export interface ChannelVirusScanHook {
  scan(input: ChannelMediaUpload): Promise<{ safe: boolean; scanner?: string; metadata?: Readonly<Record<string, unknown>> }>;
}
