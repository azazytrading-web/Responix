import { forwardRef, Module } from "@nestjs/common";
import { AgentExecutionModule } from "../agent-execution/agent-execution.module";
import { ExecutionKernelModule } from "../execution-kernel/execution-kernel.module";
import { MemoryRuntimeModule } from "../memory-runtime/memory-runtime.module";
import { StreamingRuntimeModule } from "../streaming-runtime/streaming-runtime.module";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";
import { WorkflowRuntimeRepository } from "./workflow-runtime.repository";
import { WorkflowRuntimeService } from "./workflow-runtime.service";
import { WorkflowRuntimeStateMachine } from "./workflow-runtime.state-machine";
import { WorkflowRuntimeValidator } from "./workflow-runtime.validator";
import { ToolRuntimeModule } from "../tool-runtime/tool-runtime.module";

@Module({ imports: [ExecutionKernelModule, AgentExecutionModule, StreamingRuntimeModule, MemoryRuntimeModule,
    forwardRef(() => ToolRuntimeModule)],
  controllers: [WorkflowRuntimeController], providers: [WorkflowRuntimeStateMachine,
    WorkflowRuntimeValidator, WorkflowRuntimeRepository, WorkflowRuntimeService],
  exports: [WorkflowRuntimeService] })
export class WorkflowRuntimeModule {}
