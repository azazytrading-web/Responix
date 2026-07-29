import { Module } from "@nestjs/common";
import { ExecutionPipelineController } from "./execution-pipeline.controller";
import { ExecutionPipelineRepository } from "./execution-pipeline.repository";
import { ExecutionPipelineService } from "./execution-pipeline.service";
import { ExecutionPipelineValidator } from "./execution-pipeline.validator";

@Module({
  controllers: [ExecutionPipelineController],
  providers: [ExecutionPipelineValidator, ExecutionPipelineRepository, ExecutionPipelineService],
  exports: [ExecutionPipelineService]
})
export class ExecutionPipelineModule {}
