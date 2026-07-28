import { Module } from "@nestjs/common";
import { ProviderRuntimeController } from "./provider-runtime.controller";
import { ProviderRuntimeRepository } from "./provider-runtime.repository";
import { ProviderRuntimeService } from "./provider-runtime.service";
import { ProviderRuntimeValidator } from "./provider-runtime.validator";

@Module({
  controllers: [ProviderRuntimeController],
  providers: [ProviderRuntimeValidator, ProviderRuntimeRepository, ProviderRuntimeService],
  exports: [ProviderRuntimeService]
})
export class ProviderRuntimeModule {}
