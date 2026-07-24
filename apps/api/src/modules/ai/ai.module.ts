import { Module } from "@nestjs/common";
import { ProviderCredentialCryptoService } from "./security/provider-credential-crypto.service";

@Module({
  providers: [ProviderCredentialCryptoService],
  exports: [ProviderCredentialCryptoService]
})
export class AiModule {}
