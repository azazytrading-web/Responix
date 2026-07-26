import { AiInvocationResponseDto, AiProviderResponseDto } from "./ai-response.dto";

describe("AI response DTOs", () => {
  it("omits provider configuration, base URLs, and authentication metadata", () => {
    const response = AiProviderResponseDto.from({
      id: "provider-id",
      providerName: "Provider",
      apiBaseUrl: "https://provider.internal",
      authenticationType: "secret",
      status: "ACTIVE",
      priority: 1,
      configuration: { enabled: true, settings: { secret: "hidden" } },
      models: []
    });

    const serialized = JSON.stringify(response);
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
