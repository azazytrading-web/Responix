import { NextResponse } from "next/server";
import { hasConsoleSession } from "@/lib/server-auth";
import { reviewerApi, reviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await hasConsoleSession())) return NextResponse.json({ errorCode: "CONSOLE_SESSION_REQUIRED" }, { status: 401 });
  const token = await reviewerToken();
  if (!token) return NextResponse.json({ errorCode: "REVIEWER_SESSION_REQUIRED" }, { status: 401 });
  const response = await reviewerApi("/api/v1/reviewer/conflict-scopes", token);
  return NextResponse.json(await response.json().catch(() => ({ errorCode: "CONFLICT_READ_FAILED" })), { status: response.status, headers: { "Cache-Control": "no-store" } });
}
