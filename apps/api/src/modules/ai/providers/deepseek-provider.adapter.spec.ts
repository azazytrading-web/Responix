/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { AiContractError } from "../contracts";
import type { ProviderExecutionRequest } from "../contracts";
import { ProviderDestinationRejectedError } from "../security/provider-destination-policy.service";
import {
  ProviderNetworkTimeoutError, ProviderResponseTooLargeError
} from "../security/provider-http-client.service";
import {
  DEEPSEEK_CAPABILITIES, DeepSeekProviderAdapter
} from "./deepseek-provider.adapter";
import { ProviderRegistry } from "./provider.registry";

const request = (
  overrides: Partial<ProviderExecutionRequest> = {}
): ProviderExecutionRequest => ({
  requestId: "request", modelId: "model", modelName: "deepseek-chat",
  apiBaseUrl: null,
  messages: [
    { role: "system", content: "Be concise" },
    { role: "user", content: "Hello" }
  ],
  maxOutputTokens: 100, signal: new AbortController().signal, ...overrides
});
const credential = { id: "credential", secret: "deepseek-secret" };
const response = {
  choices: [{ message: { content: "DeepSeek response" }, finish_reason: "stop" }],
  usage: {
    prompt_tokens: 8, completion_tokens: 3,
    prompt_tokens_details: { cached_tokens: 2 }
  }
};

describe("DeepSeekProviderAdapter", () => {
  it("normalizes DeepSeek Chat requests through the secured transport", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200, body: JSON.stringify(response), bytes: 100
    });
    const result = await new DeepSeekProviderAdapter({ postJson } as never)
      .invoke(request(), credential);
    expect(result).toEqual({
      content: "DeepSeek response", finishReason: "stop",
      usage: { inputTokens: 8, outputTokens: 3, cachedTokens: 2 }
    });
    expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
      provider: "DeepSeek",
      url: "https://api.deepseek.com/chat/completions",
      authorization: "Bearer deepseek-secret",
      signal: expect.any(AbortSignal)
    }));
    const body = JSON.parse(postJson.mock.calls[0]?.[0].body as string);
    expect(body).toEqual({
      model: "deepseek-chat", messages: request().messages,
      max_tokens: 100, stream: false
    });
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("functions");
    expect(body).not.toHaveProperty("cache");
  });
  it("honors a configured base URL through the existing HTTPS client", async () => {
    const postJson = jest.fn().mockResolvedValue({
      status: 200, body: JSON.stringify(response)
    });
    await new DeepSeekProviderAdapter({ postJson } as never).invoke(request({
      apiBaseUrl: "https://gateway.example.com/deepseek/"
    }), credential);
    expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://gateway.example.com/deepseek/chat/completions"
    }));
  });
  it.each([
    "deepseek-chat", "deepseek-chat-v3", "deepseek-chat:2026-07", "deepseek-chat.latest"
  ])("supports extensible DeepSeek Chat model names: %s", (modelName) => {
    expect(new DeepSeekProviderAdapter({} as never).supportsModel(modelName)).toBe(true);
  });
  it.each(["deepseek-reasoner", "other-chat", "", "deepseek-chat/unsafe"])(
    "rejects an incompatible model: %s", async (modelName) => {
      const adapter = new DeepSeekProviderAdapter({ postJson: jest.fn() } as never);
      await expect(adapter.invoke(request({ modelName }), credential)).rejects.toEqual(
        new AiContractError(
          "INVALID_REQUEST", "DeepSeek adapter requires a compatible DeepSeek Chat model"
        )
      );
    }
  );
  it("rejects output reservations above the declared capability", async () => {
    const adapter = new DeepSeekProviderAdapter({ postJson: jest.fn() } as never);
    await expect(adapter.invoke(request({ maxOutputTokens: 8_193 }), credential))
      .rejects.toMatchObject({ code: "CONTEXT_LIMIT_EXCEEDED" });
  });
  it("exposes immutable non-streaming chat capabilities", () => {
    expect(Object.isFrozen(DEEPSEEK_CAPABILITIES)).toBe(true);
    expect(DEEPSEEK_CAPABILITIES).toMatchObject({
      chatCompletions: true, streaming: false, tools: false,
      functionCalling: false, maximumOutputTokens: 8_192
    });
  });
  it.each([
    [401, "AUTHENTICATION_FAILED"], [403, "AUTHENTICATION_FAILED"],
    [408, "PROVIDER_UNAVAILABLE"], [429, "RATE_LIMITED"], [500, "PROVIDER_UNAVAILABLE"]
  ])("normalizes HTTP status %s as %s", async (status, code) => {
    const adapter = new DeepSeekProviderAdapter({
      postJson: jest.fn().mockResolvedValue({ status, body: "{}" })
    } as never);
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({ code });
  });
  it.each([
    [new ProviderNetworkTimeoutError("provider"), "PROVIDER_UNAVAILABLE"],
    [new ProviderResponseTooLargeError(), "RESPONSE_INVALID"],
    [new ProviderDestinationRejectedError("rejected"), "PROVIDER_UNAVAILABLE"]
  ])("normalizes transport errors without leaking details", async (error, code) => {
    const adapter = new DeepSeekProviderAdapter({
      postJson: jest.fn().mockRejectedValue(error)
    } as never);
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({ code });
  });
  it("propagates cancellation through the request signal", async () => {
    const controller = new AbortController(); controller.abort();
    const adapter = new DeepSeekProviderAdapter({
      postJson: jest.fn().mockRejectedValue(new Error("network"))
    } as never);
    await expect(adapter.invoke(request({ signal: controller.signal }), credential))
      .rejects.toMatchObject({ name: "AbortError" });
  });
  it("rejects malformed responses and excess usage", async () => {
    const invalid = new DeepSeekProviderAdapter({
      postJson: jest.fn().mockResolvedValue({ status: 200, body: "{\"secret\":\"value\"}" })
    } as never);
    await expect(invalid.invoke(request(), credential)).rejects.toMatchObject({
      code: "RESPONSE_INVALID"
    });
    const excessive = new DeepSeekProviderAdapter({
      postJson: jest.fn().mockResolvedValue({
        status: 200, body: JSON.stringify({
          ...response, usage: { prompt_tokens: 1, completion_tokens: 101 }
        })
      })
    } as never);
    await expect(excessive.invoke(request(), credential)).rejects.toMatchObject({
      code: "RESPONSE_INVALID"
    });
  });
  it("registers as a native provider under the vendor-neutral contract", () => {
    const adapter = new DeepSeekProviderAdapter({} as never);
    const registry = new ProviderRegistry([adapter]);
    expect(registry.has("DeepSeek")).toBe(true);
    expect(registry.get("DeepSeek")).toBe(adapter);
  });
});
