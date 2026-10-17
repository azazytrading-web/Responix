import { NextResponse } from "next/server";
import { hasConsoleSession, sameOrigin } from "@/lib/server-auth";
import { reviewerApi, reviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";
function safeFailureCode(status: number): string {
  if (status === 400) return "CALIBRATION_SUBMISSION_INVALID";
  if (status === 401) return "REVIEWER_SESSION_EXPIRED";
  if (status === 403) return "CALIBRATION_NOT_AUTHORIZED";
  if (status === 404) return "CALIBRATION_POLICY_UNAVAILABLE";
  if (status === 409) return "CALIBRATION_ALREADY_SUBMITTED";
  if (status === 429) return "REVIEWER_RATE_LIMITED";
  if (status >= 500) return "INTERNAL_REVIEW_ERROR";
  return "CALIBRATION_REQUEST_FAILED";
}
function safeFailure(status: number) {
  return NextResponse.json({ errorCode: safeFailureCode(status) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  if (!(await hasConsoleSession())) return NextResponse.json({ error: "Console access required." }, { status: 401 });
  const token = await reviewerToken();
  if (!token) return NextResponse.json({ errorCode: "REVIEWER_SESSION_EXPIRED" }, { status: 401 });
  try {
    const response = await reviewerApi("/api/v1/reviewer/calibrations", token);
    if (!response.ok) return safeFailure(response.status);
    return NextResponse.json(await response.json().catch(() => ({})) as unknown, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorCode: "API_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ errorCode: "REQUEST_ORIGIN_INVALID" }, { status: 403 });
  if (!(await hasConsoleSession())) return NextResponse.json({ errorCode: "CONSOLE_SESSION_REQUIRED" }, { status: 401 });
  const token = await reviewerToken();
  if (!token) return NextResponse.json({ errorCode: "REVIEWER_SESSION_EXPIRED" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ errorCode: "CALIBRATION_SUBMISSION_INVALID" }, { status: 400 });
  try {
    const response = await reviewerApi("/api/v1/reviewer/calibrations", token, { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) return safeFailure(response.status);
    return NextResponse.json(await response.json().catch(() => ({})) as unknown, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorCode: "API_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
