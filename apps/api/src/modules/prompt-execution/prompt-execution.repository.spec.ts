/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { RenderPromptExecutionDto } from "./dto/prompt-execution.dto";
import { PromptExecutionRepository } from "./prompt-execution.repository";

const dto = (overrides: Partial<RenderPromptExecutionDto> = {}): RenderPromptExecutionDto => ({
  compiledPromptId: "compiled", ...overrides
});
const rendered = {
  valid: true, diagnostics: [],
  messages: [{ role: "user" as const, content: "Hello" }],
  resolvedVariables: { name: "Ada" },
  payload: { messages: [{ role: "user", content: "Hello" }] },
  promptHash: "prompt-hash", payloadHash: "payload-hash", checksum: "checksum"
};

describe("PromptExecutionRepository", () => {
  const prisma = {
    compiledPrompt: { findFirst: jest.fn() },
    agentRuntimeSnapshot: { findFirst: jest.fn() },
    conversationRuntimeSnapshot: { findFirst: jest.fn() },
    providerRequestSnapshot: { findFirst: jest.fn() },
    executionPipelineSnapshot: { findFirst: jest.fn() },
    executionRequest: { findFirst: jest.fn() },
    executionRun: { findFirst: jest.fn() },
    promptExecutionPayload: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const engine = { render: jest.fn() };
  const repository = new PromptExecutionRepository(prisma as never, engine as never);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) =>
      Array.isArray(input)
        ? Promise.all(input)
        : (input as (tx: typeof prisma) => Promise<unknown>)(prisma));
    prisma.compiledPrompt.findFirst.mockResolvedValue({
      id: "compiled", workspaceId: "workspace", hash: "hash", checksum: "checksum",
      compilerVersion: "1.0.0", compiledPackage: {}, resolvedPrompt: {},
      variableMap: {}, variableMetadata: [], placeholders: []
    });
    engine.render.mockReturnValue(structuredClone(rendered));
    prisma.promptExecutionPayload.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        id: "payload", ...data, createdAt: new Date(), diagnostics: []
      })
    );
    prisma.promptExecutionPayload.findMany.mockResolvedValue([]);
    prisma.promptExecutionPayload.count.mockResolvedValue(0);
    prisma.auditLog.create.mockResolvedValue({});
  });
  it("persists immutable payloads and audit events in one transaction", async () => {
    await expect(repository.render("workspace", "actor", dto())).resolves.toMatchObject({
      id: "payload", workspaceId: "workspace", payloadHash: "payload-hash"
    });
    expect(prisma.promptExecutionPayload.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        compiledPromptId: "compiled", rendererVersion: "1.0.0"
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.execution.rendered" })
    }));
    expect("update" in prisma.promptExecutionPayload).toBe(false);
  });
  it("rejects invalid rendering and transactionally audits diagnostics", async () => {
    engine.render.mockReturnValue({
      ...rendered, valid: false,
      diagnostics: [{ severity: "ERROR", code: "INVALID", path: "prompt", message: "Invalid" }]
    });
    await expect(repository.render("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.promptExecutionPayload.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.execution.rejected" })
    }));
  });
  it.each([
    ["agentRuntimeSnapshotId", "agentRuntimeSnapshot"],
    ["conversationRuntimeSnapshotId", "conversationRuntimeSnapshot"],
    ["providerRuntimeSnapshotId", "providerRequestSnapshot"],
    ["executionPipelineSnapshotId", "executionPipelineSnapshot"],
    ["executionRequestId", "executionRequest"],
    ["executionRunId", "executionRun"]
  ] as const)("rejects cross-workspace %s references", async (field, repositoryName) => {
    prisma[repositoryName].findFirst.mockResolvedValueOnce(null);
    await expect(repository.render("workspace", "actor", dto({ [field]: "foreign" })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.promptExecutionPayload.create).not.toHaveBeenCalled();
  });
  it("rejects compiled prompts outside the workspace", async () => {
    prisma.compiledPrompt.findFirst.mockResolvedValueOnce(null);
    await expect(repository.render("other", "actor", dto()))
      .rejects.toBeInstanceOf(NotFoundException);
  });
  it("validates without persisting payloads and audits the outcome", async () => {
    await expect(repository.validate("workspace", "actor", dto()))
      .resolves.toMatchObject({ valid: true });
    expect(prisma.promptExecutionPayload.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.execution.validated" })
    }));
  });
  it("loads immutable payloads with workspace isolation", async () => {
    prisma.promptExecutionPayload.findFirst.mockResolvedValueOnce(null);
    await expect(repository.get("other", "payload")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.promptExecutionPayload.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payload", workspaceId: "other" }
    }));
  });
  it("filters and paginates workspace payload history", async () => {
    await repository.list("workspace", {
      page: 2, limit: 10, compiledPromptId: "compiled", executionRequestId: "request"
    });
    expect(prisma.promptExecutionPayload.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: "workspace", compiledPromptId: "compiled", executionRequestId: "request"
      },
      skip: 10, take: 10
    }));
  });
  it("rolls back payload persistence when audit creation fails", async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(repository.render("workspace", "actor", dto())).rejects.toThrow("audit failed");
  });
});
