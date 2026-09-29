import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { ProviderExecutionCredential, ProviderExecutionRequest, ProviderExecutionResult } from "../contracts";
import { CustomProviderValidationService } from "./custom-provider-validation.service";

type ValidationCredentialOperation = (credential: ProviderExecutionCredential) => Promise<void>;
type UseValidationCredential = (workspaceId: string, providerId: string, operation: ValidationCredentialOperation) => Promise<void>;
type InvokeProvider = (request: ProviderExecutionRequest, credential: ProviderExecutionCredential) => Promise<ProviderExecutionResult>;

describe("CustomProviderValidationService", () => {
  const provider = {
    id: "provider-1",
    workspaceId: "workspace-1",
    displayName: "Saved provider",
    protocolId: "openai-chat-completions-v1",
    baseUrl: "https://custom.example/v1",
    validationModelId: "small-test-model",
    supportsStreaming: false,
    supportsTools: false,
    status: "ACTIVE",
    archivedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };

  let providers: { get: jest.Mock };
  let credentials: { useCredentialForValidation: jest.MockedFunction<UseValidationCredential> };
  let adapter: { invoke: jest.MockedFunction<InvokeProvider>; stream: jest.Mock };
  let registry: { get: jest.Mock };
  let validations: { record: jest.Mock };
  let service: CustomProviderValidationService;

  beforeEach(() => {
    providers = { get: jest.fn().mockResolvedValue({ ...provider }) };
    credentials = {
      useCredentialForValidation: jest.fn(async (_workspaceId: string, _providerId: string, use: ValidationCredentialOperation) => {
        await use({ id: "credential-1", secret: "unit-test-secret" });
      })
    };
    adapter = {
      invoke: jest.fn<ReturnType<InvokeProvider>, Parameters<InvokeProvider>>()
        .mockResolvedValue({ content: "OK", usage: { inputTokens: 2, outputTokens: 1 } }),
      stream: jest.fn()
    };
    registry = { get: jest.fn().mockReturnValue(adapter) };
    validations = { record: jest.fn().mockResolvedValue({ checkedAt: new Date("2026-09-29T00:00:00.000Z") }) };
    service = new CustomProviderValidationService(
      providers as never, credentials as never, registry as never, validations as never
    );
  });

  it.each(["ACTIVE", "DISABLED"])("validates a saved %s provider with one bounded non-streaming request", async (status) => {
    providers.get.mockResolvedValue({ ...provider, status, supportsStreaming: true, supportsTools: true });
    const response = await service.validate("workspace-1", "actor-1", "provider-1");
    expect(response).toMatchObject({
      providerId: "provider-1", protocolId: "openai-chat-completions-v1", available: true,
      checkedAt: "2026-09-29T00:00:00.000Z"
    });
    expect(providers.get).toHaveBeenCalledWith("workspace-1", "provider-1");
    expect(registry.get).toHaveBeenCalledWith("openai-chat-completions-v1");
    expect(credentials.useCredentialForValidation).toHaveBeenCalledTimes(1);
    expect(adapter.invoke).toHaveBeenCalledTimes(1);
    expect(adapter.invoke).toHaveBeenCalledWith(expect.objectContaining({
      modelId: "small-test-model",
      modelName: "small-test-model",
      apiBaseUrl: "https://custom.example/v1",
      messages: [{ role: "user", content: "Reply OK." }],
      maxOutputTokens: 8,
      customProvider: {
        workspaceId: "workspace-1", providerId: "provider-1", supportsStreaming: true, supportsTools: true,
        allowDisabledForValidation: true
      }
    }), { id: "credential-1", secret: "unit-test-secret" });
    const request = adapter.invoke.mock.calls[0]?.[0];
    if (!request) throw new Error("Provider validation request was not captured");
    expect(request.tools).toBeUndefined();
    expect(adapter.stream).not.toHaveBeenCalled();
    expect(validations.record).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace-1", actorId: "actor-1", customProviderId: "provider-1",
      protocolId: "openai-chat-completions-v1", available: true
    }));
    expect(JSON.stringify([validations.record.mock.calls, response])).not.toContain("unit-test-secret");
  });

  it("rejects archived providers without invoking or selecting credentials", async () => {
    providers.get.mockResolvedValue({ ...provider, status: "ARCHIVED" });
    await expect(service.validate("workspace-1", "actor-1", "provider-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(credentials.useCredentialForValidation).not.toHaveBeenCalled();
    expect(adapter.invoke).not.toHaveBeenCalled();
    expect(validations.record).not.toHaveBeenCalled();
  });

  it("does not reveal a provider from another workspace", async () => {
    providers.get.mockRejectedValue(new NotFoundException("Custom Provider was not found"));
    await expect(service.validate("workspace-other", "actor-other", "provider-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(credentials.useCredentialForValidation).not.toHaveBeenCalled();
    expect(adapter.invoke).not.toHaveBeenCalled();
    expect(validations.record).not.toHaveBeenCalled();
  });

  it("records missing or inactive credentials as a safe failed validation", async () => {
    credentials.useCredentialForValidation.mockRejectedValue(
      new AiContractError("CREDENTIAL_UNAVAILABLE", "No active provider credential found")
    );
    await expect(service.validate("workspace-1", "actor-1", "provider-1")).resolves.toMatchObject({
      available: false, errorCode: "CREDENTIAL_UNAVAILABLE"
    });
    expect(adapter.invoke).not.toHaveBeenCalled();
    expect(validations.record).toHaveBeenCalledWith(expect.objectContaining({ available: false, errorCode: "CREDENTIAL_UNAVAILABLE" }));
  });

  it.each([
    ["unsupported saved protocol", { ...provider, protocolId: "unknown-protocol" }, "PROVIDER_UNAVAILABLE"],
    ["invalid saved state", { ...provider, status: "BROKEN" }, "PROVIDER_UNAVAILABLE"]
  ])("fails closed for %s", async (_label, savedProvider, errorCode) => {
    providers.get.mockResolvedValue(savedProvider);
    await expect(service.validate("workspace-1", "actor-1", "provider-1")).resolves.toMatchObject({
      available: false, errorCode
    });
    expect(registry.get).not.toHaveBeenCalled();
    expect(credentials.useCredentialForValidation).not.toHaveBeenCalled();
    expect(adapter.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["destination policy rejection", new AiContractError("PROVIDER_UNAVAILABLE", "Provider destination rejected")],
    ["authentication failure", new AiContractError("AUTHENTICATION_FAILED", "Authentication failed", { providerStatus: 401 })],
    ["invalid model response", new AiContractError("RESPONSE_INVALID", "Provider response was invalid")],
    ["rate limit", new AiContractError("RATE_LIMITED", "Rate limited", { providerStatus: 429 })],
    ["timeout", new AiContractError("PROVIDER_UNAVAILABLE", "Timed out")],
    ["network failure", new AiContractError("PROVIDER_UNAVAILABLE", "Transport failed")],
    ["provider 5xx", new AiContractError("PROVIDER_UNAVAILABLE", "Provider unavailable", { providerStatus: 503 })],
    ["malformed compatible response", new AiContractError("RESPONSE_INVALID", "Provider response was malformed")]
  ])("records %s once without leaking provider errors", async (_label, failure) => {
    adapter.invoke.mockRejectedValue(failure);
    const result = await service.validate("workspace-1", "actor-1", "provider-1");
    expect(result.available).toBe(false);
    expect(result.errorCode).toBe(failure.code);
    expect(validations.record).toHaveBeenCalledTimes(1);
    expect(adapter.invoke).toHaveBeenCalledTimes(1);
    expect(credentials.useCredentialForValidation).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("unit-test-secret");
    expect(JSON.stringify(validations.record.mock.calls)).not.toContain("unit-test-secret");
    expect(JSON.stringify(validations.record.mock.calls)).not.toContain(failure.message);
    if (failure.metadata?.providerStatus) {
      expect(result.providerStatus).toBe(failure.metadata.providerStatus);
    }
  });

  it("persists measured latency and never enters Agent, routing, fallback, or model creation flows", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(137);
    try {
      await expect(service.validate("workspace-1", "actor-1", "provider-1")).resolves.toMatchObject({ latencyMs: 37 });
      expect(validations.record).toHaveBeenCalledWith(expect.objectContaining({ latencyMs: 37, available: true }));
      expect(Object.keys(providers)).toEqual(["get"]);
      expect(Object.keys(registry)).toEqual(["get"]);
      expect(adapter.invoke).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });
});
