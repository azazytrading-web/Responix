import { AgentPublishRuntimeService } from "./agent-publish-runtime.service";

describe("AgentPublishRuntimeService", () => {
  it("creates a linked READY package from the published Agent version", async () => {
    const prisma = {
      agentRuntimeSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      agentExecutionOrchestration: { findFirst: jest.fn().mockResolvedValue(null) },
      memoryRuntime: { findFirst: jest.fn().mockResolvedValue(null) },
      aiAgentVersion: { findFirst: jest.fn().mockResolvedValue({ snapshot: {
        runtimeConfiguration: {
          executionPipelineId: "pipeline-source", executionProfileId: "profile"
        },
        promptBindings: [{ role: "SYSTEM", promptId: "prompt", promptVersionId: "prompt-version" }],
        maxTokens: 1000, temperature: 0.4, topP: null, stopSequences: [],
        streamingEnabled: false, capabilities: { memoryEnabled: true }
      } }) },
      executionPipeline: { findFirst: jest.fn().mockResolvedValue({ id: "pipeline-source" }) },
      executionProfile: { findFirst: jest.fn().mockResolvedValue({
        id: "profile", versions: [{ id: "profile-version" }]
      }) },
      promptLibraryVersion: { findFirst: jest.fn().mockResolvedValue({
        id: "prompt-version", snapshot: { draft: { sections: {
          systemPrompt: "System", userPrompt: "User"
        } } }
      }) }
    };
    const kernel = { createRequest: jest.fn().mockResolvedValue({ id: "request" }) };
    const agents = {
      prepare: jest.fn().mockResolvedValue({ id: "runtime" }),
      createSnapshot: jest.fn().mockResolvedValue({ id: "agent-snapshot" })
    };
    const compiler = { compile: jest.fn().mockResolvedValue({ id: "compiled" }) };
    const providers = {
      prepare: jest.fn().mockResolvedValue({ id: "provider-request" }),
      createSnapshot: jest.fn().mockResolvedValue({ id: "provider-snapshot" })
    };
    const pipelines = {
      get: jest.fn().mockResolvedValue({
        id: "pipeline-source", name: "Main", compatibilityVersion: "1.0.0",
        plan: { nodes: [
          { nodeKey: "agent", stage: "agent", ordinal: 0, assetType: "AGENT_RUNTIME", assetId: "other-agent" },
          { nodeKey: "prompt", stage: "prompt", ordinal: 1, assetType: "COMPILED_PROMPT", assetId: "other-prompt" },
          { nodeKey: "provider", stage: "provider", ordinal: 2, assetType: "PROVIDER_RUNTIME", assetId: "other-provider" }
        ] }
      }),
      create: jest.fn().mockResolvedValue({ id: "new-pipeline" }),
      publish: jest.fn().mockResolvedValue({ id: "pipeline-snapshot" })
    };
    const prompts = { render: jest.fn().mockResolvedValue({ id: "prompt-payload" }) };
    const executions = { prepare: jest.fn().mockResolvedValue({
      id: "orchestration", status: "READY",
      agentRuntimeSnapshotId: "agent-snapshot",
      promptExecutionPayloadId: "prompt-payload",
      providerRuntimeSnapshotId: "provider-snapshot",
      executionPipelineSnapshotId: "pipeline-snapshot"
    }) };
    const memory = { create: jest.fn().mockResolvedValue({ id: "memory-runtime", stateVersion: 0 }),
      publish: jest.fn().mockResolvedValue({ id: "memory-snapshot" }) };
    const service = new AgentPublishRuntimeService(
      prisma as never, kernel as never, agents as never, compiler as never,
      prompts as never, providers as never, pipelines as never, executions as never, memory as never
    );

    const result = await service.prepare("workspace", "actor", "agent", "agent-version");

    expect(result).toEqual(expect.objectContaining({ status: "READY" }));
    expect(kernel.createRequest).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      sourceType: "AGENT", sourceReferenceId: "agent"
    }));
    expect(agents.prepare).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      agentId: "agent", agentVersionId: "agent-version",
      executionProfileId: "profile", executionProfileVersionId: "profile-version"
    }));
    expect(pipelines.create).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      nodes: expect.arrayContaining([
        expect.objectContaining({ assetType: "AGENT_RUNTIME", assetId: "agent-snapshot" }),
        expect.objectContaining({ assetType: "COMPILED_PROMPT", assetId: "compiled" }),
        expect.objectContaining({ assetType: "PROVIDER_RUNTIME", assetId: "provider-snapshot" })
      ])
    }));
    expect(executions.prepare).toHaveBeenCalledWith("workspace", "actor", {
      agentRuntimeSnapshotId: "agent-snapshot",
      promptExecutionPayloadId: "prompt-payload",
      providerRuntimeSnapshotId: "provider-snapshot",
      executionPipelineSnapshotId: "pipeline-snapshot",
      memoryRuntimeSnapshotIds: ["memory-snapshot"],
      memoryCompatibilityVersion: "1.0",
      correlationId: "agent-publish:agent-version",
      idempotencyKey: "agent-publish:agent-version:orchestration",
      metadata: { lifecycle: "agent.publish", agentVersionId: "agent-version" }
    });
    expect(memory.create).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      type: "AGENT", scopeKey: "agent:agent", metadata: { agentId: "agent", agentVersionId: "agent-version" }
    }));
  });

  it("rejects publish clearly when no pipeline is selected", async () => {
    const prisma = {
      agentRuntimeSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      agentExecutionOrchestration: { findFirst: jest.fn().mockResolvedValue(null) },
      aiAgentVersion: { findFirst: jest.fn().mockResolvedValue({
        snapshot: { runtimeConfiguration: {} }
      }) }
    };
    const service = new AgentPublishRuntimeService(
      prisma as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never
    );

    await expect(service.prepare("workspace", "actor", "agent", "agent-version"))
      .rejects.toThrow("A published execution pipeline must be selected");
  });

  it("does not create or bind a memory runtime when the published Agent disables memory", async () => {
    const prisma = {
      agentRuntimeSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      agentExecutionOrchestration: { findFirst: jest.fn().mockResolvedValue(null) },
      memoryRuntime: { findFirst: jest.fn() },
      aiAgentVersion: { findFirst: jest.fn().mockResolvedValue({ snapshot: {
        runtimeConfiguration: { executionPipelineId: "pipeline", executionProfileId: "profile" },
        promptBindings: [{ role: "SYSTEM", promptId: "prompt", promptVersionId: "prompt-version" }],
        maxTokens: 1000, temperature: 0.2, topP: null, stopSequences: [], capabilities: { memoryEnabled: false }
      } }) },
      executionPipeline: { findFirst: jest.fn().mockResolvedValue({ id: "pipeline" }) },
      executionProfile: { findFirst: jest.fn().mockResolvedValue({ id: "profile", versions: [{ id: "profile-version" }] }) },
      promptLibraryVersion: { findFirst: jest.fn().mockResolvedValue({ id: "prompt-version", snapshot: {
        draft: { sections: { systemPrompt: "System", userPrompt: "User" } }
      } }) }
    };
    const kernel = { createRequest: jest.fn().mockResolvedValue({ id: "request" }) };
    const agents = { prepare: jest.fn().mockResolvedValue({ id: "runtime" }), createSnapshot: jest.fn().mockResolvedValue({ id: "agent-snapshot" }) };
    const compiler = { compile: jest.fn().mockResolvedValue({ id: "compiled" }) };
    const prompts = { render: jest.fn().mockResolvedValue({ id: "payload" }) };
    const providers = { prepare: jest.fn().mockResolvedValue({ id: "provider" }), createSnapshot: jest.fn().mockResolvedValue({ id: "provider-snapshot" }) };
    const pipelines = { get: jest.fn().mockResolvedValue({ name: "Pipeline", compatibilityVersion: "1.0", plan: { nodes: [] } }),
      create: jest.fn().mockResolvedValue({ id: "pipeline-copy" }), publish: jest.fn().mockResolvedValue({ id: "pipeline-snapshot" }) };
    const executions = { prepare: jest.fn().mockResolvedValue({ id: "orchestration", status: "READY" }) };
    const memory = { create: jest.fn(), publish: jest.fn() };
    const service = new AgentPublishRuntimeService(prisma as never, kernel as never, agents as never,
      compiler as never, prompts as never, providers as never, pipelines as never, executions as never, memory as never);
    await service.prepare("workspace", "actor", "agent", "version");
    expect(memory.create).not.toHaveBeenCalled();
    expect(memory.publish).not.toHaveBeenCalled();
    expect(prisma.memoryRuntime.findFirst).not.toHaveBeenCalled();
    expect(executions.prepare).toHaveBeenCalledWith("workspace", "actor", expect.not.objectContaining({
      memoryRuntimeSnapshotIds: expect.anything()
    }));
  });

  it("rejects a published Prompt Library version with the exact missing compiler prerequisite", async () => {
    const prisma = {
      agentRuntimeSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      agentExecutionOrchestration: { findFirst: jest.fn().mockResolvedValue(null) },
      aiAgentVersion: { findFirst: jest.fn().mockResolvedValue({ snapshot: {
        runtimeConfiguration: {
          executionPipelineId: "pipeline-source", executionProfileId: "profile"
        },
        promptBindings: [{ role: "SYSTEM", promptId: "new-prompt", promptVersionId: null }]
      } }) },
      executionPipeline: { findFirst: jest.fn().mockResolvedValue({ id: "pipeline-source" }) },
      executionProfile: { findFirst: jest.fn().mockResolvedValue({
        id: "profile", versions: [{ id: "profile-version" }]
      }) },
      promptLibraryVersion: { findFirst: jest.fn().mockResolvedValue({
        id: "new-prompt-version", snapshot: { draft: { system_prompt: "System only" } }
      }) }
    };
    const kernel = { createRequest: jest.fn() };
    const service = new AgentPublishRuntimeService(
      prisma as never, kernel as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never
    );

    await expect(service.prepare("workspace", "actor", "agent", "agent-version"))
      .rejects.toMatchObject({ response: expect.objectContaining({
        code: "USER_PROMPT_MISSING", path: "sections.userPrompt",
        promptId: "new-prompt", promptVersionId: "new-prompt-version"
      }) });
    expect(kernel.createRequest).not.toHaveBeenCalled();
  });

  it("does not build or require Provider Runtime assets for an OIC Agent", async () => {
    const prisma = {
      agentRuntimeSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      agentExecutionOrchestration: { findFirst: jest.fn().mockResolvedValue(null) },
      aiAgentVersion: { findFirst: jest.fn().mockResolvedValue({ snapshot: {
        runtimeConfiguration: { executionMode: "OIC", executionPipelineId: "pipeline", executionProfileId: "profile",
          oicIntegration: { executionMode: "OIC", oiModelKey: "oi-support-v1" } },
        promptBindings: [{ role: "SYSTEM", promptId: "prompt", promptVersionId: "prompt-version" }],
        maxTokens: 1000, temperature: 0.2, topP: null, stopSequences: [], streamingEnabled: false,
        capabilities: { memoryEnabled: false }
      } }) },
      executionPipeline: { findFirst: jest.fn().mockResolvedValue({ id: "pipeline" }) },
      executionProfile: { findFirst: jest.fn().mockResolvedValue({ id: "profile", versions: [{ id: "profile-version" }] }) },
      promptLibraryVersion: { findFirst: jest.fn().mockResolvedValue({ id: "prompt-version", snapshot: {
        draft: { sections: { systemPrompt: "System", userPrompt: "User" } }
      } }) }
    };
    const providers = { prepare: jest.fn(), createSnapshot: jest.fn() };
    const agents = { prepare: jest.fn().mockResolvedValue({ id: "runtime" }), createSnapshot: jest.fn().mockResolvedValue({ id: "agent-snapshot" }) };
    const pipelines = { get: jest.fn().mockResolvedValue({ id: "pipeline", name: "Pipeline", compatibilityVersion: "1.0",
      plan: { nodes: [{ nodeKey: "agent", stage: "agent", ordinal: 0, assetType: "AGENT_RUNTIME", assetId: "other" }] } }),
      create: jest.fn().mockResolvedValue({ id: "pipeline-copy" }), publish: jest.fn().mockResolvedValue({ id: "pipeline-snapshot" }) };
    const executions = { prepare: jest.fn().mockResolvedValue({ id: "orchestration", status: "READY" }) };
    const service = new AgentPublishRuntimeService(prisma as never,
      { createRequest: jest.fn().mockResolvedValue({ id: "request" }) } as never,
      agents as never, { compile: jest.fn().mockResolvedValue({ id: "compiled" }) } as never,
      { render: jest.fn().mockResolvedValue({ id: "payload" }) } as never, providers as never,
      pipelines as never, executions as never, {} as never);
    await service.prepare("workspace", "actor", "agent", "version");
    expect(providers.prepare).not.toHaveBeenCalled();
    expect(providers.createSnapshot).not.toHaveBeenCalled();
    expect(executions.prepare).toHaveBeenCalledWith("workspace", "actor", expect.not.objectContaining({
      providerRuntimeSnapshotId: expect.anything()
    }));
  });
});
