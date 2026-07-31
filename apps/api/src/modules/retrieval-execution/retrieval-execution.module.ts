import { Module } from "@nestjs/common";
import { RetrievalExecutionController } from "./retrieval-execution.controller";
import { RetrievalExecutionRepository } from "./retrieval-execution.repository";
import { RetrievalExecutionService } from "./retrieval-execution.service";
import { RETRIEVAL_EXECUTION_STORE } from "./retrieval-execution.types";
import { RetrievalExecutionValidator } from "./retrieval-execution.validator";

@Module({ controllers: [RetrievalExecutionController], providers: [RetrievalExecutionValidator,
  RetrievalExecutionRepository, { provide: RETRIEVAL_EXECUTION_STORE, useExisting: RetrievalExecutionRepository },
  RetrievalExecutionService], exports: [RetrievalExecutionService, RETRIEVAL_EXECUTION_STORE] })
export class RetrievalExecutionModule {}
