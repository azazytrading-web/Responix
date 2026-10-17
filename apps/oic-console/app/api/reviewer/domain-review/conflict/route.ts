import { NextResponse } from "next/server";
import { hasConsoleSession } from "@/lib/server-auth";
import { reviewerApi, reviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";
async function session() {
  if (!(await hasConsoleSession())) return { error: NextResponse.json({ error: "Console access required." }, { status: 401 }) };
  const token = await reviewerToken();
  if (!token) return { error: NextResponse.json({ error: "Reviewer sign-in required." }, { status: 401 }) };
  return { token };
}
export async function GET() {
  const auth = await session();
  if ("error" in auth) return auth.error;
  const response = await reviewerApi("/api/v1/reviewer/domain-review/conflict", auth.token);
  return NextResponse.json(await response.json().catch(() => ({})) as unknown, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const auth = await session();
  if ("error" in auth) return auth.error;
  const body: unknown = await request.json().catch(() => ({}));
  const response = await reviewerApi("/api/v1/reviewer/domain-review/conflict", auth.token, { method: "POST", body: JSON.stringify(body) });
  return NextResponse.json(await response.json().catch(() => ({})) as unknown, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
