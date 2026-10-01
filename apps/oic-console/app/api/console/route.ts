import { NextResponse } from "next/server";
import { apiUrl, controlPlaneCredential, hasConsoleSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await hasConsoleSession()))
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  const view = new URL(request.url).searchParams.get("view");
  const healthPath = view === "health" ? "/api/v1/health/ready" : null;
  const path = healthPath ?? (view === "snapshot" ? "/api/v1/admin/console/snapshot" : null);
  if (!path) return NextResponse.json({ error: "Unknown console view." }, { status: 404 });
  try {
    const headers: HeadersInit = healthPath
      ? {}
      : { Authorization: `Bearer ${controlPlaneCredential()}` };
    const response = await fetch(apiUrl(path), {
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
