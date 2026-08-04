/**
 * Notification Transport Interface
 */

import type { NotificationDto } from "./types";

export interface NotificationTransport {
  connect(): void;
  disconnect(): void;
  onMessage(callback: (notification: NotificationDto) => void): void;
  onError(callback: (error: Error) => void): void;
}

export class SseNotificationTransport implements NotificationTransport {
  private eventSource: EventSource | null = null;
  private messageCallback: ((notification: NotificationDto) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor(private endpoint: string) {}

  connect(): void {
    if (this.eventSource) return;
    this.eventSource = new EventSource(this.endpoint);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as NotificationDto;
        this.messageCallback?.(data);
      } catch (err) {
        this.errorCallback?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    this.eventSource.onerror = () => {
      this.errorCallback?.(new Error("SSE connection error"));
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  onMessage(callback: (notification: NotificationDto) => void): void {
    this.messageCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }
}

export class WebSocketNotificationTransport implements NotificationTransport {
  private socket: WebSocket | null = null;
  private messageCallback: ((notification: NotificationDto) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor(private url: string) {}

  connect(): void {
    if (this.socket) return;
    this.socket = new WebSocket(this.url);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as NotificationDto;
        this.messageCallback?.(data);
      } catch (err) {
        this.errorCallback?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    this.socket.onerror = () => {
      this.errorCallback?.(new Error("WebSocket error"));
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  onMessage(callback: (notification: NotificationDto) => void): void {
    this.messageCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }
}
