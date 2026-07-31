import { forwardRef, Module } from "@nestjs/common";
import { AgentExecutionModule } from "../agent-execution/agent-execution.module";
import { AiModule } from "../ai/ai.module";
import { ExecutionKernelModule } from "../execution-kernel/execution-kernel.module";
import { MemoryRuntimeModule } from "../memory-runtime/memory-runtime.module";
import { PlatformControlModule } from "../platform-control/platform-control.module";
import { RetrievalExecutionModule } from "../retrieval-execution/retrieval-execution.module";
import { RuntimeOptimizationModule } from "../runtime-optimization/runtime-optimization.module";
import { ToolRegistryModule } from "../tool-registry/tool-registry.module";
import { WorkflowRuntimeModule } from "../workflow-runtime/workflow-runtime.module";
import { ToolInternalExecutorRegistry } from "./tool-internal-executor.registry";
import { ToolPolicyValidator } from "./tool-policy.validator";
import { ToolRuntimeController } from "./tool-runtime.controller";
import { ToolRuntimeRepository } from "./tool-runtime.repository";
import { ToolRuntimeService } from "./tool-runtime.service";
import { ToolRuntimeStateMachine } from "./tool-runtime.state-machine";
import { ToolRuntimeValidator } from "./tool-runtime.validator";

@Module({ imports: [ToolRegistryModule, ExecutionKernelModule, AiModule, PlatformControlModule,
  MemoryRuntimeModule, RetrievalExecutionModule, RuntimeOptimizationModule,
  forwardRef(() => AgentExecutionModule), forwardRef(() => WorkflowRuntimeModule)],
controllers: [ToolRuntimeController], providers: [ToolRuntimeStateMachine, ToolRuntimeValidator,
  ToolPolicyValidator, ToolInternalExecutorRegistry, ToolRuntimeRepository, ToolRuntimeService],
exports: [ToolRuntimeService, ToolInternalExecutorRegistry] })
export class ToolRuntimeModule {}
