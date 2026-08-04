import type { AuthSession } from "./types";

const CHANNEL_NAME = "responix:auth";
const FALLBACK_KEY = "responix:auth:event";

export type AuthSyncEvent =
  | { type: "LOGOUT" }
  | { type: "SESSION_INVALIDATED" }
  | { type: "SESSION_UPDATED"; session: AuthSession };

export interface AuthSync {
  publish(event: AuthSyncEvent): void;
  close(): void;
}

export function createAuthSync(onEvent: (event: AuthSyncEvent) => void): AuthSync {
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
  if (channel) channel.onmessage = (event: MessageEvent<AuthSyncEvent>) => onEvent(event.data);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== FALLBACK_KEY || !event.newValue) return;
    const parsed = JSON.parse(event.newValue) as { type?: string };
    if (parsed.type === "LOGOUT") onEvent({ type: "LOGOUT" });
    if (parsed.type === "SESSION_INVALIDATED") onEvent({ type: "SESSION_INVALIDATED" });
  };
  window.addEventListener("storage", onStorage);

  return {
    publish(event) {
      channel?.postMessage(event);
      const fallbackType = event.type === "SESSION_UPDATED" ? "SESSION_INVALIDATED" : event.type;
      localStorage.setItem(
        FALLBACK_KEY,
        JSON.stringify({ type: fallbackType, nonce: crypto.randomUUID?.() ?? Date.now() })
      );
      localStorage.removeItem(FALLBACK_KEY);
    },
    close() {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    }
  };
}
