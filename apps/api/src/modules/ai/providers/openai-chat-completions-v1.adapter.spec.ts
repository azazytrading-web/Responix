import { AiContractError } from "../contracts";
import { ProviderNetworkTimeoutError } from "../security/provider-http-client.service";
import type { ProviderHttpClient } from "../security/provider-http-client.service";
import { ProviderRegistry } from "./provider.registry";
import { OpenAiChatCompletionsV1Adapter } from "./openai-chat-completions-v1.adapter";

const providerScope = { workspaceId: "workspace-a", providerId: "custom-a", supportsStreaming: true, supportsTools: true };
const request = (patch: Record<string, unknown> = {}) => ({
  requestId: "request-a", modelId: "custom-model", modelName: "custom-model", apiBaseUrl: "https://custom.example/v1/",
  messages: [{ role: "user", content: "hello" }], maxOutputTokens: 128,
  signal: new AbortController().signal, customProvider: providerScope, ...patch
}) as never;
const credential = { id: "credential-a", secret: "secret-do-not-log" };
const response = (body: unknown) => ({ status: 200, body: JSON.stringify(body), bytes: 1 });
const assistant = (content: string | null, usage?: Record<string, unknown>) => ({
  choices: [{ message: { content }, finish_reason: "stop" }], ...(usage ? { usage } : {})
});

describe("OpenAiChatCompletionsV1Adapter", () => {
  type PostJsonInput = Parameters<ProviderHttpClient["postJson"]>[0];
  type PostSseInput = Parameters<ProviderHttpClient["postSse"]>[0];
  let http: {
    postJson: jest.Mock<ReturnType<ProviderHttpClient["postJson"]>, [PostJsonInput]>;
    postSse: jest.Mock<ReturnType<ProviderHttpClient["postSse"]>, [PostSseInput]>;
  };
  let adapter: OpenAiChatCompletionsV1Adapter;

  beforeEach(() => {
    http = {
      postJson: jest.fn<ReturnType<ProviderHttpClient["postJson"]>, Parameters<ProviderHttpClient["postJson"]>>()
        .mockResolvedValue(response(assistant("hello", { prompt_tokens: 4, completion_tokens: 2 }))),
      postSse: jest.fn<ReturnType<ProviderHttpClient["postSse"]>, Parameters<ProviderHttpClient["postSse"]>>()
        .mockResolvedValue({ status: 200 })
    };
    adapter = new OpenAiChatCompletionsV1Adapter(http as never);
  });

  it("registers under the approved semantic protocol identifier", () => {
    expect(adapter.protocolId).toBe("openai-chat-completions-v1");
    expect(new ProviderRegistry([adapter]).get("openai-chat-completions-v1")).toBe(adapter);
  });

  it("joins the configured API root with exactly one fixed Chat Completions path and sends bearer auth", async () => {
    await adapter.invoke(request(), credential);
    const call = http.postJson.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("HTTP request was not captured");
    expect(call.url).toBe("https://custom.example/v1/chat/completions");
    expect(call.authorization).toBe("Bearer secret-do-not-log");
    expect(call.customProvider).toEqual({ workspaceId: "workspace-a", providerId: "custom-a", requiresTools: false });
    expect(JSON.parse(call.body)).toEqual({ model: "custom-model", messages: [{ role: "user", content: "hello" }], max_tokens: 128 });
    expect(call.body).not.toContain("secret-do-not-log");
  });

  it("passes the private validation-only disabled-state allowance to destination authorization", async () => {
    await adapter.invoke(request({
      customProvider: { ...providerScope, allowDisabledForValidation: true },
      maxOutputTokens: 8,
      tools: undefined
    }), credential);
    const call = http.postJson.mock.calls[0]?.[0];
    expect(call?.customProvider).toEqual({
      workspaceId: "workspace-a", providerId: "custom-a", allowDisabledForValidation: true, requiresTools: false
    });
  });

  it("normalizes content and optional usage, including empty content", async () => {
    await expect(adapter.invoke(request(), credential)).resolves.toMatchObject({
      content: "hello", usage: { inputTokens: 4, outputTokens: 2 }, finishReason: "stop"
    });
    http.postJson.mockResolvedValueOnce(response(assistant(null)));
    await expect(adapter.invoke(request(), credential)).resolves.toMatchObject({
      content: "", usage: { inputTokens: 0, outputTokens: 0 }
    });
  });

  it("normalizes valid tool-call response only when declared", async () => {
    const payload = { choices: [{ message: { content: null, tool_calls: [
      { id: "call-1", function: { name: "lookup", arguments: "{\"q\":\"x\"}" } }
    ] } }], usage: { prompt_tokens: 2, completion_tokens: 3 } };
    http.postJson.mockResolvedValueOnce(response(payload));
    await expect(adapter.invoke(request({ tools: [{ name: "lookup", description: "lookup", inputSchema: { type: "object" } }] }), credential))
      .resolves.toMatchObject({ toolCalls: [{ id: "call-1", name: "lookup", arguments: { q: "x" } }] });
    await expect(adapter.invoke(request({ customProvider: { ...providerScope, supportsTools: false }, tools: [{ name: "lookup" }] }), credential))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("rejects malformed response structures and invalid tool arguments", async () => {
    http.postJson.mockResolvedValueOnce(response({ nope: true }));
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({ code: "RESPONSE_INVALID" });
    http.postJson.mockResolvedValueOnce(response({ choices: [{ message: { content: null, tool_calls: [
      { id: "call-1", function: { name: "lookup", arguments: "[]" } }
    ] } }] }));
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({ code: "RESPONSE_INVALID" });
  });

  it.each([
    [400, "PROVIDER_UNAVAILABLE", false], [401, "AUTHENTICATION_FAILED", null],
    [403, "AUTHENTICATION_FAILED", null], [404, "PROVIDER_UNAVAILABLE", false],
    [429, "RATE_LIMITED", true], [500, "PROVIDER_UNAVAILABLE", true]
  ])("normalizes HTTP %s with existing retry classification", async (status, code, retryable) => {
    http.postJson.mockResolvedValueOnce({ status, body: "{}", bytes: 2 });
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({
      code, ...(retryable === null ? {} : { metadata: { retryable } })
    });
  });

  it.each([401, 429, 503])("preserves only the numeric provider status for safe validation evidence (%s)", async (status) => {
    http.postJson.mockResolvedValueOnce({ status, body: "{}", bytes: 2 });
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({
      metadata: { providerStatus: status }
    });
  });

  it("normalizes timeout and cancellation without retrying user cancellation", async () => {
    http.postJson.mockRejectedValueOnce(new ProviderNetworkTimeoutError("provider"));
    await expect(adapter.invoke(request(), credential)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", metadata: { retryable: true } });
    const controller = new AbortController(); controller.abort();
    http.postJson.mockRejectedValueOnce(new Error("aborted"));
    await expect(adapter.invoke(request({ signal: controller.signal }), credential)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fails closed without trusted custom-provider context or for unsupported capabilities", async () => {
    await expect(adapter.invoke(request({ customProvider: undefined }), credential)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(() => adapter.stream(request({ customProvider: { ...providerScope, supportsStreaming: false } }), credential, jest.fn()))
      .toThrow("Custom Provider has not declared streaming support");
    expect(http.postJson).not.toHaveBeenCalled();
    expect(http.postSse).not.toHaveBeenCalled();
  });

  it("uses the existing SSE parser and passes scoped authorization with [DONE] completion", async () => {
    http.postSse.mockImplementationOnce(async (input: { onEvent: (event: { data: string }) => Promise<void> }) => {
      await input.onEvent({ data: JSON.stringify({ choices: [{ delta: { content: "hi" } }] }) });
      await input.onEvent({ data: "[DONE]" });
      return { status: 200 };
    });
    const emit = jest.fn().mockResolvedValue(undefined);
    await adapter.stream(request(), credential, emit);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: "delta", content: "hi" }));
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ type: "completed" }));
    const input = http.postSse.mock.calls[0]?.[0];
    expect(input).toBeDefined();
    if (!input) throw new Error("SSE request was not captured");
    expect(input.url).toBe("https://custom.example/v1/chat/completions");
    expect(input.customProvider).toEqual({ workspaceId: "workspace-a", providerId: "custom-a", requiresStreaming: true, requiresTools: false });
    expect(input.authorization).toBe("Bearer secret-do-not-log");
  });

  it("rejects an SSE response without [DONE] as retryable and maps transport failures", async () => {
    await expect(adapter.stream(request(), credential, jest.fn())).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", metadata: { retryable: true } });
    http.postSse.mockRejectedValueOnce(new Error("private data"));
    await expect(adapter.stream(request(), credential, jest.fn())).rejects.toBeInstanceOf(AiContractError);
  });

  it("normalizes streamed tool deltas and rejects malformed SSE JSON", async () => {
    http.postSse.mockImplementationOnce(async (input: { onEvent: (event: { data: string }) => Promise<void> }) => {
      await input.onEvent({ data: JSON.stringify({ choices: [{ delta: { tool_calls: [
        { index: 0, id: "call-1", function: { name: "lookup", arguments: "{\"q\":" } }
      ] } }] }) });
      await input.onEvent({ data: JSON.stringify({ choices: [{ delta: { tool_calls: [
        { index: 0, function: { arguments: "\"x\"}" } }
      ] } }] }) });
      await input.onEvent({ data: "[DONE]" });
      return { status: 200 };
    });
    const emit = jest.fn().mockResolvedValue(undefined);
    await adapter.stream(request({ tools: [{ name: "lookup", description: "lookup", inputSchema: { type: "object" } }] }), credential, emit);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      toolCall: { id: "call-1", name: "lookup", arguments: { q: "x" }, status: "pending" }
    }));

    http.postSse.mockImplementationOnce(async (input: { onEvent: (event: { data: string }) => Promise<void> }) => {
      await input.onEvent({ data: "not-json" });
      return { status: 200 };
    });
    await expect(adapter.stream(request(), credential, jest.fn())).rejects.toMatchObject({ code: "RESPONSE_INVALID" });
  });
});
