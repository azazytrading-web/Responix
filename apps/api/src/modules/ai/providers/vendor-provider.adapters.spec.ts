/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { AiContractError } from "../contracts";
import type { ProviderExecutionRequest } from "../contracts";
import { AnthropicProviderAdapter } from "./anthropic-provider.adapter";
import { AzureOpenAiProviderAdapter } from "./azure-openai-provider.adapter";
import { GeminiProviderAdapter } from "./gemini-provider.adapter";
import { OpenRouterProviderAdapter } from "./openrouter-provider.adapter";

const request = (overrides: Partial<ProviderExecutionRequest> = {}): ProviderExecutionRequest => ({
  requestId: "request", modelId: "model", modelName: "model-name", apiBaseUrl: null,
  messages: [{ role: "system", content: "Be concise" }, { role: "user", content: "Hello" }],
  maxOutputTokens: 100, signal: new AbortController().signal, ...overrides
});
const credential = { id: "credential", secret: "secret-value" };
const openAiPayload = {
  choices: [{ message: { content: "Hello" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 5, completion_tokens: 2 }
};

describe("Vendor provider adapters", () => {
  it("normalizes Claude requests, headers, content, and usage", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200, body: JSON.stringify({
        content: [{ type: "text", text: "Claude response" }], stop_reason: "end_turn",
        usage: { input_tokens: 7, output_tokens: 3, cache_read_input_tokens: 2 }
      })
    });
    const result = await new AnthropicProviderAdapter({ postJson } as never)
      .invoke(request(), credential);
    expect(result).toEqual({
      content: "Claude response", finishReason: "end_turn",
      usage: { inputTokens: 7, outputTokens: 3, cachedTokens: 2 }
    });
    expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
      provider: "Claude",
      headers: expect.objectContaining({
        "x-api-key": "secret-value", "anthropic-version": "2023-06-01"
      }),
      body: expect.stringContaining('"max_tokens":100')
    }));
  });
  it("normalizes Gemini requests, headers, content, and usage", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200, body: JSON.stringify({
        candidates: [{
          content: { parts: [{ text: "Gemini response" }] }, finishReason: "STOP"
        }],
        usageMetadata: {
          promptTokenCount: 6, candidatesTokenCount: 4, cachedContentTokenCount: 1
        }
      })
    });
    const result = await new GeminiProviderAdapter({ postJson } as never)
      .invoke(request(), credential);
    expect(result).toEqual({
      content: "Gemini response", finishReason: "STOP",
      usage: { inputTokens: 6, outputTokens: 4, cachedTokens: 1 }
    });
    expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
      provider: "Gemini", headers: { "x-goog-api-key": "secret-value" },
      url: expect.stringContaining("models/model-name:generateContent")
    }));
  });
  it("normalizes Azure OpenAI requests without placing credentials in URLs", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200, body: JSON.stringify(openAiPayload), bytes: 100
    });
    await expect(new AzureOpenAiProviderAdapter({ postJson } as never).invoke(request({
      apiBaseUrl: "https://tenant.openai.azure.com"
    }), credential)).resolves.toMatchObject({
      content: "Hello", usage: { inputTokens: 5, outputTokens: 2 }
    });
    const input = postJson.mock.calls[0]?.[0] as { url: string; headers: Record<string, string> };
    expect(input.url).toContain("api-version=2024-10-21");
    expect(input.url).not.toContain(credential.secret);
    expect(input.headers).toEqual({ "api-key": credential.secret });
  });
  it("normalizes OpenRouter through the OpenAI-compatible contract", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200, body: JSON.stringify(openAiPayload), bytes: 100
    });
    await expect(new OpenRouterProviderAdapter({ postJson } as never)
      .invoke(request(), credential)).resolves.toMatchObject({ content: "Hello" });
    expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
      provider: "OpenRouter", authorization: "Bearer secret-value",
      url: "https://openrouter.ai/api/v1/chat/completions"
    }));
  });
  it.each([
    [401, "AUTHENTICATION_FAILED"], [403, "AUTHENTICATION_FAILED"],
    [429, "RATE_LIMITED"], [500, "PROVIDER_UNAVAILABLE"]
  ])("normalizes HTTP status %s as %s", async (status, code) => {
    const adapter = new OpenRouterProviderAdapter({
      postJson: jest.fn().mockResolvedValue({ status, body: "{}", bytes: 2 })
    } as never);
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({ code });
  });
  it("rejects invalid vendor JSON without leaking the response", async () => {
    const adapter = new AnthropicProviderAdapter({
      postJson: jest.fn().mockResolvedValue({ status: 200, body: "{\"secret\":\"value\"}" })
    } as never);
    await expect(adapter.invoke(request(), credential)).rejects.toEqual(
      new AiContractError("RESPONSE_INVALID", "AI provider response was invalid")
    );
  });
  it("rejects output usage above the reserved limit", async () => {
    const adapter = new GeminiProviderAdapter({
      postJson: jest.fn().mockResolvedValue({
        status: 200, body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: "too much" }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 101 }
        })
      })
    } as never);
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({
      code: "RESPONSE_INVALID"
    });
  });
  it("requires an explicit Azure endpoint", async () => {
    await expect(new AzureOpenAiProviderAdapter({ postJson: jest.fn() } as never)
      .invoke(request(), credential)).rejects.toThrow("requires a configured HTTPS endpoint");
  });
  it("normalizes transport cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter = new OpenRouterProviderAdapter({
      postJson: jest.fn().mockRejectedValue(new Error("network"))
    } as never);
    await expect(adapter.invoke(request({ signal: controller.signal }), credential))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
