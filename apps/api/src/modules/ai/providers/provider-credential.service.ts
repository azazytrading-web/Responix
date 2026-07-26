import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { ProviderExecutionCredential } from "../contracts";
import { ProviderCredentialCryptoService } from "../security/provider-credential-crypto.service";
import { CredentialRepository } from "./credential.repository";
import type { ProviderCredentialMetadata } from "./provider.types";

@Injectable()
export class ProviderCredentialService {
  constructor(
    private readonly repository: CredentialRepository,
    private readonly crypto: ProviderCredentialCryptoService
  ) {}

  listMetadata(workspaceId: string, providerId: string): Promise<ProviderCredentialMetadata[]> {
    return this.repository.listMetadata(workspaceId, providerId);
  }

  async useCredential(
    workspaceId: string,
    providerId: string,
    operation: (credential: ProviderExecutionCredential) => Promise<void>
  ): Promise<void> {
    const credential = await this.repository.findActiveEnvelope(workspaceId, providerId);
    if (!credential) {
      throw new AiContractError("CREDENTIAL_UNAVAILABLE", "No active provider credential found");
    }
    const secret = this.crypto.decrypt(credential.encryptedSecret);
    await operation({ id: credential.id, secret });
  }
}
