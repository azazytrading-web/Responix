import { Injectable } from "@nestjs/common";

@Injectable()
export class ChannelRetryService {
  retryable(error: unknown): boolean {
    const status = this.status(error);
    return status === 408 || status === 429 || (status >= 500 && status <= 599) ||
      (error instanceof Error && /timeout|ECONNRESET|EAI_AGAIN|network/i.test(error.message));
  }
  delay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined) return Math.min(Math.max(retryAfterMs, 0), 60_000);
    return Math.min(500 * 2 ** Math.max(0, attempt - 1), 30_000);
  }
  private status(error: unknown): number {
    if (!error || typeof error !== "object") return 0;
    const value = error as { status?: number; statusCode?: number; response?: { status?: number } };
    return value.status ?? value.statusCode ?? value.response?.status ?? 0;
  }
}
