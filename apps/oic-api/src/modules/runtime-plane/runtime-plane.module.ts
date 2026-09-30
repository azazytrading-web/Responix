import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { OicRuntimeController } from "./runtime.controller";
import { OpenAICompatibilityController } from "./openai-compatibility.controller";
import { RuntimeContextResolver } from "./runtime-context";
import { DatabaseOicModelResolver, OIC_MODEL_RESOLVER } from "./model-resolver";
import { OicRuntimeService } from "./runtime.service";
import { BoundedRuntimePolicy, OIC_RUNTIME_POLICY } from "./runtime-policy";
import { OIC_RUNTIME_EXECUTOR } from "./runtime-executor";
import { ProviderRuntimeExecutor } from "./provider-runtime-executor";

@Module({
  imports: [OicDatabaseModule],
  controllers: [OicRuntimeController, OpenAICompatibilityController],
  providers: [
    OicAuthenticationGuard, OicScopeGuard, RuntimeContextResolver, OicRuntimeService,
    { provide: OIC_MODEL_RESOLVER, useClass: DatabaseOicModelResolver },
    { provide: OIC_RUNTIME_EXECUTOR, useClass: ProviderRuntimeExecutor },
    { provide: OIC_RUNTIME_POLICY, useClass: BoundedRuntimePolicy }
  ],
  exports: [OicRuntimeService, OIC_MODEL_RESOLVER, OIC_RUNTIME_EXECUTOR, OIC_RUNTIME_POLICY]
})
export class RuntimePlaneModule {}
