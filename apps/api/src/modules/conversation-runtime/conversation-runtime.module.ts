import { Module } from "@nestjs/common";
import { ConversationRuntimeController } from "./conversation-runtime.controller";
import { ConversationRuntimeRepository } from "./conversation-runtime.repository";
import { ConversationRuntimeService } from "./conversation-runtime.service";
import { ConversationRuntimeValidator } from "./conversation-runtime.validator";

@Module({
  controllers: [ConversationRuntimeController],
  providers: [ConversationRuntimeValidator, ConversationRuntimeRepository, ConversationRuntimeService],
  exports: [ConversationRuntimeService]
})
export class ConversationRuntimeModule {}
