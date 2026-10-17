import { cookies } from "next/headers";
import { apiUrl } from "@/lib/server-auth";

const COOKIE = "oic_reviewer_session";
export async function reviewerToken(): Promise<string> {
  return (await cookies()).get(COOKIE)?.value ?? "";
}
export async function setReviewerToken(token: string, expiresAt: string): Promise<void> {
  const expires = new Date(expiresAt);
  const maxAge = Math.max(1, Math.min(8 * 60 * 60, Math.floor((expires.getTime() - Date.now()) / 1000)));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge });
}
export async function clearReviewerToken(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
export async function reviewerApi(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { ...init, headers: { ...(init.headers ?? {}), "X-OIC-Reviewer-Session": token, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
}
