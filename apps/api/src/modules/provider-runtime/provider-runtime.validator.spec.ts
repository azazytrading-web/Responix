import {
  ProviderRuntimeValidator,
  type ProviderCapabilityMetadata
} from "./provider-runtime.validator";

const capabilities = (overrides: Partial<ProviderCapabilityMetadata> = {}): ProviderCapabilityMetadata => ({
  maxInputTokens: 8000,
  maxOutputTokens: 2000,
  contextWindow: 10000,
  maxPromptBytes: 100000,
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  presencePenalty: { supported: true, min: -2, max: 2 },
  frequencyPenalty: { supported: true, min: -2, max: 2 },
  stopSequences: { supported: true, maxItems: 4 },
  vision: true,
  image: false,
  tools: true,
  structuredOutput: true,
  streaming: true,
  reasoning: false,
  ...overrides
});

describe("ProviderRuntimeValidator", () => {
  const validator = new ProviderRuntimeValidator();

  it("accepts a compatible vendor-neutral request", () => {
    expect(validator.validate({
      options: {
        estimatedInputTokens: 1000,
        maxOutputTokens: 500,
        temperature: 0.7,
        topP: 0.9,
        stopSequences: ["END"],
        vision: true,
        tools: true,
        structuredOutput: true
      },
      capabilities: capabilities(),
      promptSizeBytes: 1000
    })).toMatchObject({ valid: true, diagnostics: [] });
  });

  it.each([
    [{ estimatedInputTokens: 8001 }, "INPUT_TOKEN_LIMIT_EXCEEDED"],
    [{ estimatedInputTokens: 8000, maxOutputTokens: 2001 }, "OUTPUT_TOKEN_LIMIT_EXCEEDED"],
    [{ estimatedInputTokens: 1, temperature: 3 }, "TEMPERATURE_OUT_OF_RANGE"],
    [{ estimatedInputTokens: 1, topP: 2 }, "TOP_P_OUT_OF_RANGE"],
    [{ estimatedInputTokens: 1, presencePenalty: 3 }, "PRESENCE_PENALTY_OUT_OF_RANGE"],
    [{ estimatedInputTokens: 1, frequencyPenalty: -3 }, "FREQUENCY_PENALTY_OUT_OF_RANGE"],
    [{ estimatedInputTokens: 1, stopSequences: ["", "A"] }, "EMPTY_STOP_SEQUENCE"],
    [{ estimatedInputTokens: 1, stopSequences: ["A", "A"] }, "DUPLICATE_STOP_SEQUENCE"],
    [{ estimatedInputTokens: 1, image: true }, "IMAGE_UNSUPPORTED"],
    [{ estimatedInputTokens: 1, reasoning: true }, "REASONING_UNSUPPORTED"]
  ])("rejects incompatible option %#", (options, code) => {
    const result = validator.validate({
      options,
      capabilities: capabilities(),
      promptSizeBytes: 1000
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code })
    ]));
  });

  it("rejects combined input and output beyond the context window", () => {
    const result = validator.validate({
      options: { estimatedInputTokens: 8000, maxOutputTokens: 2000 },
      capabilities: capabilities({ contextWindow: 9000 }),
      promptSizeBytes: 1000
    });
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CONTEXT_WINDOW_EXCEEDED" })
    ]));
  });

  it("rejects oversized prompt metadata", () => {
    const result = validator.validate({
      options: { estimatedInputTokens: 1 },
      capabilities: capabilities(),
      promptSizeBytes: 100001
    });
    expect(result.diagnostics[0]).toMatchObject({ code: "PROMPT_SIZE_EXCEEDED" });
  });

  it("rejects unsupported penalty, stop, and capability metadata", () => {
    const result = validator.validate({
      options: {
        estimatedInputTokens: 1,
        presencePenalty: 1,
        frequencyPenalty: 1,
        stopSequences: ["END"],
        vision: true,
        tools: true,
        structuredOutput: true,
        streaming: true
      },
      capabilities: capabilities({
        presencePenalty: { supported: false, min: -2, max: 2 },
        frequencyPenalty: { supported: false, min: -2, max: 2 },
        stopSequences: { supported: false, maxItems: 0 },
        vision: false,
        tools: false,
        structuredOutput: false,
        streaming: false
      }),
      promptSizeBytes: 1
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "PRESENCE_PENALTY_UNSUPPORTED",
      "FREQUENCY_PENALTY_UNSUPPORTED",
      "STOP_SEQUENCES_UNSUPPORTED",
      "VISION_UNSUPPORTED",
      "TOOLS_UNSUPPORTED",
      "STRUCTURED_OUTPUT_UNSUPPORTED",
      "STREAMING_UNSUPPORTED"
    ]));
  });

  it("preserves source diagnostics", () => {
    const result = validator.validate({
      options: { estimatedInputTokens: 1 },
      capabilities: capabilities(),
      promptSizeBytes: 1,
      sourceDiagnostics: [{
        severity: "ERROR",
        code: "PROVIDER_NOT_READY",
        path: "provider",
        message: "Provider not ready"
      }]
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.diagnostics[0]?.code).toBe("PROVIDER_NOT_READY");
  });
});
