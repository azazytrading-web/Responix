import { NextResponse } from "next/server";
import { apiUrl, controlPlaneCredential, hasConsoleSession, runtimeCredential } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await hasConsoleSession()))
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  const view = new URL(request.url).searchParams.get("view");
  const profileId = new URL(request.url).searchParams.get("profileId");
  const runtimeTenantId = new URL(request.url).searchParams.get("tenantId");
  if (view === "runtime-models") {
    if (runtimeTenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runtimeTenantId))
      return NextResponse.json({ error: "Invalid runtime scope." }, { status: 400 });
    const query = runtimeTenantId ? `?tenant_id=${encodeURIComponent(runtimeTenantId)}` : "";
    try {
      const response = await fetch(apiUrl(`/v1/models${query}`), {
        headers: { Authorization: `Bearer ${runtimeCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Runtime model discovery is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "health") {
    const readHealth = async (path: "/api/v1/health/live" | "/api/v1/health/ready") => {
      const observedAt = new Date().toISOString();
      try {
        const response = await fetch(apiUrl(path), { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const body: unknown = await response.json().catch(() => null);
        return { sourceState: "AVAILABLE", endpoint: path, httpStatus: response.status, observedAt, body };
      } catch {
        return { sourceState: "UNAVAILABLE", endpoint: path, httpStatus: null, observedAt, body: null };
      }
    };
    const [live, ready] = await Promise.all([readHealth("/api/v1/health/live"), readHealth("/api/v1/health/ready")]);
    return NextResponse.json({ live, ready }, { headers: { "Cache-Control": "no-store" } });
  }
  if (view === "audit") {
    const applicationId = new URL(request.url).searchParams.get("applicationId");
    if (applicationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId))
      return NextResponse.json({ error: "Invalid audit scope." }, { status: 400 });
    const query = new URLSearchParams({ limit: "100", ...(applicationId ? { applicationId } : {}) });
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/audit?${query.toString()}`), {
        headers: { Authorization: `Bearer ${controlPlaneCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      const events = Array.isArray(body) ? body.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const source = item as Record<string, unknown>;
        const projected: Record<string, string | number> = {};
        for (const key of ["id", "actorPrincipalId", "applicationId", "tenantId", "action", "targetType", "targetId", "requestId", "traceId", "occurredAt"]) {
          const value = source[key];
          if (typeof value === "string" || typeof value === "number") projected[key] = value;
        }
        return [projected];
      }) : body;
      return NextResponse.json(events, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Audit source is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  const path = view === "snapshot" ? "/api/v1/admin/console/snapshot" : view === "profiles" ? "/api/v1/admin/intelligence/profiles" : view === "profile-detail" && profileId && /^[0-9a-f-]{36}$/i.test(profileId) ? `/api/v1/admin/intelligence/profiles/${profileId}` : view === "engines" ? "/api/v1/admin/intelligence/engines" : null;
  const params = new URL(request.url).searchParams;
  const resource = view === "memory" ? "memory" : view === "knowledge" ? "knowledge" : view === "executions" || view === "traces" ? "executions" : null;
  const safeQuery = (name: string, max: number) => { const value = params.get(name); return value && value.length <= max ? value : null; };
  const tenantId = safeQuery("tenantId", 36); const q = safeQuery("q", 120); const lifecycle = safeQuery("lifecycle", 16); const kind = safeQuery("kind", 32);
  const listPath = resource ? `/api/v1/admin/intelligence/${resource}${resource === "executions" ? "?limit=50" : `?${new URLSearchParams({ ...(tenantId ? { tenantId } : {}), ...(q ? { q } : {}), ...(lifecycle ? { lifecycle } : {}), ...(kind && resource === "memory" ? { kind } : {}) }).toString()}`}` : null;
  const traceId = new URL(request.url).searchParams.get("traceId");
  const executionPath = (view === "executions" || view === "traces") && traceId && /^[A-Za-z0-9._:-]{1,128}$/.test(traceId) ? `/api/v1/admin/intelligence/executions/${encodeURIComponent(traceId)}` : null;
  const itemPath = resource === "memory" && params.get("id") && /^[0-9a-f-]{36}$/i.test(params.get("id")!) ? `/api/v1/admin/intelligence/memory/${params.get("id")}` : null;
  const knowledgeItemPath = resource === "knowledge" && params.get("id") && /^[0-9a-f-]{36}$/i.test(params.get("id")!) ? `/api/v1/admin/intelligence/knowledge/${params.get("id")}` : null;
  const resolvedPath = path ?? executionPath ?? itemPath ?? knowledgeItemPath ?? listPath;
  if (!resolvedPath) return NextResponse.json({ error: "Unknown console view." }, { status: 404 });
  try {
    const headers: HeadersInit = { Authorization: `Bearer ${controlPlaneCredential()}` };
    const response = await fetch(apiUrl(resolvedPath), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    let body: unknown = await response
      .json()
      .catch(() => ({ error: "OIC API returned an unreadable response." }));
    if (view === "snapshot" && body && typeof body === "object" && !Array.isArray(body)) {
      const snapshot = body as Record<string, unknown>;
      const principals = Array.isArray(snapshot.principals) ? snapshot.principals : [];
      const applications = Array.isArray(snapshot.applications) ? snapshot.applications : [];
      const tenants = Array.isArray(snapshot.tenants) ? snapshot.tenants : [];
      const runtimePrincipalId = process.env.OIC_CONSOLE_RUNTIME_PRINCIPAL_ID;
      const principal = principals.find(
        (item) => !!item && typeof item === "object" && (item as Record<string, unknown>).id === runtimePrincipalId
      ) as Record<string, unknown> | undefined;
      const applicationId = principal?.applicationId;
      const application = applications.find(
        (item) => !!item && typeof item === "object" && (item as Record<string, unknown>).id === applicationId
      ) as Record<string, unknown> | undefined;
      const grants = Array.isArray(principal?.tenantGrants) ? principal.tenantGrants : [];
      const tenantIds = grants.map((grant) => grant && typeof grant === "object" ? (grant as Record<string, unknown>).tenantId : null);
      body = {
        ...snapshot,
        runtimeContext: principal && application
          ? {
              application: { id: application.id, key: application.key, displayName: application.displayName },
              tenants: tenants.filter((item) => !!item && typeof item === "object" && tenantIds.includes((item as Record<string, unknown>).id) && (item as Record<string, unknown>).applicationId === applicationId)
            }
          : null
      };
    }
    return NextResponse.json(body, {
      status: response.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "OIC API is unavailable or the console connection is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
