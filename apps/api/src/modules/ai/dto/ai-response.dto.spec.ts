import { AiInvocationResponseDto, AiProviderResponseDto } from "./ai-response.dto";

describe("AI response DTOs", () => {
  it("serializes persisted model metadata without changing existing capability meanings", () => {
    const response = AiProviderResponseDto.from({
      id: "provider-id", providerName: "Provider", apiBaseUrl: null,
      authenticationType: "api_key", status: "ACTIVE", priority: 1,
      configuration: null,
      models: [{
        modelId: "model-id", providerId: "provider-id", modelName: "model", displayName: "Model",
        version: "2026-01", status: "ACTIVE", priority: 1, contextWindow: 1000,
        supportsVision: false, supportsAudio: false, supportsTools: true, supportsReasoning: false,
        supportsStreaming: true, supportsJson: true, supportsFunctionCalling: true,
        supportsVideo: false, supportsMcp: false, categories: ["chat"]
      }]
    });

    expect(response.models[0]).toMatchObject({
      version: "2026-01", supportsTools: true, supportsFunctionCalling: true,
      supportsVideo: false, supportsMcp: false, categories: ["chat"]
    });
  });

  it("omits provider configuration, base URLs, and authentication metadata", () => {
    const response = AiProviderResponseDto.from({
      id: "provider-id",
      providerName: "Provider",
      apiBaseUrl: "https://provider.internal",
      authenticationType: "secret",
      status: "ACTIVE",
      priority: 1,
      configuration: { id: "configuration-id", enabled: true, settings: { secret: "hidden" } },
      models: []
    });

    const serialized = JSON.stringify(response);
    expect(response.providerConfigurationId).toBe("configuration-id");
    expect(serialized).not.toContain("apiBaseUrl");
    expect(serialized).not.toContain("authenticationType");
    expect(serialized).not.toContain("settings");
    expect(serialized).not.toContain("hidden");
  });

  it("serializes only normalized invocation fields", () => {
    const response = AiInvocationResponseDto.from({
      requestId: "request-id",
      providerId: "provider-id",
      modelId: "model-id",
      content: "Response",
      toolCalls: [
        {
          id: "hidden",
          name: "hidden",
          arguments: { secret: "hidden" },
          status: "completed"
        }
      ],
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
      cost: {
        inputCost: "0.000001",
        outputCost: "0.000001",
        totalCost: "0.000002",
        currency: "USD"
      },
      routing: { providerId: "provider-id", modelId: "model-id", decisionFactors: {} },
      metadata: { providerPayload: "hidden" }
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("toolCalls");
    expect(serialized).not.toContain("metadata");
    expect(serialized).not.toContain("hidden");
  });
});
