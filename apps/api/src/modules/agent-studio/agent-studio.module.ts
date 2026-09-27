import { Module } from "@nestjs/common";
import { AgentStudioController } from "./agent-studio.controller";
import { AgentStudioRepository } from "./agent-studio.repository";
import { AgentStudioService } from "./agent-studio.service";
import { AgentPublishRuntimeService } from "./agent-publish-runtime.service";
import { AgentRuntimeModule } from "../agent-runtime/agent-runtime.module";
import { PromptCompilerModule } from "../prompt-compiler/prompt-compiler.module";
import { PromptExecutionModule } from "../prompt-execution/prompt-execution.module";
import { ProviderRuntimeModule } from "../provider-runtime/provider-runtime.module";
import { ExecutionPipelineModule } from "../execution-pipeline/execution-pipeline.module";
import { ExecutionKernelModule } from "../execution-kernel/execution-kernel.module";
import { AgentExecutionModule } from "../agent-execution/agent-execution.module";
import { MemoryRuntimeModule } from "../memory-runtime/memory-runtime.module";
import { RetrievalRuntimeModule } from "../retrieval-runtime/retrieval-runtime.module";

@Module({
  imports: [AgentRuntimeModule, PromptCompilerModule, PromptExecutionModule,
    ProviderRuntimeModule, ExecutionPipelineModule, ExecutionKernelModule, AgentExecutionModule,
    MemoryRuntimeModule, RetrievalRuntimeModule],
  controllers: [AgentStudioController],
  providers: [AgentStudioRepository, AgentStudioService, AgentPublishRuntimeService]
})
export class AgentStudioModule {}
