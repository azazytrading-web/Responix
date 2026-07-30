import type { PromptExecutionRepository } from "./prompt-execution.repository";
import { PromptExecutionService } from "./prompt-execution.service";

describe("PromptExecutionService", () => {
  const repository = {
    render: jest.fn(), validate: jest.fn(), get: jest.fn(), list: jest.fn()
  } as unknown as jest.Mocked<PromptExecutionRepository>;
  const service = new PromptExecutionService(repository);
  beforeEach(() => jest.clearAllMocks());
  it.each([
    ["render", ["workspace", "actor", { compiledPromptId: "compiled" }]],
    ["validate", ["workspace", "actor", { compiledPromptId: "compiled" }]],
    ["get", ["workspace", "payload"]],
    ["list", ["workspace", { page: 1 }]]
  ] as const)("delegates %s without business logic", async (method, args) => {
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    const target = repository[method] as jest.Mock;
    target.mockResolvedValue({});
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    const operation = service[method] as (...values: unknown[]) => unknown;
    await operation.apply(service, [...args]);
    expect(target).toHaveBeenCalledWith(...args);
  });
});
