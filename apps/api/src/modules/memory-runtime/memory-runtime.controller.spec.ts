import { Reflector } from "@nestjs/core";
import { MemoryRuntimeController } from "./memory-runtime.controller";

describe("MemoryRuntimeController", () => {
  const service = {
    create: jest.fn(), update: jest.fn(), publish: jest.fn(), rollback: jest.fn(),
    archive: jest.fn(), resolve: jest.fn(), commitWrite: jest.fn(), list: jest.fn(),
    compare: jest.fn(), listSnapshots: jest.fn(), getSnapshot: jest.fn(),
    diagnostics: jest.fn(), metrics: jest.fn(), history: jest.fn(), get: jest.fn()
  };
  const controller = new MemoryRuntimeController(service as never);
  const request = { tenantContext: {
    workspace: { id: "workspace" }, user: { id: "actor" }
  } } as never;

  it("delegates create with tenant context", async () => {
    const dto = { identifier: "session.one", name: "Session", type: "SESSION",
      scopeKey: "session:one", content: {}, compatibilityVersion: "1.0" };
    await controller.create(request, dto as never);
    expect(service.create).toHaveBeenCalledWith("workspace", "actor", dto);
  });
  it("publishes dedicated permission metadata", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", MemoryRuntimeController.prototype.create))
      .toEqual(["memory.runtime.write"]);
    expect(reflector.get("permissions", MemoryRuntimeController.prototype.publish))
      .toEqual(["memory.runtime.publish"]);
    expect(reflector.get("permissions", MemoryRuntimeController.prototype.archive))
      .toEqual(["memory.runtime.archive"]);
    expect(reflector.get("permissions", MemoryRuntimeController.prototype.compare))
      .toEqual(["memory.runtime.compare"]);
    expect(reflector.get("permissions", MemoryRuntimeController.prototype.get))
      .toEqual(["memory.runtime.read"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
