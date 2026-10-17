import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUrl, controlPlaneCredential, hasConsoleSession, sameOrigin } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!(await hasConsoleSession())) return NextResponse.json({ error: "Console access required." }, { status: 401 });
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid credential reset." }, { status: 400 });
  try {
    const response = await fetch(apiUrl(`/api/v1/reviewer/admin/identities/${encodeURIComponent(id)}/reset-credential`), { method: "POST", headers: { Authorization: `Bearer ${controlPlaneCredential()}`, "Content-Type": "application/json", "Idempotency-Key": randomUUID(), "X-Request-Id": randomUUID() }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    return NextResponse.json(await response.json().catch(() => ({})) as unknown, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Reviewer credential administration is unavailable." }, { status: 503 });
  }
}
