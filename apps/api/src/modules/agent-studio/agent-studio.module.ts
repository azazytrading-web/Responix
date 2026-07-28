import { Module } from "@nestjs/common";
import { AgentStudioController } from "./agent-studio.controller";
import { AgentStudioRepository } from "./agent-studio.repository";
import { AgentStudioService } from "./agent-studio.service";

@Module({
  controllers: [AgentStudioController],
  providers: [AgentStudioRepository, AgentStudioService]
})
export class AgentStudioModule {}
