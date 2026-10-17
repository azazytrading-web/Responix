import { NextResponse } from "next/server";
import { apiUrl, hasConsoleSession, sameOrigin } from "@/lib/server-auth";
import { reviewerApi, reviewerToken } from "@/lib/reviewer-auth";

export const dynamic = "force-dynamic";
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ errorCode: "REQUEST_ORIGIN_INVALID" }, { status: 403 });
  if (!(await hasConsoleSession())) return NextResponse.json({ errorCode: "CONSOLE_SESSION_REQUIRED" }, { status: 401 });
  const token = await reviewerToken();
  if (!token) return NextResponse.json({ errorCode: "REVIEWER_SESSION_REQUIRED" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ errorCode: "CONFLICT_DECLARATION_INVALID" }, { status: 400 });
  const response = await reviewerApi("/api/v1/reviewer/conflict-attestations", token, { method: "POST", body: JSON.stringify(body) });
  const result: unknown = await response.json().catch((): unknown => ({ errorCode: "CONFLICT_DECLARATION_FAILED" }));
  if (!response.ok || !isRecord(result) || result.state !== "CLEARED") {
    return NextResponse.json(result, { status: response.status, headers: { "Cache-Control": "no-store" } });
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.protocolRevisionId !== "string") return NextResponse.json({ errorCode: "CONFLICT_DECLARATION_INVALID" }, { status: 400 });
  const scopesResponse = await reviewerApi("/api/v1/reviewer/conflict-scopes", token);
  const scopes: unknown = await scopesResponse.json().catch((): unknown => []);
  const fixtureVersions = new Set(["oic7-human-review-local-demo-v1", "oic7-human-review-local-demo-b2-v1"]);
  const fixture = Array.isArray(scopes) && scopes.filter(isRecord).find((scope) => scope.protocolRevisionId === payload.protocolRevisionId && typeof scope.protocolVersion === "string" && fixtureVersions.has(scope.protocolVersion));
  if (!fixture) return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });

  const meResponse = await reviewerApi("/api/v1/reviewer/auth/me", token);
  const me: unknown = await meResponse.json().catch((): unknown => ({}));
  const humanId = isRecord(me) && isRecord(me.human) ? me.human.id : undefined;
  const credential = process.env.OIC7_EVALUATION_RUNNER_CREDENTIAL;
  if (!meResponse.ok || typeof humanId !== "string" || !credential) return NextResponse.json({ errorCode: "FIXTURE_ASSIGNMENTS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  let assignmentsResponse: Response;
  try {
    assignmentsResponse = await fetch(apiUrl(`/api/v1/reviewer/admin/local-fixture/${encodeURIComponent(payload.protocolRevisionId)}/assignments`), {
      method: "POST",
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      body: JSON.stringify({ reviewerIds: [humanId] }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    return NextResponse.json({ errorCode: "FIXTURE_ASSIGNMENTS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const assignments: unknown = await assignmentsResponse.json().catch((): unknown => ({}));
  if (!assignmentsResponse.ok || !isRecord(assignments)) return NextResponse.json({ errorCode: "FIXTURE_ASSIGNMENTS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ...result, assignmentsPrepared: true, assignmentCount: assignments.assignmentCount }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
