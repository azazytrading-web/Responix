import { ToolRuntimeStatus } from "@prisma/client";
import { ToolRuntimeService } from "./tool-runtime.service";

describe("ToolRuntimeService", () => {
  const repository = { findByIdempotency: jest.fn(), get: jest.fn() };
  const registry = { publishedVersion: jest.fn() };
  const validator = { validateSnapshot: jest.fn() };
  const kernel = { getRun: jest.fn(), cancel: jest.fn() };
  const service = new ToolRuntimeService(repository as never, registry as never, validator as never,
    {} as never, {} as never, kernel as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it("reuses an idempotent execution without creating a duplicate lifecycle", async () => {
    const existing = { id: "execution", status: ToolRuntimeStatus.COMPLETED };
    repository.findByIdempotency.mockResolvedValue(existing);
    await expect(service.execute("workspace", "actor", { toolVersionId: "version", input: {},
      correlationId: "correlation", idempotencyKey: "key" })).resolves.toBe(existing);
    expect(registry.publishedVersion).not.toHaveBeenCalled();
  });

  it("maps verified published versions to provider-neutral contracts", async () => {
    registry.publishedVersion.mockResolvedValue({ compatibilityVersion: "1.0", snapshot: {
      slug: "lookup", name: "Lookup", description: "Lookup records", parameters: [], permissions: [],
      capabilities: [{ code: "read", enabled: true }, { code: "write", enabled: false }],
      schemas: [{ kind: "INPUT", schema: { type: "object" } }]
    } });
    await expect(service.providerContracts("workspace", ["version"])).resolves.toEqual([{
      name: "lookup", description: "Lookup records", inputSchema: { type: "object" },
      version: "1.0", capabilities: ["read"]
    }]);
    expect(registry.publishedVersion).toHaveBeenCalledWith("workspace", "version");
  });

  it("does not mutate terminal executions during cancellation", async () => {
    const completed = { id: "execution", status: ToolRuntimeStatus.COMPLETED };
    repository.get.mockResolvedValue(completed);
    await expect(service.cancel("workspace", "actor", "execution")).resolves.toBe(completed);
    expect(kernel.cancel).not.toHaveBeenCalled();
  });
});
