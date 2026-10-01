import { ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OicClientError } from "@oic/client";

@Injectable()
export class OicTenantProvisioningService {
  private readonly baseUrl?: string;
  private readonly credential?: string;
  private readonly runtimePrincipalId?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("oic.baseUrl");
    this.credential = config.get<string>("oic.provisioningCredential");
    this.runtimePrincipalId = config.get<string>("oic.runtimePrincipalId");
    this.timeoutMs = config.get<number>("oic.timeoutMs") ?? 60_000;
  }

  async provisionWorkspace(workspaceId: string) {
    if (!this.baseUrl || !this.credential) {
      throw new ServiceUnavailableException({ code: "OIC_PROVISIONING_UNAVAILABLE", message: "Workspace OIC provisioning is not configured." });
    }
    if (!this.runtimePrincipalId) {
      throw new ServiceUnavailableException({ code: "OIC_PROVISIONING_UNAVAILABLE", message: "Workspace OIC provisioning is not configured." });
    }
    const key = `responix-workspace:${workspaceId}`;
    try {
      const applicationResponse = await this.client("/api/v1/admin/applications/by-key/RESPONIX", { method: "GET" });
      const application = applicationResponse as { id: string };
      let tenant: { id: string };
      try {
        tenant = await this.client(`/api/v1/admin/applications/${application.id}/tenants/by-external-reference/RESPONIX_WORKSPACE/${encodeURIComponent(workspaceId)}`, { method: "GET" }) as { id: string };
      } catch (error) {
        if (!(error instanceof OicClientError) || error.status !== 404) throw error;
        try {
          const created = await this.client(`/api/v1/admin/applications/${application.id}/tenants`, {
            method: "POST", headers: { "idempotency-key": key },
            body: { key: `ws-${workspaceId.replace(/-/g, "").slice(0, 48)}`, displayName: `Responix workspace ${workspaceId}` }
          }) as { value?: { id: string }; id?: string };
          const resolvedTenant = created.value ?? (created.id ? { id: created.id } : undefined);
          if (!resolvedTenant) throw new OicClientError(502, "INVALID_RESPONSE", "OIC returned an invalid tenant response");
          tenant = resolvedTenant;
        } catch (createError) {
          if (!(createError instanceof OicClientError) || createError.code !== "CONFLICT") throw createError;
          tenant = await this.client(`/api/v1/admin/applications/${application.id}/tenants/by-external-reference/RESPONIX_WORKSPACE/${encodeURIComponent(workspaceId)}`, { method: "GET" }) as { id: string };
        }
        try {
          await this.client(`/api/v1/admin/applications/${application.id}/tenants/${tenant.id}/external-references`, {
            method: "POST", headers: { "idempotency-key": `${key}:reference` },
            body: { sourceType: "RESPONIX_WORKSPACE", externalId: workspaceId }
          });
        } catch (referenceError) {
          if (!(referenceError instanceof OicClientError) || referenceError.code !== "CONFLICT") throw referenceError;
          throw new ConflictException({ code: "OIC_WORKSPACE_MAPPING_CONFLICT", message: "Workspace OIC mapping conflicts with an existing mapping." });
        }
      }
      await this.client(`/api/v1/admin/applications/${application.id}/service-principals/${this.runtimePrincipalId}/tenants/${tenant.id}/grant`, {
        method: "POST", headers: { "idempotency-key": `${key}:runtime-grant` }
      });
      return { tenantId: tenant.id, sourceType: "RESPONIX_WORKSPACE", workspaceId };
    } catch (error) {
      if (error instanceof OicClientError && (error.status >= 500 || error.status === 408 || error.status === 429)) {
        throw new ServiceUnavailableException({ code: "OIC_PROVISIONING_UNAVAILABLE", message: "Workspace OIC provisioning is temporarily unavailable." });
      }
      if (!(error instanceof ConflictException) && !(error instanceof OicClientError)) {
        throw new ServiceUnavailableException({ code: "OIC_PROVISIONING_UNAVAILABLE", message: "Workspace OIC provisioning is temporarily unavailable." });
      }
      throw error;
    }
  }

  private async client(path: string, init: { method: string; headers?: Record<string, string>; body?: unknown }): Promise<unknown> {
    const credential = this.credential;
    const target = new URL(path, this.baseUrl);
    const headers = new Headers({ authorization: `Bearer ${credential}`, accept: "application/json", "content-type": "application/json", ...(init.headers ?? {}) });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(target, { method: init.method, headers, body: init.body ? JSON.stringify(init.body) : undefined, signal: controller.signal });
        if (!response.ok) {
          let error: { error?: { code?: string; message?: string } } = {};
          try { error = await response.json() as { error?: { code?: string; message?: string } }; } catch { /* normalized below */ }
          throw new OicClientError(response.status, error.error?.code ?? `HTTP_${response.status}`, error.error?.message ?? "OIC administration request failed");
        }
      return await response.json() as unknown;
    } finally { clearTimeout(timer); }
  }
}
