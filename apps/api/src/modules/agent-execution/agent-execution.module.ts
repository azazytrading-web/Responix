import { Module } from "@nestjs/common";
import { AgentRuntimeModule } from "../agent-runtime/agent-runtime.module";
import { AiModule } from "../ai/ai.module";
import { ConversationRuntimeModule } from "../conversation-runtime/conversation-runtime.module";
import { ExecutionKernelModule } from "../execution-kernel/execution-kernel.module";
import { ExecutionPipelineModule } from "../execution-pipeline/execution-pipeline.module";
import { PromptExecutionModule } from "../prompt-execution/prompt-execution.module";
import { ProviderRuntimeModule } from "../provider-runtime/provider-runtime.module";
import { RetrievalRuntimeModule } from "../retrieval-runtime/retrieval-runtime.module";
import { RuntimeOptimizationModule } from "../runtime-optimization/runtime-optimization.module";
import { StreamingRuntimeModule } from "../streaming-runtime/streaming-runtime.module";
import { AgentExecutionController, UnifiedAgentExecutionController } from "./agent-execution.controller";
import { AgentExecutionRepository } from "./agent-execution.repository";
import { AgentExecutionService } from "./agent-execution.service";
import { AgentExecutionValidator } from "./agent-execution.validator";

@Module({
  imports: [
    ExecutionKernelModule, AgentRuntimeModule, PromptExecutionModule,
    ProviderRuntimeModule, ConversationRuntimeModule, ExecutionPipelineModule,
    AiModule, RuntimeOptimizationModule, RetrievalRuntimeModule, StreamingRuntimeModule
  ],
  controllers: [AgentExecutionController, UnifiedAgentExecutionController],
  providers: [AgentExecutionValidator, AgentExecutionRepository, AgentExecutionService],
  exports: [AgentExecutionService]
})
export class AgentExecutionModule {}
