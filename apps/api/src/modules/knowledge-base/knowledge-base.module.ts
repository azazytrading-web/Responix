import { Module } from "@nestjs/common";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";
import { KnowledgeBaseService } from "./knowledge-base.service";

@Module({
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseRepository, KnowledgeBaseService]
})
export class KnowledgeBaseModule {}
