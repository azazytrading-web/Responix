import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "oic_console_session";
const SESSION_SECONDS = 8 * 60 * 60;

function signingKey(): string {
  const value = process.env.OIC_CONSOLE_SESSION_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new Error("Console session signing key is not configured");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function consoleConfigurationReady(): boolean {
  return (
    !!process.env.OIC_CONSOLE_OPERATOR_PASSWORD &&
    !!process.env.OIC_CONSOLE_API_CREDENTIAL &&
    !!process.env.OIC_CONSOLE_RUNTIME_CREDENTIAL &&
    !!process.env.OIC_CONSOLE_RUNTIME_PRINCIPAL_ID &&
    !!process.env.OIC_CONSOLE_SESSION_SECRET &&
    Buffer.byteLength(process.env.OIC_CONSOLE_SESSION_SECRET) >= 32
  );
}

export function verifyOperatorPassword(candidate: string): boolean {
  const expected = process.env.OIC_CONSOLE_OPERATOR_PASSWORD;
  if (!expected || Buffer.byteLength(candidate) > 1024) return false;
  const actualBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function createConsoleSession(): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${randomBytes(24).toString("base64url")}.${expires}`;
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS
  });
}

export async function destroyConsoleSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function hasConsoleSession(): Promise<boolean> {
  try {
    const store = await cookies();
    const value = store.get(COOKIE)?.value;
    if (!value) return false;
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}.${parts[1]}`;
    const expiry = Number(parts[1]);
    if (!Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;
    const actual = Buffer.from(parts[2] ?? "");
    const expected = Buffer.from(sign(payload));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function apiUrl(path: string): URL {
  const raw = process.env.OIC_API_URL ?? "http://127.0.0.1:4100";
  const base = new URL(raw);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("OIC API URL configuration is invalid");
  }
  return new URL(path, base);
}

export function controlPlaneCredential(): string {
  const credential = process.env.OIC_CONSOLE_API_CREDENTIAL;
  if (!credential) throw new Error("Console API credential is not configured");
  return credential;
}

export function runtimeCredential(): string {
  const credential = process.env.OIC_CONSOLE_RUNTIME_CREDENTIAL;
  if (!credential) throw new Error("Console runtime credential is not configured");
  return credential;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
