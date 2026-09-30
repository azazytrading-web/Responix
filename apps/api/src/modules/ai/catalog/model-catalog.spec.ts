import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import type { ModelCapabilityState, ModelEvidenceSource } from "@prisma/client";
import { PermissionsGuard } from "../../auth/auth.guard";
import { ModelCatalogController } from "./model-catalog.controller";
import { CreateCustomModelDto, ModelCatalogQueryDto, UpdateCustomModelDto } from "./model-catalog.dto";
import { ModelCatalogRepository } from "./model-catalog.repository";
import type { CatalogRecord } from "./model-catalog.repository";
import { ModelCatalogService } from "./model-catalog.service";
import { effectiveCapability, validatePrice } from "./model-catalog.semantics";
import type { ModelPriceInputDto } from "./model-catalog.dto";

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const base = { displayName: "Example", providerModelId: "Vendor/Exact-Model", providerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const price: ModelPriceInputDto = { state: "KNOWN", source: "WORKSPACE_DECLARED", inputRate: "1.25", outputRate: "2", currency: "USD", unit: "PER_MILLION_TOKENS", effectiveFrom: "2026-01-01T00:00:00Z" };
const validate = (value: unknown, metatype = CreateCustomModelDto) => pipe.transform(value, { type: "body", metatype });
const evidence = (state: ModelCapabilityState, source: ModelEvidenceSource = "PLATFORM_CURATED") => ({ key: "TOOLS" as const, state, source, observedAt: new Date() });

describe("MOD-2 capability evidence", () => {
  it("defaults to UNKNOWN", () => expect(effectiveCapability("TOOLS", [])).toBe("UNKNOWN"));
  it("accepts trusted support", () => expect(effectiveCapability("TOOLS", [evidence("SUPPORTED")])).toBe("SUPPORTED"));
  it("preserves explicit unsupported", () => expect(effectiveCapability("TOOLS", [evidence("UNSUPPORTED")])).toBe("UNSUPPORTED"));
  it("does not elevate workspace positive declarations", () => expect(effectiveCapability("TOOLS", [evidence("SUPPORTED", "WORKSPACE_DECLARED")])).toBe("UNKNOWN"));
  it("workspace can restrict trusted support", () => expect(effectiveCapability("TOOLS", [evidence("SUPPORTED"), evidence("UNSUPPORTED", "WORKSPACE_DECLARED")])).toBe("UNSUPPORTED"));
  it("workspace UNKNOWN can restrict support", () => expect(effectiveCapability("TOOLS", [evidence("SUPPORTED"), evidence("UNKNOWN", "WORKSPACE_DECLARED")])).toBe("UNKNOWN"));
  it("positive workspace cannot override trusted negative", () => expect(effectiveCapability("TOOLS", [evidence("UNSUPPORTED"), evidence("SUPPORTED", "WORKSPACE_DECLARED")])).toBe("UNSUPPORTED"));
  it("conflicting trusted evidence resolves conservatively", () => expect(effectiveCapability("TOOLS", [evidence("SUPPORTED"), evidence("UNSUPPORTED", "MODEL_VALIDATION")])).toBe("UNSUPPORTED"));
  it("keeps MCP outside execution capabilities", () => expect(effectiveCapability("MCP", [{ ...evidence("SUPPORTED"), key: "MCP" }])).toBe("UNKNOWN"));
});

describe("MOD-2 DTO and pricing safety", () => {
  it("retains exact opaque model IDs", async () => expect(await validate(base)).toEqual(base));
  it.each(["workspaceId", "ownerWorkspaceId", "endpoint", "baseUrl", "protocol", "credential", "headers", "productionEligible", "source"])("rejects %s injection", async key => {
    await expect(validate({ ...base, [key]: "injected" })).rejects.toThrow();
  });
  it.each(["", " ", "line\nmodel", "bad\u007fmodel", "bad\u0085model", "x".repeat(201)])("rejects invalid ID %j", async providerModelId => {
    await expect(validate({ ...base, providerModelId })).rejects.toThrow();
  });
  it.each(["providerId", "customProviderId", "providerModelId", "ownerWorkspaceId"])("rejects identity update %s", async key => {
    await expect(pipe.transform({ [key]: base.providerId }, { type: "body", metatype: UpdateCustomModelDto })).rejects.toThrow();
  });
  it("rejects null metadata updates", async () => {
    await expect(pipe.transform({ displayName: null }, { type: "body", metatype: UpdateCustomModelDto })).rejects.toThrow();
  });
  it("rejects arbitrary capability keys and provenance forgery", async () => {
    await expect(validate({ ...base, capabilities: [{ key: "EXECUTE_URL", state: "SUPPORTED" }] })).rejects.toThrow();
    await expect(validate({ ...base, capabilities: [{ key: "TOOLS", state: "SUPPORTED", source: "PLATFORM_CURATED" }] })).rejects.toThrow();
    await expect(validate({ ...base, capabilities: [{ key: "MCP", state: "SUPPORTED" }] })).rejects.toThrow();
  });
  it("rejects duplicate capabilities, invalid categories and JSON metadata", async () => {
    await expect(validate({ ...base, capabilities: [{ key: "TOOLS", state: "UNKNOWN" }, { key: "TOOLS", state: "SUPPORTED" }] })).rejects.toThrow();
    await expect(validate({ ...base, categories: ["arbitrary"] })).rejects.toThrow();
    await expect(validate({ ...base, capabilities: { TOOLS: true } })).rejects.toThrow();
  });
  it("allows KNOWN nonzero and explicitly declared zero", async () => {
    for (const inputRate of ["1.25", "0"]) {
      const pricing: ModelPriceInputDto = { ...price, inputRate, outputRate: inputRate };
      await expect(validate({ ...base, pricing })).resolves.toBeDefined();
      expect(() => validatePrice(pricing)).not.toThrow();
    }
  });
  it("accepts UNKNOWN with no rates", () => expect(() => validatePrice({ ...price, state: "UNKNOWN", inputRate: undefined, outputRate: undefined })).not.toThrow());
  it("rejects UNKNOWN with a zero rate", () => expect(() => validatePrice({ ...price, state: "UNKNOWN", inputRate: "0" })).toThrow());
  it("rejects incomplete known rates", () => expect(() => validatePrice({ ...price, outputRate: undefined })).toThrow());
  const invalidPrices: Array<Record<string, string>> = [{ currency: "free" }, { unit: "PER_TOKEN" }, { inputRate: "-1" }, { inputRate: "NaN" }, { inputRate: "0.0000001" }, { source: "PLATFORM_CURATED" }, { effectiveFrom: "invalid" }, { effectiveFrom: "2026-01-01" }];
  it.each(invalidPrices)("rejects invalid price %j", async override => {
    await expect(validate({ ...base, pricing: { ...price, ...override } })).rejects.toThrow();
  });
  it("rejects inverted effective dates", () => expect(() => validatePrice({ ...price, effectiveTo: "2025-12-31T00:00:00Z" })).toThrow());
  it("bounds pagination and forbids workspace query authority", async () => {
    await expect(pipe.transform({ page: "2", limit: "5", source: "CUSTOM" }, { type: "query", metatype: ModelCatalogQueryDto })).resolves.toMatchObject({ page: 2, limit: 5 });
    for (const query of [{ page: 0 }, { limit: 101 }, { workspaceId: "other" }]) await expect(pipe.transform(query, { type: "query", metatype: ModelCatalogQueryDto })).rejects.toThrow();
  });
});

describe("MOD-2 catalog serialization and HTTP authority", () => {
  const service = new ModelCatalogService({} as never);
  const record = { id: "model", providerId: "provider", customProviderId: null, ownerWorkspaceId: null,
    providerModelId: "Exact/ID", modelName: "Exact/ID", displayName: "Model", family: null, version: null,
    contextWindow: null, maxOutputTokens: null, categories: [], source: "BUILT_IN", status: "ACTIVE",
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), archivedAt: null,
    capabilityEvidence: [], pricingRecords: [] } satisfies CatalogRecord;
  it("never serializes unknown as zero or free", () => {
    const value = service.serialize(record);
    expect(value.pricing).toEqual({ state: "UNKNOWN" });
    expect(value).not.toHaveProperty("inputCost");
    expect(value.capabilities.every(cap => cap.catalogState === "UNKNOWN")).toBe(true);
  });
  it("serializes known zero with provenance and expires it to unknown", () => {
    const value: CatalogRecord = { ...record, pricingRecords: [{ id: "price", modelId: "model", state: "KNOWN", source: "WORKSPACE_DECLARED",
      inputRate: new Prisma.Decimal(0), outputRate: new Prisma.Decimal(0), cachedInputRate: null,
      currency: "USD", unit: "PER_MILLION_TOKENS", effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-02-01"), observedAt: new Date("2026-01-01") }] };
    expect(service.serialize(value, new Date("2026-01-02")).pricing).toMatchObject({ state: "KNOWN", inputRate: "0.000000", source: "WORKSPACE_DECLARED" });
    expect(service.serialize(value, new Date("2026-03-01")).pricing).not.toHaveProperty("inputRate");
    expect(service.serialize(value, new Date("2026-03-01")).pricing.state).toBe("UNKNOWN");
  });
  it("makes custom visibility distinct from production integration", () => {
    expect(service.serialize({ ...record, source: "CUSTOM", ownerWorkspaceId: "workspace" }).productionIntegration).toBe("SPRINT_C_REQUIRED");
    expect(service.serialize({ ...record, status: "DEPRECATED" }).warnings).toEqual(["DEPRECATED_NO_NEW_ASSIGNMENTS"]);
  });
  it("requires exactly one target before persistence", async () => {
    await expect(service.create("w", "u", { ...base, providerId: undefined })).rejects.toThrow("Exactly one");
    await expect(service.create("w", "u", { ...base, customProviderId: base.providerId })).rejects.toThrow("Exactly one");
  });
  it.each(["create", "update", "archive", "restore"] as const)("guards %s with approved write permission", method => {
    const handler = Object.getOwnPropertyDescriptor(ModelCatalogController.prototype, method)!.value as object;
    expect(Reflect.getMetadata("permissions", handler)).toEqual(["ai.models.write"]);
  });
  it.each(["get", "list"] as const)("guards %s with existing read permission", method => {
    const handler = Object.getOwnPropertyDescriptor(ModelCatalogController.prototype, method)!.value as object;
    expect(Reflect.getMetadata("permissions", handler)).toEqual(["ai.providers.read"]);
  });
  it("the actual permission guard rejects missing tenant and missing authority", async () => {
    const request: { tenantContext?: unknown } = {};
    const resolve = jest.fn().mockResolvedValue([]);
    const guard = new PermissionsGuard(new Reflector(), { resolve } as never);
    const handler = Object.getOwnPropertyDescriptor(ModelCatalogController.prototype, "create")!.value as object;
    const context = { getHandler: () => handler, getClass: () => ModelCatalogController,
      switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow();
    request.tenantContext = { workspace: { id: "w" }, user: { id: "u" }, role: { id: "r", name: "Member" } };
    await expect(guard.canActivate(context)).rejects.toThrow();
    resolve.mockResolvedValue(["ai.models.write"]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolve).toHaveBeenCalledWith({ workspaceId: "w", userId: "u", roleId: "r", roleName: "Member" });
  });
  it("controller forwards only the authenticated tenant and actor", async () => {
    const create = jest.fn().mockResolvedValue({});
    const controller = new ModelCatalogController({ create } as never);
    await controller.create({ tenantContext: { workspace: { id: "trusted-w" }, user: { id: "trusted-u" } } } as never, base);
    expect(create).toHaveBeenCalledWith("trusted-w", "trusted-u", base);
  });
  it("repository query keeps source filters inside visibility and supports effective capabilities", async () => {
    const count = jest.fn().mockResolvedValue(0);
    let capturedQuery: unknown;
    const findMany = jest.fn((query: unknown) => { capturedQuery = query; return Promise.resolve([]); });
    const repository = new ModelCatalogRepository({ $transaction: (fn: (tx: unknown) => unknown) => fn({ aiModel: { count, findMany } }) } as never);
    await repository.list("owner", { source: "CUSTOM", capability: "TOOLS", page: 2, limit: 5 });
    const query = capturedQuery as { skip: number; take: number; where: Record<string, unknown> };
    expect(query.skip).toBe(5);
    expect(query.take).toBe(5);
    expect(query.where.AND).toEqual([{ OR: [{ source: "BUILT_IN", ownerWorkspaceId: null }, { ownerWorkspaceId: "owner" }] }]);
    expect(query.where.source).toBe("CUSTOM");
    expect(query.where.capabilityEvidence).toEqual({ some: { key: "TOOLS", source: { not: "WORKSPACE_DECLARED" }, state: "SUPPORTED" } });
  });
});
