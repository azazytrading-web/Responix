import type { ExecutionPipelineRepository } from "./execution-pipeline.repository";
import { ExecutionPipelineService } from "./execution-pipeline.service";
import type { CreateExecutionPipelineDto } from "./dto/execution-pipeline.dto";

describe("ExecutionPipelineService", () => {
  const repository = {
    create: jest.fn(), update: jest.fn(), validate: jest.fn(), publish: jest.fn(),
    rollback: jest.fn(), clone: jest.fn(), archive: jest.fn(), restore: jest.fn(),
    softDelete: jest.fn(), get: jest.fn(), getSnapshot: jest.fn(), list: jest.fn(),
    listSnapshots: jest.fn(), compare: jest.fn()
  } as unknown as jest.Mocked<ExecutionPipelineRepository>;
  const service = new ExecutionPipelineService(repository);
  const dto = {
    name: "Pipeline", compatibilityVersion: "1.0.0", nodes: []
  } as CreateExecutionPipelineDto;
  beforeEach(() => jest.clearAllMocks());
  it.each([
    ["create", ["workspace", "actor", dto]],
    ["update", ["workspace", "actor", "id", dto]],
    ["validate", ["workspace", "actor", "id"]],
    ["publish", ["workspace", "actor", "id"]],
    ["rollback", ["workspace", "actor", "id", "revision"]],
    ["clone", ["workspace", "actor", "id", {}]],
    ["archive", ["workspace", "actor", "id"]],
    ["restore", ["workspace", "actor", "id"]],
    ["softDelete", ["workspace", "actor", "id"]],
    ["get", ["workspace", "id"]],
    ["getSnapshot", ["workspace", "id"]],
    ["list", ["workspace", {}]],
    ["listSnapshots", ["workspace", {}]],
    ["compare", ["workspace", "left", "right"]]
  ] as const)("delegates %s without adding business logic", async (method, args) => {
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    const target = repository[method] as jest.Mock;
    target.mockResolvedValue({ id: "result" });
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    const operation = service[method] as (...values: unknown[]) => unknown;
    await operation.apply(service, [...args]);
    expect(target).toHaveBeenCalledWith(...args);
  });
});
