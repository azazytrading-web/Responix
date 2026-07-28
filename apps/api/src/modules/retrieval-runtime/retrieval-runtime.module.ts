import { Module } from "@nestjs/common";
import { RetrievalRuntimeController } from "./retrieval-runtime.controller";
import { RetrievalRuntimeRepository } from "./retrieval-runtime.repository";
import { RetrievalRuntimeService } from "./retrieval-runtime.service";
import { RetrievalRuntimeValidator } from "./retrieval-runtime.validator";

@Module({
  controllers: [RetrievalRuntimeController],
  providers: [RetrievalRuntimeValidator, RetrievalRuntimeRepository, RetrievalRuntimeService],
  exports: [RetrievalRuntimeService]
})
export class RetrievalRuntimeModule {}
