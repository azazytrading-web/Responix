import type { RealtimeTransport, TransportOptions } from "./transport-interface";

export class SseTransport implements RealtimeTransport {
  private eventSource: EventSource | null = null;
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private reconnectAttempts = 0;
  private state: ReturnType<RealtimeTransport["getState"]> = "idle";
  private url: string | null = null;
  private options: TransportOptions = {};

  connect(url: string, options: TransportOptions = {}) {
    this.url = url;
    this.options = options;
    this.eventSource = new EventSource(url, { withCredentials: true });
    this.state = "connecting";

    this.eventSource.onopen = () => {
      this.state = "connected";
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const message: { type?: string; payload?: unknown } = JSON.parse(event.data as string);
        if (message.type) {
          this.handlers.get(message.type)?.forEach((h) => h(message.payload));
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.eventSource.onerror = () => {
      this.state = "disconnected";
      if (options.reconnect !== false) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    const maxAttempts = this.options.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) return;

    this.state = "reconnecting";
    const delay =
      (this.options.reconnectDelayMs ?? 1000) *
      Math.pow(this.options.backoffMultiplier ?? 2, this.reconnectAttempts);

    setTimeout(() => {
      this.reconnectAttempts++;
      if (this.url) {
        this.connect(this.url, this.options);
      }
    }, Math.min(delay, 30000));
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
    this.state = "disconnected";
    this.handlers.clear();
  }

  on(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: (payload: unknown) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  getState(): "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" {
    return this.state;
  }
}
