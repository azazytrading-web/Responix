import { AgentStudioService } from "./agent-studio.service";

describe("AgentStudioService", () => {
  const repository = {
    create: jest.fn(),
    updateDraft: jest.fn(),
    publish: jest.fn(),
    rollback: jest.fn(),
    clone: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    softDelete: jest.fn(),
    revertFailedPublish: jest.fn(),
    get: jest.fn(),
    history: jest.fn(),
    list: jest.fn(),
    switchChannelAgent: jest.fn(),
    bindRetrievalRuntime: jest.fn(),
    unbindRetrievalRuntime: jest.fn(),
    updateOperationalPersonality: jest.fn(),
    updateOperationalAutomaticExecution: jest.fn()
  };
  const publishRuntime = { prepare: jest.fn() };
  const retrievalRuntime = { getPublishedSnapshot: jest.fn() };
  const service = new AgentStudioService(
    repository as never,
    publishRuntime as never,
    retrievalRuntime as never
  );

  beforeEach(() => jest.clearAllMocks());

  it("binds create and draft editing to the authenticated workspace and actor", async () => {
    const dto = {
      name: "Support",
      slug: "support",
      configuration: {
        providerId: "provider",
        modelId: "model",
        temperature: 0.7,
        maxTokens: 1000
      }
    };
    await service.create("workspace", "actor", dto);
    await service.updateDraft("workspace", "actor", "agent", { description: "Updated" });
    expect(repository.create).toHaveBeenCalledWith({ workspaceId: "workspace", actorId: "actor", ...dto });
    expect(repository.updateDraft).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      draft: { description: "Updated" }
    });
  });

  it("delegates the complete transactional lifecycle", async () => {
    repository.publish.mockResolvedValue({
      agent: { id: "agent" }, version: { id: "version" }
    });
    publishRuntime.prepare.mockResolvedValue({ id: "orchestration", status: "READY" });
    await service.publish("workspace", "actor", "agent", { changeSummary: "Ready" });
    await service.rollback("workspace", "actor", "agent", { revision: 1 });
    await service.clone("workspace", "actor", "agent", { name: "Copy", slug: "copy" });
    await service.archive("workspace", "actor", "agent");
    await service.restore("workspace", "actor", "agent");
    await service.delete("workspace", "actor", "agent");

    expect(repository.publish).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      changeSummary: "Ready"
    });
    expect(publishRuntime.prepare).toHaveBeenCalledWith(
      "workspace", "actor", "agent", "version"
    );
    expect(repository.rollback).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      revision: 1
    });
    expect(repository.clone).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      name: "Copy",
      slug: "copy"
    });
    expect(repository.archive).toHaveBeenCalledWith("workspace", "actor", "agent");
    expect(repository.restore).toHaveBeenCalledWith("workspace", "actor", "agent");
    expect(repository.softDelete).toHaveBeenCalledWith("workspace", "actor", "agent");
  });

  it("reverts publication when mandatory runtime preparation fails", async () => {
    repository.publish.mockResolvedValue({
      agent: { id: "agent" }, version: { id: "version" }
    });
    publishRuntime.prepare.mockRejectedValue(new Error("missing execution profile"));

    await expect(service.publish("workspace", "actor", "agent", {}))
      .rejects.toThrow("missing execution profile");
    expect(repository.revertFailedPublish).toHaveBeenCalledWith(
      "workspace", "actor", "agent", "version"
    );
  });

  it("normalizes list pagination without losing filters", async () => {
    await service.list("workspace", {
      search: "support",
      category: "Customer Service",
      visibility: "WORKSPACE"
    });
    expect(repository.list).toHaveBeenCalledWith({
      workspaceId: "workspace",
      page: 1,
      limit: 25,
      search: "support",
      status: undefined,
      visibility: "WORKSPACE",
      category: "Customer Service"
    });
  });

  it("validates a published runtime before binding it to the agent", async () => {
    retrievalRuntime.getPublishedSnapshot.mockResolvedValue({ id: "snapshot" });
    repository.bindRetrievalRuntime.mockResolvedValue({ id: "agent" });

    await service.bindRetrievalRuntime("workspace", "actor", "agent", {
      retrievalRuntimeId: "runtime"
    });

    expect(retrievalRuntime.getPublishedSnapshot).toHaveBeenCalledWith(
      "workspace",
      "runtime"
    );
    expect(repository.bindRetrievalRuntime).toHaveBeenCalledWith(
      "workspace",
      "actor",
      "agent",
      "runtime"
    );
  });

  it("updates operational personality without routing through draft definition updates", async () => {
    const personality = {
      warmth: { base: 50, intensity: 0 },
      enthusiasm: { base: 50, intensity: 50 },
      formality: { base: 50, intensity: 100 }
    };
    await service.updateOperationalPersonality("workspace", "actor", "agent", personality);
    expect(repository.updateOperationalPersonality).toHaveBeenCalledWith(
      "workspace", "actor", "agent", personality
    );
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });

  it("persists pause for one Agent without changing channel or conversation execution gates", async () => {
    repository.updateOperationalAutomaticExecution.mockResolvedValue({ id: "agent-a", status: "PUBLISHED" });
    await service.updateOperationalAutomaticExecution("workspace", "actor", "agent-a", { enabled: false });
    expect(repository.updateOperationalAutomaticExecution).toHaveBeenCalledWith("workspace", "actor", "agent-a", false);
    expect(repository.switchChannelAgent).not.toHaveBeenCalled();
  });

  it("refreshes live channel configurations after a published Agent is connected to Knowledge", async () => {
    retrievalRuntime.getPublishedSnapshot.mockResolvedValue({ id: "snapshot" });
    repository.bindRetrievalRuntime.mockResolvedValue({ id: "agent", status: "PUBLISHED" });
    repository.get
      .mockResolvedValueOnce({ id: "agent", activeChannels: [{ connectionId: "connection", stateVersion: 4 }] })
      .mockResolvedValueOnce({ id: "agent", activeChannels: [{ connectionId: "connection", stateVersion: 5 }] });

    await service.bindRetrievalRuntime("workspace", "actor", "agent", { retrievalRuntimeId: "runtime" });

    expect(repository.switchChannelAgent).toHaveBeenCalledWith(
      "workspace", "actor", "agent", "connection", 4
    );
  });

  it("does not bind when the retrieval runtime is not published", async () => {
    retrievalRuntime.getPublishedSnapshot.mockRejectedValue(
      new Error("Retrieval Runtime must be published")
    );

    await expect(
      service.bindRetrievalRuntime("workspace", "actor", "agent", { retrievalRuntimeId: "runtime" })
    ).rejects.toThrow("Retrieval Runtime must be published");
    expect(repository.bindRetrievalRuntime).not.toHaveBeenCalled();
  });

  it("unbinds the retrieval runtime from the agent", async () => {
    repository.unbindRetrievalRuntime.mockResolvedValue({ id: "agent" });

    await service.unbindRetrievalRuntime("workspace", "actor", "agent");

    expect(repository.unbindRetrievalRuntime).toHaveBeenCalledWith(
      "workspace",
      "actor",
      "agent"
    );
  });
});
