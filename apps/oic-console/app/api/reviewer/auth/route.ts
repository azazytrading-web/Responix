import { NextResponse } from "next/server";
import { apiUrl, hasConsoleSession, sameOrigin } from "@/lib/server-auth";
import { clearReviewerToken, reviewerApi, reviewerToken, setReviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await hasConsoleSession())) return NextResponse.json({ error: "Console access required." }, { status: 401 });
  const token = await reviewerToken();
  if (!token) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  const response = await reviewerApi("/api/v1/reviewer/auth/me", token);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) await clearReviewerToken();
  return NextResponse.json(response.ok ? { authenticated: true, ...result } : { authenticated: false }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!(await hasConsoleSession())) return NextResponse.json({ error: "Console access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.loginHandle !== "string" || typeof body.password !== "string" || typeof body.applicationId !== "string") return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  try {
    const response = await fetch(apiUrl("/api/v1/reviewer/auth/login"), { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof result.token !== "string" || typeof result.expiresAt !== "string") return NextResponse.json({ error: "Reviewer access could not be verified." }, { status: 401 });
    await setReviewerToken(result.token, result.expiresAt);
    return NextResponse.json({ authenticated: true, human: result.human, applicationId: result.applicationId, expiresAt: result.expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Reviewer authentication is unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (await hasConsoleSession()) {
    const token = await reviewerToken();
    if (token) await reviewerApi("/api/v1/reviewer/auth/session", token, { method: "DELETE" }).catch(() => undefined);
  }
  await clearReviewerToken();
  return NextResponse.json({ authenticated: false });
}
