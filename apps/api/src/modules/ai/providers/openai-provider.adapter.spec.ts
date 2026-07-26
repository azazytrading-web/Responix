import { AiContractError } from "../contracts";
import { OpenAiProviderAdapter } from "./openai-provider.adapter";

describe("OpenAiProviderAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("normalizes a provider response without returning its raw payload", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
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
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const adapter = new OpenAiProviderAdapter();

    const result = await adapter.invoke(
      {
        requestId: "request-id",
        modelId: "model-id",
        modelName: "gpt-4.1-mini",
        apiBaseUrl: null,
        messages: [{ role: "user", content: "Hello" }],
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes provider failures without exposing provider payloads", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "sensitive provider detail" } }), {
        status: 401
      })
    );

    await expect(
      new OpenAiProviderAdapter().invoke(
        {
          requestId: "request-id",
          modelId: "model-id",
          modelName: "gpt-4.1-mini",
          apiBaseUrl: null,
          messages: [{ role: "user", content: "Hello" }],
          signal: new AbortController().signal
        },
        { id: "credential-id", secret: "provider-secret" }
      )
    ).rejects.toEqual(
      new AiContractError("AUTHENTICATION_FAILED", "AI provider authentication failed")
    );
  });
});
