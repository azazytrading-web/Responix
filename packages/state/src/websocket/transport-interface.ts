export interface RealtimeTransport {
  connect(url: string, options?: TransportOptions): void;
  disconnect(): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
  off(event: string, handler: (payload: unknown) => void): void;
  isConnected(): boolean;
  getState(): "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
}

export interface TransportOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  backoffMultiplier?: number;
  authToken?: string;
  heartbeatIntervalMs?: number;
}
