import { NextResponse } from "next/server";
import { hasConsoleSession, sameOrigin } from "@/lib/server-auth";
import { reviewerApi, reviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!(await hasConsoleSession())) return NextResponse.json({ error: "Console access required." }, { status: 401 });
  const token = await reviewerToken();
  if (!token) return NextResponse.json({ error: "Reviewer sign-in required." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid adjudication." }, { status: 400 });
  const response = await reviewerApi("/api/v1/reviewer/adjudications", token, { method: "POST", body: JSON.stringify(body) });
  return NextResponse.json(await response.json().catch(() => ({})) as unknown, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
