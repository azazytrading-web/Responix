/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConflictException } from "@nestjs/common";
import { CustomProviderRepository } from "./custom-provider.repository";

type PrismaWrite = { data: Record<string, unknown>; [key: string]: unknown };

function repositoryFor(customAiProvider: Record<string, jest.Mock>) {
  const transaction = jest.fn((callback: (tx: unknown) => unknown) => callback({ customAiProvider, auditLog: { create: jest.fn() } }));
  return { repository: new CustomProviderRepository({ $transaction: transaction } as never), transaction };
}

describe("CustomProviderRepository", () => {
  it("persists display and normalized names with explicit workspace ownership", async () => {
    const create = jest.fn<Promise<unknown>, [PrismaWrite]>().mockResolvedValue({ id: "custom-1" });
    const { repository } = repositoryFor({ create });
    await repository.createDefinition({
      workspaceId: "workspace-a", displayName: "  ＡPI   Hub ",
      protocolId: "openai-chat-completions-v1", baseUrl: "https://provider.example/v1",
      validationModelId: "test-model"
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: "workspace-a", displayName: "  ＡPI   Hub ", normalizedName: "api hub" })
    }));
  });

  it("maps same-workspace normalized-name uniqueness collisions to a deterministic conflict", async () => {
    const create = jest.fn<Promise<unknown>, [PrismaWrite]>().mockRejectedValue({ code: "P2002" });
    const { repository } = repositoryFor({ create });
    await expect(repository.createDefinition({
      workspaceId: "workspace-a", displayName: "API Hub", protocolId: "openai-chat-completions-v1",
      baseUrl: "https://provider.example/v1", validationModelId: "test-model"
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows the same normalized name to be stored under different workspace keys", async () => {
    const create = jest.fn<Promise<unknown>, [PrismaWrite]>().mockResolvedValue({ id: "custom-id" });
    const { repository } = repositoryFor({ create });
    const base = { displayName: "Shared Name", protocolId: "openai-chat-completions-v1", baseUrl: "https://provider.example/v1", validationModelId: "test-model" };
    await repository.createDefinition({ ...base, workspaceId: "workspace-a" });
    await repository.createDefinition({ ...base, workspaceId: "workspace-b" });
    expect(create.mock.calls.map(([input]) => input.data)).toEqual([
      expect.objectContaining({ workspaceId: "workspace-a", normalizedName: "shared name" }),
      expect.objectContaining({ workspaceId: "workspace-b", normalizedName: "shared name" })
    ]);
  });

  it("keeps archived names reserved because the normalized-name key has no status filter", async () => {
    const create = jest.fn<Promise<unknown>, [PrismaWrite]>().mockRejectedValue({ code: "P2002" });
    const { repository } = repositoryFor({ create });
    await expect(repository.createDefinition({
      workspaceId: "workspace-a", displayName: "Previously Archived", protocolId: "openai-chat-completions-v1",
      baseUrl: "https://provider.example/v1", validationModelId: "test-model"
    })).rejects.toBeInstanceOf(ConflictException);
    expect(create.mock.calls[0]?.[0].data.status).toBe("DISABLED");
  });

  it("scopes definition lookup by workspace and active lifecycle", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new CustomProviderRepository({ customAiProvider: { findFirst } } as never);
    await repository.findActiveDefinition("workspace-a", "custom-1");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "custom-1", workspaceId: "workspace-a", status: "ACTIVE" }
    }));
  });

  it("rejects rename collisions without changing to a suffixed name", async () => {
    const update = jest.fn<Promise<unknown>, [PrismaWrite]>().mockRejectedValue({ code: "P2002" });
    const repository = new CustomProviderRepository({ customAiProvider: { update } } as never);
    await expect(repository.rename("workspace-a", "custom-1", "Hub")).rejects.toThrow(
      "A Custom Provider with this name already exists in this workspace"
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "custom-1", workspaceId: "workspace-a" },
      data: { displayName: "Hub", normalizedName: "hub" }
    }));
  });

  it("hides cross-workspace provider IDs through workspace-qualified get access", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new CustomProviderRepository({ customAiProvider: { findFirst } } as never);
    await expect(repository.get("workspace-b", "provider-a")).rejects.toThrow("Custom Provider was not found");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "provider-a", workspaceId: "workspace-b" } }));
  });

  it("audits endpoint replacement inside a workspace-scoped transaction", async () => {
    const before = { id: "provider-a", workspaceId: "workspace-a", baseUrl: "https://old.example/v1", status: "DISABLED" };
    const after = { ...before, baseUrl: "https://new.example/v1" };
    const findFirst = jest.fn().mockResolvedValue(before);
    const update = jest.fn<Promise<unknown>, [PrismaWrite]>().mockResolvedValue(after);
    const auditCreate = jest.fn<Promise<unknown>, [PrismaWrite]>().mockResolvedValue({});
    const transaction = jest.fn((callback: (tx: unknown) => unknown) => callback({
      customAiProvider: { findFirst, update }, auditLog: { create: auditCreate }
    }));
    const repository = new CustomProviderRepository({ $transaction: transaction } as never);
    await repository.updateDefinition({
      workspaceId: "workspace-a", actorId: "user-a", id: "provider-a", data: { baseUrl: after.baseUrl }
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "provider-a", workspaceId: "workspace-a" } }));
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(auditCreate.mock.calls.map(([input]) => input.data.action)).toEqual([
      "ai.custom-provider.updated", "ai.custom-provider.destination.changed"
    ]);
  });
});
