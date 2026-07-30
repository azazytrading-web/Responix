import { Module } from "@nestjs/common";
import { PromptExecutionController } from "./prompt-execution.controller";
import { PromptExecutionEngine } from "./prompt-execution.engine";
import { PromptExecutionRepository } from "./prompt-execution.repository";
import { PromptExecutionService } from "./prompt-execution.service";

@Module({
  controllers: [PromptExecutionController],
  providers: [PromptExecutionEngine, PromptExecutionRepository, PromptExecutionService],
  exports: [PromptExecutionService]
})
export class PromptExecutionModule {}
