import { ToolRuntimeController } from "./tool-runtime.controller";

describe("ToolRuntimeController", () => {
  const service = { execute: jest.fn(), cancel: jest.fn(), list: jest.fn(), get: jest.fn(),
    history: jest.fn(), diagnostics: jest.fn(), metrics: jest.fn(), events: jest.fn(), observe: jest.fn() };
  const controller = new ToolRuntimeController(service as never);
  const request = { tenantContext: { workspace: { id: "workspace" }, user: { id: "actor" } } } as never;

  it("forwards the authoritative tenant workspace and actor", async () => {
    const dto = { toolVersionId: "version", correlationId: "correlation", idempotencyKey: "key", input: {} };
    service.execute.mockResolvedValue({ id: "execution" });
    await controller.execute(request, dto);
    expect(service.execute).toHaveBeenCalledWith("workspace", "actor", dto);
  });

  it("publishes permission metadata for execution, history, cancellation, and streaming", () => {
    const method = (name: keyof ToolRuntimeController): object => {
      const value = Object.getOwnPropertyDescriptor(ToolRuntimeController.prototype, name)?.value as unknown;
      if (typeof value !== "function") throw new Error(`Controller method ${name} is missing`);
      return value;
    };
    expect(Reflect.getMetadata("permissions", method("execute"))).toEqual(["tool.execution.execute"]);
    expect(Reflect.getMetadata("permissions", method("cancel"))).toEqual(["tool.execution.cancel"]);
    expect(Reflect.getMetadata("permissions", method("list"))).toEqual(["tool.history.read"]);
    expect(Reflect.getMetadata("permissions", method("stream"))).toEqual(["tool.runtime.stream"]);
  });
});
