import { isAccessTokenExpiring } from "../session";

const CHECK_INTERVAL_MS = 30_000;

export class TokenExpirationDetector {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(onExpire: () => void): void {
    this.stop();
    this.timer = setInterval(() => {
      if (isAccessTokenExpiring()) onExpire();
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const tokenExpirationDetector = new TokenExpirationDetector();
