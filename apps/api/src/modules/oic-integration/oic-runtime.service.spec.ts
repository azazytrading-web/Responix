import type { ConfigService } from "@nestjs/config";
import { OicRuntimeService } from "./oic-runtime.service";

describe("OicRuntimeService", () => {
  const response = {
    object: "oic.runtime.response", id: "resp-1", model: "oi-support-v1", output: [{
      role: "assistant", content: [{ type: "text", text: "hello" }]
    }], finishReason: "completed", usage: { inputTokens: 11, outputTokens: 3 },
    createdAt: new Date().toISOString(), requestId: "oic-req-1", traceId: "trace-1",
    execution: { runtimeVersion: "1", durationMs: 9 }
  };
  const setup = (values: Record<string, unknown> = {}) => {
    const config = { get: jest.fn((key: string) => ({
      "oic.baseUrl": "http://oic.internal", "oic.serviceCredential": "service-secret", "oic.timeoutMs": 1000,
      ...values
    }[key])) } as unknown as ConfigService;
    return new OicRuntimeService(config);
  };
  const input = {
    workspaceId: "workspace-A", conversationId: "conversation-A", requestId: "request-A",
    traceId: "trace-A", oiModelKey: "oi-support-v1",
    messages: [{ role: "system" as const, content: "You are helpful." }, { role: "user" as const, content: "hello" }]
  };

  afterEach(() => jest.restoreAllMocks());

  it("uses the deployment service credential and resolves only the canonical workspace external reference", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(response), { status: 200 })));
    const result = await setup().invoke(input);
    const [url, init] = fetch.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    const body = JSON.parse(init?.body as string) as {
      tenant: { kind: string; sourceType: string; externalId: string };
      model: string;
      input: Array<{ speaker: string }>;
    };
    expect(url).toBe("http://oic.internal/api/v1/runtime/invocations");
    expect(headers.get("authorization")).toBe("Bearer service-secret");
    expect(body.tenant).toEqual({ kind: "external-reference", sourceType: "RESPONIX_WORKSPACE", externalId: "workspace-A" });
    expect(body.model).toBe("oi-support-v1");
    expect(body.input[0]!.speaker).toBe("instruction");
    expect(headers.get("idempotency-key")).toBeTruthy();
    expect(result.answer).toBe("hello");
  });

  it("does not accept a request or customer credential and fails closed when service config is absent", async () => {
    await expect(setup({ "oic.serviceCredential": undefined }).invoke(input)).rejects.toMatchObject({ status: 503 });
  });

  it("maps revoked, wrong-application, and missing-scope auth failures without returning OIC details", async () => {
    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: {
        code: "AUTHENTICATION_FAILED", message: "revoked service-secret"
      } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: {
        code: "AUTHORIZATION_DENIED", message: "private detail service-secret"
      } }), { status: 403 }));
    const revoked = await setup().invoke(input).catch((error: unknown) => error);
    expect(revoked).toMatchObject({ status: 503, response: { code: "OIC_AUTHENTICATION_FAILED" } });
    const failure = await setup().invoke({ ...input, workspaceId: "workspace-B" }).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      status: 503, response: { code: "OIC_AUTHORIZATION_DENIED", message: "OIC service authorization is unavailable." }
    });
    expect(JSON.stringify(failure)).not.toContain("service-secret");
  });

  it("rejects invalid model identities before making a network request", async () => {
    const fetch = jest.spyOn(globalThis, "fetch");
    await expect(setup().invoke({ ...input, oiModelKey: "gpt-4o" })).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unbounded context before calling OIC", async () => {
    const fetch = jest.spyOn(globalThis, "fetch");
    await expect(setup().invoke({ ...input, messages: [{ role: "user", content: "x".repeat(120_001) }] }))
      .rejects.toMatchObject({ status: 400, response: { code: "OIC_CONTEXT_LIMIT_EXCEEDED" } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("derives isolated idempotency keys for separate workspace requests", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(response), { status: 200 })));
    await setup().invoke(input);
    await setup().invoke({ ...input, workspaceId: "workspace-B" });
    const first = new Headers(fetch.mock.calls[0]![1]?.headers).get("idempotency-key");
    const second = new Headers(fetch.mock.calls[1]![1]?.headers).get("idempotency-key");
    expect(first).not.toBe(second);
  });

  it("lists only Oi identities from the authenticated OIC model catalog", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ object: "list", data: [
      { id: "oi-support-v1", object: "model", owned_by: "oi" },
      { id: "private-upstream-model", object: "model", owned_by: "provider" }
    ] }), { status: 200 }));
    await expect(setup().listVisibleModels()).resolves.toEqual([{ id: "oi-support-v1", object: "model", owned_by: "oi" }]);
  });
});
