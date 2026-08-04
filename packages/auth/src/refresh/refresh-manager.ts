import { ApiError, NetworkError } from "@responix/api-client";
import { authApi } from "../auth-api";
import { setAccessSession } from "../session";
import type { AuthSession } from "../types";

export interface RefreshHandlers {
  onRefreshing?: () => void;
  onSuccess?: (session: AuthSession) => void;
  onInvalidated?: () => void;
  onRecoveryRequired?: (error: unknown) => void;
}

export class SilentRefreshManager {
  private inFlight: Promise<AuthSession> | null = null;
  private handlers: RefreshHandlers = {};

  setHandlers(handlers: RefreshHandlers): () => void {
    this.handlers = handlers;
    return () => {
      if (this.handlers === handlers) this.handlers = {};
    };
  }

  refresh(): Promise<AuthSession> {
    if (this.inFlight) return this.inFlight;
    this.handlers.onRefreshing?.();
    this.inFlight = authApi
      .refresh()
      .then((session) => {
        setAccessSession(session.accessToken, session.expiresIn);
        this.handlers.onSuccess?.(session);
        return session;
      })
      .catch((error: unknown) => {
        if (error instanceof NetworkError) this.handlers.onRecoveryRequired?.(error);
        else if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          this.handlers.onInvalidated?.();
        }
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  get refreshing(): boolean {
    return this.inFlight !== null;
  }

  reset(): void {
    this.inFlight = null;
    this.handlers = {};
  }
}

export const silentRefreshManager = new SilentRefreshManager();
