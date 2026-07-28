import { Module } from "@nestjs/common";
import { WorkflowEngineController } from "./workflow-engine.controller";
import { WorkflowEngineRepository } from "./workflow-engine.repository";
import { WorkflowEngineService } from "./workflow-engine.service";
import { WorkflowGraphValidator } from "./workflow-graph.validator";

@Module({
  controllers: [WorkflowEngineController],
  providers: [WorkflowGraphValidator, WorkflowEngineRepository, WorkflowEngineService],
  exports: [WorkflowEngineService]
})
export class WorkflowEngineModule {}
