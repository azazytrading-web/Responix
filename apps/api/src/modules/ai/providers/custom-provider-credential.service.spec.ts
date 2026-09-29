import { AiContractError } from "../contracts";
import { CustomProviderCredentialService } from "./custom-provider-credential.service";

describe("CustomProviderCredentialService", () => {
  it("encrypts and fingerprints a secret before persistence", async () => {
    const repository = { create: jest.fn().mockResolvedValue({ id: "credential-1" }) };
    const crypto = { encrypt: jest.fn().mockReturnValue("encrypted"), fingerprint: jest.fn().mockReturnValue("fingerprint") };
    const service = new CustomProviderCredentialService(repository as never, crypto as never);
    await service.create({ workspaceId: "w1", customProviderId: "p1", name: "default", secret: "plain-secret" });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "w1", customProviderId: "p1", encryptedSecret: "encrypted", keyFingerprint: "fingerprint"
    }));
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain("plain-secret");
  });

  it("decrypts only inside the immediate-use callback and selects by workspace/provider", async () => {
    const repository = { findActiveEnvelope: jest.fn().mockResolvedValue({ id: "c1", encryptedSecret: "cipher" }) };
    const crypto = { decrypt: jest.fn().mockReturnValue("plain-secret") };
    const service = new CustomProviderCredentialService(repository as never, crypto as never);
    const operation = jest.fn().mockResolvedValue(undefined);
    await service.useCredential("w1", "p1", operation);
    expect(repository.findActiveEnvelope).toHaveBeenCalledWith("w1", "p1");
    expect(operation).toHaveBeenCalledWith({ id: "c1", secret: "plain-secret" });
    expect(JSON.stringify(repository.findActiveEnvelope.mock.calls)).not.toContain("plain-secret");
  });

  it("fails closed when no active credential exists", async () => {
    const service = new CustomProviderCredentialService(
      { findActiveEnvelope: jest.fn().mockResolvedValue(null) } as never,
      {} as never
    );
    await expect(service.useCredential("w1", "p1", jest.fn())).rejects.toBeInstanceOf(AiContractError);
  });

  it("decrypts one validation credential only for the immediate callback", async () => {
    const repository = { findValidationEnvelope: jest.fn().mockResolvedValue({ id: "c1", encryptedSecret: "cipher" }) };
    const crypto = { decrypt: jest.fn().mockReturnValue("validation-secret") };
    const service = new CustomProviderCredentialService(repository as never, crypto as never);
    const operation = jest.fn().mockResolvedValue(undefined);
    await service.useCredentialForValidation("w1", "p1", operation);
    expect(repository.findValidationEnvelope).toHaveBeenCalledTimes(1);
    expect(repository.findValidationEnvelope).toHaveBeenCalledWith("w1", "p1");
    expect(crypto.decrypt).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith({ id: "c1", secret: "validation-secret" });
  });

  it("fails validation without invoking the provider when the selected credential is inactive or absent", async () => {
    const repository = { findValidationEnvelope: jest.fn().mockResolvedValue(null) };
    const crypto = { decrypt: jest.fn() };
    const service = new CustomProviderCredentialService(repository as never, crypto as never);
    const operation = jest.fn();
    await expect(service.useCredentialForValidation("w1", "p1", operation))
      .rejects.toMatchObject({ code: "CREDENTIAL_UNAVAILABLE" });
    expect(crypto.decrypt).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });
});
