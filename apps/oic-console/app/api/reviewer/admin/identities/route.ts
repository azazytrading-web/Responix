import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUrl, controlPlaneCredential, hasConsoleSession, sameOrigin } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function errorForStatus(status: number): string {
  if (status === 400) return "REVIEWER_SETUP_INVALID";
  if (status === 401) return "OIC_CREDENTIAL_INVALID";
  if (status === 403) return "REVIEWER_ADMIN_FORBIDDEN";
  if (status === 404) return "REVIEWER_ADMIN_ROUTE_NOT_FOUND";
  if (status === 409) return "REVIEWER_LOGIN_HANDLE_EXISTS";
  if (status === 429) return "REVIEWER_ADMIN_RATE_LIMITED";
  if (status >= 500) return "REVIEWER_API_FAILURE";
  return "REVIEWER_ADMIN_REQUEST_FAILED";
}

function safeApiFailure(status: number) {
  return NextResponse.json({ errorCode: errorForStatus(status) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!(await hasConsoleSession())) return NextResponse.json({ errorCode: "CONSOLE_SESSION_REQUIRED" }, { status: 401 });
  const applicationId = new URL(request.url).searchParams.get("applicationId");
  if (!applicationId || !/^[0-9a-f-]{36}$/i.test(applicationId)) return NextResponse.json({ errorCode: "REVIEWER_APPLICATION_INVALID" }, { status: 400 });
  try {
    const response = await fetch(apiUrl(`/api/v1/reviewer/admin/identities?applicationId=${encodeURIComponent(applicationId)}`), { headers: { Authorization: `Bearer ${controlPlaneCredential()}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return safeApiFailure(response.status);
    const result = await response.json().catch(() => ({})) as unknown;
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorCode: "REVIEWER_API_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ errorCode: "REQUEST_ORIGIN_INVALID" }, { status: 403 });
  if (!(await hasConsoleSession())) return NextResponse.json({ errorCode: "CONSOLE_SESSION_REQUIRED" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ errorCode: "REVIEWER_SETUP_INVALID" }, { status: 400 });
  try {
    const response = await fetch(apiUrl("/api/v1/reviewer/admin/identities"), { method: "POST", headers: { Authorization: `Bearer ${controlPlaneCredential()}`, "Content-Type": "application/json", "Idempotency-Key": randomUUID(), "X-Request-Id": randomUUID() }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return safeApiFailure(response.status);
    const result = await response.json().catch(() => ({})) as unknown;
    return NextResponse.json(result, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorCode: "REVIEWER_API_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
