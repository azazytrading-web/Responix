import { AiContractError } from "../contracts";
import { ProviderCredentialService } from "./provider-credential.service";

describe("ProviderCredentialService", () => {
  it("decrypts credentials only for the immediate provider-use callback", async () => {
    const repository = {
      findActiveEnvelope: jest.fn().mockResolvedValue({
        id: "credential-id",
        encryptedSecret: "encrypted"
      })
    };
    const crypto = { decrypt: jest.fn().mockReturnValue("secret") };
    const service = new ProviderCredentialService(repository as never, crypto as never);
    const operation = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.useCredential("workspace-id", "provider-id", operation)
    ).resolves.toBeUndefined();
    expect(repository.findActiveEnvelope).toHaveBeenCalledWith("workspace-id", "provider-id");
    expect(crypto.decrypt).toHaveBeenCalledWith("encrypted");
    expect(operation).toHaveBeenCalledWith({ id: "credential-id", secret: "secret" });
  });

  it("does not provide a return channel for plaintext credentials", () => {
    type CredentialCallback = Parameters<ProviderCredentialService["useCredential"]>[2];
    type ReturningCredentialIsRejected = ((
      credential: Parameters<CredentialCallback>[0]
    ) => Promise<Parameters<CredentialCallback>[0]>) extends CredentialCallback
      ? false
      : true;
    type ReturningPlaintextIsRejected = ((
      credential: Parameters<CredentialCallback>[0]
    ) => Promise<string>) extends CredentialCallback
      ? false
      : true;

    const credentialCannotEscape: ReturningCredentialIsRejected = true;
    const plaintextCannotEscape: ReturningPlaintextIsRejected = true;

    expect(credentialCannotEscape).toBe(true);
    expect(plaintextCannotEscape).toBe(true);
  });

  it("fails without invoking provider use when no credential is available", async () => {
    const service = new ProviderCredentialService(
      { findActiveEnvelope: jest.fn().mockResolvedValue(null) } as never,
      { decrypt: jest.fn() } as never
    );
    const operation = jest.fn();

    await expect(
      service.useCredential("workspace-id", "provider-id", operation)
    ).rejects.toBeInstanceOf(AiContractError);
    expect(operation).not.toHaveBeenCalled();
  });
});
