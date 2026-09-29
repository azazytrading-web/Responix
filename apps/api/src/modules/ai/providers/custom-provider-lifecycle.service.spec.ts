import { ConflictException } from "@nestjs/common";
import { CustomProviderLifecycleService } from "./custom-provider-lifecycle.service";

describe("CustomProviderLifecycleService", () => {
  const provider = {
    id: "cp-a", workspaceId: "ws-a", displayName: "Example", normalizedName: "example",
    protocolId: "openai-chat-completions-v1", baseUrl: "https://custom.example/v1",
    validationModelId: "small-model", supportsStreaming: false, supportsTools: false,
    status: "DISABLED", archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0)
  };
  let repository: { list: jest.Mock; get: jest.Mock; createDefinition: jest.Mock; updateDefinition: jest.Mock; transition: jest.Mock; auditEvent: jest.Mock };
  let credentials: { listMetadata: jest.Mock; create: jest.Mock };
  let destinations: { validateCustomProviderBaseUrl: jest.Mock };
  let service: CustomProviderLifecycleService;

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue([provider]), get: jest.fn().mockResolvedValue(provider),
      createDefinition: jest.fn().mockResolvedValue(provider), updateDefinition: jest.fn().mockResolvedValue(provider),
      transition: jest.fn().mockResolvedValue(provider), auditEvent: jest.fn().mockResolvedValue(undefined)
    };
    credentials = {
      listMetadata: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "cred-a", name: "default", keyFingerprint: "fp", status: "ACTIVE" })
    };
    destinations = { validateCustomProviderBaseUrl: jest.fn().mockResolvedValue("https://custom.example/v1") };
    service = new CustomProviderLifecycleService(repository as never, credentials as never, destinations as never);
  });

  it("creates only the approved protocol using a validated normalized destination and server-owned workspace", async () => {
    await service.create("ws-a", "user-a", {
      displayName: " Example ", protocolId: "openai-chat-completions-v1", baseUrl: "https://custom.example/v1/",
      validationModelId: " model ", supportsStreaming: true
    });
    expect(destinations.validateCustomProviderBaseUrl).toHaveBeenCalledWith("https://custom.example/v1/");
    expect(repository.createDefinition).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "ws-a", actorId: "user-a", protocolId: "openai-chat-completions-v1",
      baseUrl: "https://custom.example/v1", validationModelId: "model", supportsStreaming: true, supportsTools: false
    }));
  });

  it("revalidates endpoint changes and updates only explicitly allowed fields", async () => {
    destinations.validateCustomProviderBaseUrl.mockResolvedValueOnce("https://next.example/v1");
    await service.update("ws-a", "user-a", "cp-a", { baseUrl: "https://next.example/v1", displayName: " New " });
    expect(destinations.validateCustomProviderBaseUrl).toHaveBeenCalledWith("https://next.example/v1");
    expect(repository.updateDefinition).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "ws-a", actorId: "user-a", id: "cp-a",
      data: { displayName: "New", normalizedName: "new", baseUrl: "https://next.example/v1" }
    }));
  });

  it("refuses enable until an active credential is configured", async () => {
    await expect(service.enable("ws-a", "user-a", "cp-a")).rejects.toBeInstanceOf(ConflictException);
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it("enables only after checking public endpoint and active credential", async () => {
    credentials.listMetadata.mockResolvedValue([{ id: "cred-a", status: "ACTIVE" }]);
    await service.enable("ws-a", "user-a", "cp-a");
    expect(destinations.validateCustomProviderBaseUrl).toHaveBeenCalledWith(provider.baseUrl);
    expect(repository.transition).toHaveBeenCalledWith({ workspaceId: "ws-a", actorId: "user-a", id: "cp-a", action: "enable" });
  });

  it("replaces a credential through the encrypted service and audits metadata without any secret", async () => {
    const result = await service.replaceCredential("ws-a", "user-a", "cp-a", { name: "default", secret: "private-secret" });
    expect(credentials.create).toHaveBeenCalledWith({ workspaceId: "ws-a", customProviderId: "cp-a", name: "default", secret: "private-secret" });
    expect(repository.auditEvent).toHaveBeenCalledWith("ws-a", "user-a", "ai.custom-provider.credential.created", "cp-a", {
      credentialId: "cred-a", name: "default"
    });
    expect(JSON.stringify(repository.auditEvent.mock.calls)).not.toContain("private-secret");
    expect(JSON.stringify(result)).not.toContain("fingerprint");
  });

  it("lists credential metadata without encrypted material", async () => {
    credentials.listMetadata.mockResolvedValue([{ id: "cred-a", name: "default", keyFingerprint: "fp", status: "ACTIVE", priority: 0, lastUsedAt: null }]);
    const result = await service.listCredentials("ws-a", "cp-a");
    expect(result).toEqual([{ id: "cred-a", name: "default", status: "ACTIVE", priority: 0 }]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("fingerprint");
  });

  it("keeps crypto envelope and fingerprint out of Custom Provider responses", async () => {
    credentials.listMetadata.mockResolvedValue([{
      id: "cred-a", name: "default", keyFingerprint: "internal-fingerprint", encryptedSecret: "ciphertext",
      status: "ACTIVE", priority: 0, lastUsedAt: null
    }]);
    const result = await service.get("ws-a", "cp-a");
    expect(result).toMatchObject({
      id: "cp-a", credentials: [{ id: "cred-a", name: "default", status: "ACTIVE", priority: 0 }]
    });
    expect(JSON.stringify(result)).not.toContain("ciphertext");
    expect(JSON.stringify(result)).not.toContain("internal-fingerprint");
    expect(JSON.stringify(result)).not.toContain("workspaceId");
  });
});
