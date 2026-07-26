import { AiContractError } from "../contracts";
import { CapabilityValidator } from "./capability-validator.service";

const estimate = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  estimatedCost: "0.001500"
};
const limits = {
  dailyRequestLimit: 100,
  monthlyRequestLimit: 1_000,
  dailyTokenLimit: 10_000,
  monthlyTokenLimit: 100_000,
  dailyCostLimit: "10.000000",
  monthlyCostLimit: "100.000000",
  maxConcurrentInvocations: 2,
  maxQueueDepth: 2,
  maxContextTokens: 200,
  maxOutputTokens: 100
};

describe("CapabilityValidator", () => {
  const validator = new CapabilityValidator();

  it("accepts estimates within workspace and model limits", () => {
    expect(() => validator.validateWorkspaceEstimate(estimate, limits)).not.toThrow();
    expect(() =>
      validator.validateModel(estimate, {
        modelId: "model-id",
        providerId: "provider-id",
        modelName: "model",
        displayName: "Model",
        status: "ACTIVE",
        priority: 1,
        contextWindow: 200,
        maxOutputTokens: 100,
        supportsVision: false,
        supportsAudio: false,
        supportsTools: false,
        supportsReasoning: false,
        supportsStreaming: false,
        supportsJson: true
      })
    ).not.toThrow();
  });

  it("rejects workspace context and output limits", () => {
    expect(() =>
      validator.validateWorkspaceEstimate(estimate, {
        ...limits,
        maxContextTokens: 149
      })
    ).toThrow(AiContractError);
    expect(() =>
      validator.validateWorkspaceEstimate(estimate, {
        ...limits,
        maxOutputTokens: 49
      })
    ).toThrow(AiContractError);
  });

  it("rejects model context and output limits", () => {
    const model = {
      modelId: "model-id",
      providerId: "provider-id",
      modelName: "model",
      displayName: "Model",
      status: "ACTIVE" as const,
      priority: 1,
      contextWindow: 149,
      maxOutputTokens: 49,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: false,
      supportsReasoning: false,
      supportsStreaming: false,
      supportsJson: false
    };
    expect(() => validator.validateModel(estimate, model)).toThrow(AiContractError);
  });
});
