import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { ProviderExecutionCredential } from "../contracts";
import { ProviderCredentialCryptoService } from "../security/provider-credential-crypto.service";
import { CustomProviderCredentialRepository } from "./custom-provider-credential.repository";

@Injectable()
export class CustomProviderCredentialService {
  constructor(
    private readonly repository: CustomProviderCredentialRepository,
    private readonly crypto: ProviderCredentialCryptoService
  ) {}

  create(input: { workspaceId: string; customProviderId: string; name: string; secret: string }) {
    return this.repository.create({
      workspaceId: input.workspaceId,
      customProviderId: input.customProviderId,
      name: input.name,
      encryptedSecret: this.crypto.encrypt(input.secret),
      keyFingerprint: this.crypto.fingerprint(input.secret)
    });
  }

  listMetadata(workspaceId: string, customProviderId: string) {
    return this.repository.listMetadata(workspaceId, customProviderId);
  }

  async useCredential(
    workspaceId: string,
    customProviderId: string,
    operation: (credential: ProviderExecutionCredential) => Promise<void>
  ): Promise<void> {
    const credential = await this.repository.findActiveEnvelope(workspaceId, customProviderId);
    if (!credential) throw new AiContractError("CREDENTIAL_UNAVAILABLE", "No active provider credential found");
    const secret = this.crypto.decrypt(credential.encryptedSecret);
    await operation({ id: credential.id, secret });
  }

  async useCredentialForValidation(
    workspaceId: string,
    customProviderId: string,
    operation: (credential: ProviderExecutionCredential) => Promise<void>
  ): Promise<void> {
    const credential = await this.repository.findValidationEnvelope(workspaceId, customProviderId);
    if (!credential) throw new AiContractError("CREDENTIAL_UNAVAILABLE", "No active provider credential found");
    const secret = this.crypto.decrypt(credential.encryptedSecret);
    await operation({ id: credential.id, secret });
  }
}
