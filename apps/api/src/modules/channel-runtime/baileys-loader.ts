export type BaileysSocket = {
  ev: { on(event: string, listener: (value: any) => void): void };
  sendMessage(jid: string, payload: { text: string }): Promise<{ key?: { id?: string } }>;
  end(error?: Error): void;
  logout(): Promise<void>;
};

export type BaileysModule = {
  default: (options: Record<string, unknown>) => BaileysSocket;
  useMultiFileAuthState(path: string): Promise<{ state: unknown; saveCreds: () => Promise<void> }>;
  fetchLatestBaileysVersion(): Promise<{ version: readonly number[] }>;
  DisconnectReason: { loggedOut: number };
};

export function loadBaileys(): Promise<BaileysModule> {
  return Function("specifier", "return import(specifier)")(
    "@whiskeysockets/baileys"
  ) as Promise<BaileysModule>;
}
