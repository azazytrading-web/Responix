import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RuntimeOptimizationController } from "./runtime-optimization.controller";
import {
  CacheRenderedPromptDto, RuntimeOptimizationListQueryDto
} from "./dto/runtime-optimization.dto";

describe("RuntimeOptimizationController", () => {
  const service = {
    cacheCompiled: jest.fn(), cacheRendered: jest.fn(), createContext: jest.fn(),
    cacheRetrieval: jest.fn(), list: jest.fn(), getMetrics: jest.fn(), get: jest.fn()
  };
  const controller = new RuntimeOptimizationController(service as never);
  const request = { tenantContext: {
    workspace: { id: "workspace" }, user: { id: "actor" }
  } };
  it("passes tenant context through all mutations", async () => {
    await controller.cacheCompiled(request as never, { compiledPromptId: "id" });
    await controller.cacheRendered(request as never, {
      compiledPromptId: "id", staticVariables: {}
    });
    await controller.createContext(request as never, { compiledPromptId: "id" });
    await controller.cacheRetrieval(request as never, { retrievalRuntimeSnapshotId: "id" });
    expect(service.cacheCompiled).toHaveBeenCalledWith(
      "workspace", "actor", { compiledPromptId: "id" }
    );
    expect(service.cacheRendered).toHaveBeenCalled();
    expect(service.createContext).toHaveBeenCalled();
    expect(service.cacheRetrieval).toHaveBeenCalled();
  });
  it("delegates workspace-isolated reads", async () => {
    await controller.list(request as never, { page: 1 });
    await controller.metrics(request as never, "id");
    await controller.get(request as never, "id");
    expect(service.list).toHaveBeenCalledWith("workspace", { page: 1 });
    expect(service.getMetrics).toHaveBeenCalledWith("workspace", "id");
    expect(service.get).toHaveBeenCalledWith("workspace", "id");
  });
  it.each([
    ["cacheCompiled", "runtime.optimization.create"],
    ["cacheRendered", "runtime.optimization.create"],
    ["createContext", "runtime.optimization.create"],
    ["cacheRetrieval", "runtime.optimization.create"],
    ["list", "runtime.optimization.read"],
    ["metrics", "runtime.optimization.read"],
    ["get", "runtime.optimization.read"]
  ])("declares permission metadata for %s", (method, permission) => {
    const handler = Object.getOwnPropertyDescriptor(
      RuntimeOptimizationController.prototype, method
    )?.value as object;
    expect(Reflect.getMetadata("permissions", handler)).toEqual([permission]);
  });
  it("validates rendered prompt DTOs", async () => {
    const invalid = plainToInstance(CacheRenderedPromptDto, {
      compiledPromptId: "bad", staticVariables: "bad"
    });
    expect((await validate(invalid)).length).toBeGreaterThanOrEqual(2);
  });
  it("transforms and validates list filters", async () => {
    const dto = plainToInstance(RuntimeOptimizationListQueryDto, {
      page: "2", limit: "10", type: "RUNTIME_CONTEXT", sourceHash: "a".repeat(64)
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 10, type: "RUNTIME_CONTEXT" });
  });
});
