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
import { IntelligenceRuntimeExecutor } from "../intelligence/intelligence-runtime-executor";
import { OicDatabaseService } from "@oic/database";
import { OicMemoryRepository } from "../intelligence/memory.repository";
import { IntelligenceWorkbenchController } from "./intelligence-workbench.controller";
import { IntelligenceWorkbenchService } from "./intelligence-workbench.service";

@Module({
  imports: [OicDatabaseModule],
  controllers: [OicRuntimeController, OpenAICompatibilityController, IntelligenceWorkbenchController],
  providers: [
    OicAuthenticationGuard, OicScopeGuard, RuntimeContextResolver, OicRuntimeService,
    IntelligenceWorkbenchService,
    { provide: OIC_MODEL_RESOLVER, useClass: DatabaseOicModelResolver },
    ProviderRuntimeExecutor, OicMemoryRepository,
    { provide: OIC_RUNTIME_EXECUTOR, useFactory: (db: OicDatabaseService, provider: ProviderRuntimeExecutor, memories: OicMemoryRepository) => new IntelligenceRuntimeExecutor(db, provider, memories), inject: [OicDatabaseService, ProviderRuntimeExecutor, OicMemoryRepository] },
    { provide: OIC_RUNTIME_POLICY, useClass: BoundedRuntimePolicy }
  ],
  exports: [OicRuntimeService, OIC_MODEL_RESOLVER, OIC_RUNTIME_EXECUTOR, OIC_RUNTIME_POLICY]
})
export class RuntimePlaneModule {}
