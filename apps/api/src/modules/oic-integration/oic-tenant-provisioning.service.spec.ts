import type { ConfigService } from "@nestjs/config";
import { OicTenantProvisioningService } from "./oic-tenant-provisioning.service";

describe("OicTenantProvisioningService", () => {
  const setup = () => {
    const values: Record<string, unknown> = { "oic.baseUrl": "http://oic.internal", "oic.provisioningCredential": "provision-secret", "oic.runtimePrincipalId": "runtime-principal-id", "oic.timeoutMs": 1000 };
    const config = { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
    return { service: new OicTenantProvisioningService(config), values };
  };
  afterEach(() => jest.restoreAllMocks());

  it("uses a separate provisioning principal and resolves the canonical workspace tenant", async () => {
    const fetch = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "application-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "tenant-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const { service } = setup();
    await expect(service.provisionWorkspace("workspace-uuid")).resolves.toEqual({ tenantId: "tenant-id", sourceType: "RESPONIX_WORKSPACE", workspaceId: "workspace-uuid" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("authorization")).toBe("Bearer provision-secret");
    expect(fetch.mock.calls[1]![0]).toBeInstanceOf(URL);
    expect((fetch.mock.calls[1]![0] as URL).pathname).toContain("by-external-reference/RESPONIX_WORKSPACE/workspace-uuid");
    expect(fetch.mock.calls[2]![0]).toBeInstanceOf(URL);
    expect((fetch.mock.calls[2]![0] as URL).pathname).toContain("service-principals/runtime-principal-id/tenants/tenant-id/grant");
  });

  it("creates the tenant and mapping idempotently when no mapping exists", async () => {
    const fetch = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "application-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: { id: "tenant-id" }, replayed: false }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: { id: "reference-id" }, replayed: false }), { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(setup().service.provisionWorkspace("workspace-uuid")).resolves.toMatchObject({ tenantId: "tenant-id" });
    expect(new Headers(fetch.mock.calls[2]![1]?.headers).get("idempotency-key")).toContain("responix-workspace:workspace-uuid");
    expect(new Headers(fetch.mock.calls[3]![1]?.headers).get("idempotency-key")).toContain(":reference");
  });

  it("normalizes network and upstream availability errors and never returns secret details", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection failed"));
    const failure = await setup().service.provisionWorkspace("workspace-uuid").catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 503, response: { code: "OIC_PROVISIONING_UNAVAILABLE" } });
    expect(JSON.stringify(failure)).not.toContain("provision-secret");
  });

  it("maps a conflicting external workspace mapping to a safe conflict", async () => {
    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "application-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "tenant-id" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "CONFLICT" } }), { status: 409 }));
    const failure = await setup().service.provisionWorkspace("workspace-uuid").catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 409, response: { code: "OIC_WORKSPACE_MAPPING_CONFLICT" } });
  });
});
