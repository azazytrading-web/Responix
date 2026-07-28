/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  NotFoundException
} from "@nestjs/common";
import { PromptCompilerEngine } from "./prompt-compiler.engine";
import { PromptCompilerRepository } from "./prompt-compiler.repository";
import type { CompilePromptDto } from "./dto/prompt-compiler.dto";
import {
  CompilerVariableSource,
  CompilerVariableType
} from "./dto/prompt-compiler.dto";

const now = new Date("2026-01-01T00:00:00.000Z");
const dto = (overrides: Partial<CompilePromptDto> = {}): CompilePromptDto => ({
  promptId: "prompt",
  promptVersionId: "prompt-version",
  variables: [{
    name: "name",
    type: CompilerVariableType.STRING,
    source: CompilerVariableSource.EXECUTION_RUNTIME,
    value: "Ada"
  }],
  ...overrides
});
const compiled = (overrides: Record<string, unknown> = {}) => ({
  id: "compiled",
  workspaceId: "workspace",
  createdById: "actor",
  promptId: "prompt",
  promptVersionId: "prompt-version",
  agentVersionId: null,
  agentRuntimeSnapshotId: null,
  executionRequestId: null,
  conversationId: null,
  compilerVersion: "1.0.0",
  compiledPackage: { hash: "hash" },
  resolvedPrompt: {
    sections: {
      systemPrompt: "System",
      developerPrompt: "Developer",
      userPrompt: "Hello Ada",
      assistantHistory: []
    }
  },
  variableMap: { name: "Ada" },
  variableMetadata: [],
  promptMetadata: {},
  diagnostics: [],
  dependencyMap: { name: [] },
  placeholders: ["name"],
  hash: "hash",
  checksum: "checksum",
  sizeBytes: 100,
  compiledAt: now,
  createdAt: now,
  ...overrides
});

describe("PromptCompilerRepository", () => {
  const prisma = {
    workspace: { findFirst: jest.fn() },
    promptLibraryItem: { findFirst: jest.fn() },
    promptLibraryVersion: { findFirst: jest.fn() },
    aiAgentVersion: { findFirst: jest.fn() },
    agentRuntimeSnapshot: { findFirst: jest.fn() },
    executionRequest: { findFirst: jest.fn() },
    conversation: { findFirst: jest.fn() },
    compiledPrompt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new PromptCompilerRepository(
    prisma as never,
    new PromptCompilerEngine()
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace",
      name: "Responix",
      language: "en",
      timezone: "UTC",
      country: null,
      currency: "USD",
      status: "ACTIVE"
    });
    prisma.promptLibraryItem.findFirst.mockResolvedValue({
      id: "prompt",
      name: "Greeting",
      slug: "greeting",
      revision: 2,
      metadata: { category: "test" }
    });
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "prompt-version",
      promptId: "prompt",
      revision: 2,
      publishedAt: now,
      snapshot: {
        name: "Greeting",
        slug: "greeting",
        draft: {
          systemPrompt: "System",
          developerPrompt: "Developer",
          userPrompt: "Hello {{name}}"
        },
        variables: [{
          name: "name",
          type: "STRING",
          required: true
        }],
        metadata: {}
      }
    });
    prisma.aiAgentVersion.findFirst.mockResolvedValue({
      id: "agent-version",
      revision: 3,
      snapshot: {}
    });
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue(null);
    prisma.executionRequest.findFirst.mockResolvedValue({
      id: "request",
      correlationId: "correlation",
      priority: 1,
      metadata: {}
    });
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation",
      status: "OPEN",
      channel: "WEB",
      language: "en",
      totalMessages: 0,
      totalTokens: 0
    });
    prisma.compiledPrompt.create.mockResolvedValue(compiled());
    prisma.compiledPrompt.findFirst.mockResolvedValue(compiled());
    prisma.compiledPrompt.findMany.mockResolvedValue([compiled()]);
    prisma.compiledPrompt.count.mockResolvedValue(1);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("transactionally persists an immutable compiled package and audit", async () => {
    await expect(repository.compile("workspace", "actor", dto()))
      .resolves.toMatchObject({ id: "compiled", workspaceId: "workspace" });
    expect(prisma.compiledPrompt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace",
        promptId: "prompt",
        promptVersionId: "prompt-version",
        compilerVersion: "1.0.0",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/)
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.compiler.compiled" })
    }));
    expect("update" in prisma.compiledPrompt).toBe(false);
  });

  it("previews and validates without persisting a compiled record", async () => {
    const preview = await repository.preview("workspace", "actor", dto());
    const validation = await repository.validate("workspace", "actor", dto());
    expect(preview.valid).toBe(true);
    expect(validation).toMatchObject({
      valid: true,
      compilerVersion: "1.0.0"
    });
    expect(prisma.compiledPrompt.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.compiler.previewed" })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.compiler.validated" })
    }));
  });

  it("rejects wrong-workspace prompts and transactionally audits diagnostics", async () => {
    prisma.promptLibraryItem.findFirst.mockResolvedValue(null);
    await expect(repository.compile("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.promptLibraryItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace",
          status: "PUBLISHED",
          deletedAt: null
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.compiler.rejected" })
    }));
  });

  it("rejects missing required variables and audits variable failures", async () => {
    await expect(repository.compile("workspace", "actor", dto({ variables: [] })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.compiledPrompt.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "prompt.compiler.variable_failed" })
    }));
  });

  it("rejects runtime, agent, and prompt version inconsistencies", async () => {
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue({
      id: "runtime-snapshot",
      agentVersionId: "other-agent-version",
      executionRequestId: "request",
      conversationId: null,
      runtimeVariables: [],
      runtimeMetadata: {},
      runtimeContext: {},
      promptReferences: [{
        promptId: "prompt",
        promptVersionId: "other-prompt-version"
      }],
      contentHash: "runtime-hash"
    });
    await expect(repository.compile("workspace", "actor", dto({
      agentVersionId: "agent-version",
      agentRuntimeSnapshotId: "runtime-snapshot"
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.compiledPrompt.create).not.toHaveBeenCalled();
  });

  it("validates execution and conversation workspace ownership", async () => {
    prisma.executionRequest.findFirst.mockResolvedValue(null);
    await expect(repository.compile("workspace", "actor", dto({
      executionRequestId: "request"
    }))).rejects.toBeInstanceOf(BadRequestException);

    prisma.executionRequest.findFirst.mockResolvedValue({
      id: "request",
      correlationId: "correlation",
      priority: 1,
      metadata: {}
    });
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(repository.compile("workspace", "actor", dto({
      conversationId: "conversation"
    }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("isolates compiled reads and comparisons by workspace", async () => {
    prisma.compiledPrompt.findFirst.mockResolvedValue(null);
    await expect(repository.get("other-workspace", "compiled"))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.compare("other-workspace", "left", "right"))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.compiledPrompt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "other-workspace" })
      })
    );
  });

  it("compares immutable versions, variables, and prompt sections", async () => {
    prisma.compiledPrompt.findFirst
      .mockResolvedValueOnce(compiled({
        id: "left",
        hash: "left-hash",
        variableMap: { name: "Ada", removed: true }
      }))
      .mockResolvedValueOnce(compiled({
        id: "right",
        hash: "right-hash",
        promptVersionId: "prompt-version-2",
        variableMap: { name: "Grace", added: true },
        resolvedPrompt: {
          sections: {
            systemPrompt: "Changed",
            developerPrompt: "Developer",
            userPrompt: "Hello Grace",
            assistantHistory: []
          }
        }
      }));
    const comparison = await repository.compare("workspace", "left", "right");
    expect(comparison).toMatchObject({
      identical: false,
      versions: { promptChanged: true },
      variables: {
        added: ["added"],
        removed: ["removed"],
        changed: ["name"]
      }
    });
    expect(comparison.promptSectionsChanged).toEqual(expect.arrayContaining([
      "systemPrompt",
      "userPrompt"
    ]));
  });

  it("paginates and filters compiled history in the workspace", async () => {
    const result = await repository.list("workspace", {
      page: 2,
      limit: 10,
      promptId: "prompt"
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1
    });
    expect(prisma.compiledPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace",
          promptId: "prompt"
        }),
        skip: 10,
        take: 10
      })
    );
  });

  it("rolls back compiled persistence when the transactional audit fails", async () => {
    prisma.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(repository.compile("workspace", "actor", dto()))
      .rejects.toThrow("audit unavailable");
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
