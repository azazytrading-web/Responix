import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { KnowledgeEmbeddingService } from "./knowledge-embedding.service";
import { KnowledgePipelineService } from "./knowledge-pipeline.service";
import { TextChunkerService } from "./text-chunker.service";
import { TextExtractorService } from "./text-extractor.service";

@Module({
  imports: [AiModule],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseRepository,
    KnowledgeBaseService,
    TextExtractorService,
    TextChunkerService,
    KnowledgeEmbeddingService,
    KnowledgePipelineService
  ]
})
export class KnowledgeBaseModule {}
