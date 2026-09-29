/* eslint-disable @typescript-eslint/unbound-method */
import { CustomProviderController } from "./custom-provider.controller";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateCustomProviderDto } from "./dto/custom-provider.dto";
import { AiInvocationRequestDto } from "./dto/ai-request.dto";

describe("CustomProviderController", () => {
  const lifecycle = {
    list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), enable: jest.fn(),
    disable: jest.fn(), archive: jest.fn(), restore: jest.fn(), listCredentials: jest.fn(), replaceCredential: jest.fn()
  };
  const validation = { validate: jest.fn() };
  const controller = new CustomProviderController(lifecycle as never, validation as never);
  const request = { tenantContext: { workspace: { id: "trusted-workspace" }, user: { id: "trusted-user" } } } as never;

  beforeEach(() => jest.clearAllMocks());

  it("takes workspace and actor exclusively from the authenticated tenant context", async () => {
    lifecycle.create.mockResolvedValue({}); lifecycle.update.mockResolvedValue({});
    lifecycle.get.mockResolvedValue({}); lifecycle.list.mockResolvedValue([]);
    validation.validate.mockResolvedValue({});
    await controller.list(request);
    await controller.get(request, "provider-a");
    await controller.create(request, { displayName: "Provider" } as never);
    await controller.update(request, "provider-a", { displayName: "Renamed" });
    await controller.validate(request, "provider-a");
    expect(lifecycle.list).toHaveBeenCalledWith("trusted-workspace");
    expect(lifecycle.get).toHaveBeenCalledWith("trusted-workspace", "provider-a");
    expect(lifecycle.create).toHaveBeenCalledWith("trusted-workspace", "trusted-user", { displayName: "Provider" });
    expect(lifecycle.update).toHaveBeenCalledWith("trusted-workspace", "trusted-user", "provider-a", { displayName: "Renamed" });
    expect(validation.validate).toHaveBeenCalledWith("trusted-workspace", "trusted-user", "provider-a");
  });

  it("protects read, write, lifecycle and credential routes with established permissions", () => {
    expect(Reflect.getMetadata("permissions", CustomProviderController.prototype.list)).toEqual(["ai.providers.read"]);
    expect(Reflect.getMetadata("permissions", CustomProviderController.prototype.create)).toEqual(["ai.providers.write"]);
    expect(Reflect.getMetadata("permissions", CustomProviderController.prototype.replaceCredential)).toEqual(["ai.providers.write"]);
    expect(Reflect.getMetadata("permissions", CustomProviderController.prototype.listCredentials)).toEqual(["ai.providers.read"]);
    expect(Reflect.getMetadata("permissions", CustomProviderController.prototype.archive)).toEqual(["ai.providers.write"]);
    expect(Reflect.getMetadata("permissions", CustomProviderController.prototype.validate)).toEqual(["ai.providers.validate"]);
  });

  it("rejects caller supplied workspace or destination authorization metadata in create DTOs", async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    await expect(pipe.transform({
      displayName: "Custom", protocolId: "openai-chat-completions-v1", baseUrl: "https://custom.example/v1",
      validationModelId: "model-a", workspaceId: "forged-workspace", customProvider: { providerId: "forged" }
    }, { type: "body", metatype: CreateCustomProviderDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({
      taskType: "completion", messages: [{ role: "user", content: "hello" }], mode: "sync",
      apiBaseUrl: "https://custom.example", customProvider: { workspaceId: "forged", providerId: "forged" }
    }, { type: "body", metatype: AiInvocationRequestDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(["BUILT_IN_NATIVE", "OpenAI", "arbitrary-adapter", "unknown-protocol"])(
    "rejects native, alias, and unknown protocol identifiers (%s)", async (protocolId) => {
      const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
      await expect(pipe.transform({
        displayName: "Custom", protocolId, baseUrl: "https://custom.example/v1", validationModelId: "model-a"
      }, { type: "body", metatype: CreateCustomProviderDto })).rejects.toBeInstanceOf(BadRequestException);
    }
  );
});
