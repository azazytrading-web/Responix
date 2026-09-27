import { Module } from "@nestjs/common";
import { AgentExecutionModule } from "../agent-execution/agent-execution.module";
import { AiModule } from "../ai/ai.module";
import { ConversationRuntimeModule } from "../conversation-runtime/conversation-runtime.module";
import { WorkflowRuntimeModule } from "../workflow-runtime/workflow-runtime.module";
import { MemoryRuntimeModule } from "../memory-runtime/memory-runtime.module";
import { MetaWhatsappCloudAdapter } from "./adapters/meta-whatsapp-cloud.adapter";
import { BaileysWhatsappAdapter } from "./adapters/baileys-whatsapp.adapter";
import { BaileysWhatsappIncomingProcessor } from "./baileys-whatsapp.incoming-processor";
import { BaileysWhatsappSessionManager } from "./baileys-whatsapp.session-manager";
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
import { BaileysDiagnosticsService } from "./baileys-diagnostics.service";

@Module({
  imports: [AiModule, ConversationRuntimeModule, AgentExecutionModule, WorkflowRuntimeModule,
    MemoryRuntimeModule],
  controllers: [ChannelRuntimeController],
  providers: [ChannelMessageStateMachine, ChannelConnectionStateMachine, ChannelRetryService, ChannelRuntimeValidator,
    ChannelRuntimeRepository, ChannelTransportService, ChannelCredentialService, MetaWhatsappCloudAdapter,
    BaileysDiagnosticsService, BaileysWhatsappSessionManager, BaileysWhatsappIncomingProcessor, BaileysWhatsappAdapter,
    { provide: CHANNEL_PROVIDER_ADAPTERS, inject: [MetaWhatsappCloudAdapter, BaileysWhatsappAdapter],
      useFactory: (whatsapp: MetaWhatsappCloudAdapter, baileys: BaileysWhatsappAdapter) => [whatsapp, baileys] },
    ChannelProviderRegistry, ChannelRuntimeService],
  exports: [ChannelRuntimeService, ChannelProviderRegistry, CHANNEL_PROVIDER_ADAPTERS]
})
export class ChannelRuntimeModule {}
