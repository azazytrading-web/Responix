import { Module } from "@nestjs/common";
import { AgentRuntimeController } from "./agent-runtime.controller";
import { AgentRuntimeRepository } from "./agent-runtime.repository";
import { AgentRuntimeService } from "./agent-runtime.service";
import { AgentRuntimeValidator } from "./agent-runtime.validator";

@Module({
  controllers: [AgentRuntimeController],
  providers: [AgentRuntimeValidator, AgentRuntimeRepository, AgentRuntimeService],
  exports: [AgentRuntimeService]
})
export class AgentRuntimeModule {}

