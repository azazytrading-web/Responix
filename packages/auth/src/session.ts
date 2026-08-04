let accessToken: string | null = null;
let expiresAt: number | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessSession(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function clearAccessSession(): void {
  accessToken = null;
  expiresAt = null;
}

export function isAccessTokenExpiring(bufferMs = 60_000): boolean {
  return accessToken === null || expiresAt === null || Date.now() >= expiresAt - bufferMs;
}
