import { AiContractError } from "../contracts";
import { streamOpenAiCompatible } from "./openai-compatible-stream";

describe("streamOpenAiCompatible", () => {
  it("classifies an ended stream without its terminal marker as retryable", async () => {
    const http = { postSse: jest.fn().mockResolvedValue({ status: 200 }) };

    await expect(streamOpenAiCompatible({
      http: http as never,
      provider: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      request: {
        requestId: "request-id", modelId: "model-id", modelName: "model",
        apiBaseUrl: null, messages: [{ role: "user", content: "Hello" }],
        maxOutputTokens: 100, signal: new AbortController().signal
      },
      credential: { id: "credential-id", secret: "secret" },
      emit: jest.fn().mockResolvedValue(undefined)
    })).rejects.toEqual(new AiContractError(
      "PROVIDER_UNAVAILABLE", "Provider stream disconnected before completion", { retryable: true }
    ));
  });
});
