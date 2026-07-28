import { PromptCompilerService } from "./prompt-compiler.service";

describe("PromptCompilerService", () => {
  const repository = {
    compile: jest.fn(),
    preview: jest.fn(),
    validate: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    compare: jest.fn()
  };
  const service = new PromptCompilerService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("delegates compiler operations with workspace and actor context", async () => {
    const dto = { promptId: "prompt", promptVersionId: "version" };
    await service.compile("workspace", "actor", dto);
    await service.preview("workspace", "actor", dto);
    await service.validate("workspace", "actor", dto);
    expect(repository.compile).toHaveBeenCalledWith("workspace", "actor", dto);
    expect(repository.preview).toHaveBeenCalledWith("workspace", "actor", dto);
    expect(repository.validate).toHaveBeenCalledWith("workspace", "actor", dto);
  });

  it("delegates immutable reads, pagination, and comparison", async () => {
    await service.list("workspace", { page: 2 });
    await service.get("workspace", "compiled");
    await service.compare("workspace", "left", "right");
    expect(repository.list).toHaveBeenCalledWith("workspace", { page: 2 });
    expect(repository.get).toHaveBeenCalledWith("workspace", "compiled");
    expect(repository.compare).toHaveBeenCalledWith("workspace", "left", "right");
  });
});

