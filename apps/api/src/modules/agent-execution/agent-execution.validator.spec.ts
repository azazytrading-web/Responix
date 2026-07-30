import { AgentExecutionValidator } from "./agent-execution.validator";

describe("AgentExecutionValidator", () => {
  const validator = new AgentExecutionValidator();
  const assets = () => ({
    agent: { id: "agent-snapshot" },
    prompt: {
      compiledPromptId: "compiled", agentRuntimeSnapshotId: "agent-snapshot",
      conversationRuntimeSnapshotId: "conversation", executionPipelineSnapshotId: "pipeline"
    },
    provider: {
      compiledPromptId: "compiled", agentRuntimeSnapshotId: "agent-snapshot"
    },
    conversation: { id: "conversation" },
    pipeline: { id: "pipeline" }
  });
  it("accepts compatible immutable assets", () => {
    expect(validator.validate(assets())).toEqual([]);
  });
  it.each([
    ["prompt agent", (value: ReturnType<typeof assets>) => {
      value.prompt.agentRuntimeSnapshotId = "other";
    }, "AGENT_RUNTIME_MISMATCH"],
    ["provider agent", (value: ReturnType<typeof assets>) => {
      value.provider.agentRuntimeSnapshotId = "other";
    }, "PROVIDER_RUNTIME_MISMATCH"],
    ["compiled prompt", (value: ReturnType<typeof assets>) => {
      value.provider.compiledPromptId = "other";
    }, "PROMPT_PROVIDER_MISMATCH"],
    ["conversation", (value: ReturnType<typeof assets>) => {
      value.prompt.conversationRuntimeSnapshotId = "other";
    }, "CONVERSATION_MISMATCH"],
    ["pipeline", (value: ReturnType<typeof assets>) => {
      value.prompt.executionPipelineSnapshotId = "other";
    }, "PIPELINE_MISMATCH"]
  ])("rejects an incompatible %s reference", (_name, mutate, code) => {
    const value = assets(); mutate(value);
    expect(validator.validate(value)).toEqual([
      expect.objectContaining({ severity: "ERROR", code })
    ]);
  });
  it("allows an omitted optional conversation", () => {
    const value = assets();
    expect(validator.validate({ ...value, conversation: undefined }))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "CONVERSATION_MISMATCH" })
      ]));
  });
  it("aggregates error diagnostics emitted by runtime assets", () => {
    const value = assets();
    Object.assign(value.provider, {
      validationResult: {
        diagnostics: [{
          severity: "ERROR", code: "PROVIDER_INVALID",
          path: "provider", message: "Provider is not ready"
        }]
      }
    });
    expect(validator.validate(value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROVIDER_INVALID", path: "provider" })
    ]));
  });
});
