import { Module } from "@nestjs/common";
import { AgentExecutionModule } from "../agent-execution/agent-execution.module";
import { AiModule } from "../ai/ai.module";
import { ConversationRuntimeModule } from "../conversation-runtime/conversation-runtime.module";
import { WorkflowRuntimeModule } from "../workflow-runtime/workflow-runtime.module";
import { MetaWhatsappCloudAdapter } from "./adapters/meta-whatsapp-cloud.adapter";
import { ChannelMessageStateMachine } from "./channel-message.state-machine";
import { ChannelConnectionStateMachine } from "./channel-connection.state-machine";
import { ChannelCredentialService } from "./channel-credential.service";
import { ChannelProviderRegistry } from "./channel-provider.registry";
import { ChannelRetryService } from "./channel-retry.service";
import { ChannelRuntimeController } from "./channel-runtime.controller";
import { ChannelRuntimeRepository } from "./channel-runtime.repository";
import { ChannelRuntimeService } from "./channel-runtime.service";
import { ChannelRuntimeValidator } from "./channel-runtime.validator";
import { ChannelTransportService } from "./channel-transport.service";
import { CHANNEL_PROVIDER_ADAPTERS } from "./channel-runtime.tokens";

@Module({
  imports: [AiModule, ConversationRuntimeModule, AgentExecutionModule, WorkflowRuntimeModule],
  controllers: [ChannelRuntimeController],
  providers: [ChannelMessageStateMachine, ChannelConnectionStateMachine, ChannelRetryService, ChannelRuntimeValidator,
    ChannelRuntimeRepository, ChannelTransportService, ChannelCredentialService, MetaWhatsappCloudAdapter,
    { provide: CHANNEL_PROVIDER_ADAPTERS, inject: [MetaWhatsappCloudAdapter], useFactory: (whatsapp: MetaWhatsappCloudAdapter) => [whatsapp] },
    ChannelProviderRegistry, ChannelRuntimeService],
  exports: [ChannelRuntimeService, ChannelProviderRegistry, CHANNEL_PROVIDER_ADAPTERS]
})
export class ChannelRuntimeModule {}
