import { Module } from "@nestjs/common";
import { RuntimeOrchestrationController } from "./runtime-orchestration.controller";
import { RuntimeOrchestrationRepository } from "./runtime-orchestration.repository";
import { RuntimeOrchestrationService } from "./runtime-orchestration.service";
import { RuntimeOrchestrationValidator } from "./runtime-orchestration.validator";

@Module({
  controllers: [RuntimeOrchestrationController],
  providers: [RuntimeOrchestrationValidator, RuntimeOrchestrationRepository, RuntimeOrchestrationService],
  exports: [RuntimeOrchestrationService]
})
export class RuntimeOrchestrationModule {}
