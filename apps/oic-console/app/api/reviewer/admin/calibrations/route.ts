import { NextResponse } from "next/server";
import { apiUrl, controlPlaneCredential, hasConsoleSession } from "@/lib/server-auth";
import { reviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await hasConsoleSession())) return NextResponse.json({ errorCode: "CONSOLE_SESSION_REQUIRED" }, { status: 401 });
  // Administrative evidence must not be exposed inside an individual reviewer session.
  if (await reviewerToken()) return NextResponse.json({ errorCode: "REVIEWER_SESSION_ACTIVE" }, { status: 403 });
  const applicationId = new URL(request.url).searchParams.get("applicationId");
  if (!applicationId || !/^[0-9a-f-]{36}$/i.test(applicationId)) return NextResponse.json({ errorCode: "REVIEWER_APPLICATION_INVALID" }, { status: 400 });
  try {
    const response = await fetch(apiUrl(`/api/v1/reviewer/admin/calibrations?applicationId=${encodeURIComponent(applicationId)}`), { headers: { Authorization: `Bearer ${controlPlaneCredential()}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return NextResponse.json({ errorCode: response.status === 403 ? "REVIEWER_ADMIN_FORBIDDEN" : "REVIEWER_READBACK_FAILED" }, { status: response.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorCode: "REVIEWER_API_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
