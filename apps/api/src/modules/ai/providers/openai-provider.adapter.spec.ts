import { AiContractError } from "../contracts";
import { OpenAiProviderAdapter } from "./openai-provider.adapter";
import { ProviderDestinationRejectedError } from "../security/provider-destination-policy.service";

describe("OpenAiProviderAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("normalizes a provider response without returning its raw payload", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        choices: [
          {
            message: { content: "Hello" },
            finish_reason: "stop",
            provider_only: "not-returned"
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 4,
          prompt_tokens_details: { cached_tokens: 2 }
        },
        provider_only: "not-returned"
      }),
      bytes: 1
    });
    const adapter = new OpenAiProviderAdapter({ postJson } as never);

    const result = await adapter.invoke(
      {
        requestId: "request-id",
        modelId: "model-id",
        modelName: "gpt-4.1-mini",
        apiBaseUrl: null,
        messages: [{ role: "user", content: "Hello" }],
        maxOutputTokens: 100,
        signal: new AbortController().signal
      },
      { id: "credential-id", secret: "provider-secret" }
    );

    expect(result).toEqual({
      content: "Hello",
      finishReason: "stop",
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        cachedTokens: 2
      }
    });
    expect(JSON.stringify(result)).not.toContain("provider-secret");
    expect(postJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "OpenAI",
        url: "https://api.openai.com/v1/chat/completions",
        authorization: "Bearer provider-secret",
        body: expect.stringContaining('"max_tokens":100') as string
      })
    );
  });

  it("rejects output usage above the enforced maximum", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        choices: [{ message: { content: "oversized" }, finish_reason: "length" }],
        usage: { prompt_tokens: 1, completion_tokens: 101 }
      }),
      bytes: 1
    });

    await expect(
      new OpenAiProviderAdapter({ postJson } as never).invoke(
        {
          requestId: "request-id",
          modelId: "model-id",
          modelName: "gpt-4.1-mini",
          apiBaseUrl: null,
          messages: [{ role: "user", content: "Hello" }],
          maxOutputTokens: 100,
          signal: new AbortController().signal
        },
        { id: "credential-id", secret: "provider-secret" }
      )
    ).rejects.toThrow("AI provider output exceeded the reserved token limit");
  });

  it("normalizes provider failures without exposing provider payloads", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 401,
      body: JSON.stringify({ error: { message: "sensitive provider detail" } }),
      bytes: 1
    });

    await expect(
      new OpenAiProviderAdapter({ postJson } as never).invoke(
        {
          requestId: "request-id",
          modelId: "model-id",
          modelName: "gpt-4.1-mini",
          apiBaseUrl: null,
          messages: [{ role: "user", content: "Hello" }],
          maxOutputTokens: 100,
          signal: new AbortController().signal
        },
        { id: "credential-id", secret: "provider-secret" }
      )
    ).rejects.toEqual(
      new AiContractError("AUTHENTICATION_FAILED", "AI provider authentication failed")
    );
  });

  it("returns only the stable external error when a destination is rejected", async () => {
    const postJson = jest
      .fn()
      .mockRejectedValue(new ProviderDestinationRejectedError("Resolved to 127.0.0.1"));

    await expect(
      new OpenAiProviderAdapter({ postJson } as never).invoke(
        {
          requestId: "request-id",
          modelId: "model-id",
          modelName: "gpt-4.1-mini",
          apiBaseUrl: "https://api.openai.com/v1",
          messages: [{ role: "user", content: "Hello" }],
          maxOutputTokens: 100,
          signal: new AbortController().signal
        },
        { id: "credential-id", secret: "provider-secret" }
      )
    ).rejects.toEqual(
      new AiContractError("PROVIDER_UNAVAILABLE", "Provider destination rejected.")
    );
  });
});
