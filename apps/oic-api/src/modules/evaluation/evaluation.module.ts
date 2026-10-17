import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { RuntimePlaneModule } from "../runtime-plane/runtime-plane.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { EvaluationController } from "./evaluation.controller";
import { EvaluationService } from "./evaluation.service";
import { EvaluationArtifactVault } from "./artifact-vault";
import { EvaluationSandboxAdapter } from "./sandbox-adapter";
import { EvaluationWorkQueue } from "./evaluation-work-queue";
import { EvaluationWorker } from "./evaluation-worker";
import { EvaluationOutboxDispatcher } from "./evaluation-outbox";
import { EvaluationReconciler } from "./evaluation-reconciler";
import { EvaluationSealedOracle } from "./sealed-oracle";
import { ReviewerController } from "./reviewer.controller";
import { ReviewerService } from "./reviewer.service";
import { DomainReviewService } from "./domain-review.service";
import { DomainReviewController } from "./domain-review.controller";

@Module({
  imports: [OicDatabaseModule, RuntimePlaneModule],
  controllers: [EvaluationController, ReviewerController, DomainReviewController],
  providers: [OicAuthenticationGuard, OicScopeGuard, EvaluationService, EvaluationArtifactVault, ReviewerService, DomainReviewService, EvaluationSandboxAdapter, EvaluationWorkQueue, EvaluationWorker, EvaluationOutboxDispatcher, EvaluationReconciler, EvaluationSealedOracle],
  exports: [EvaluationSandboxAdapter, EvaluationWorkQueue]
})
export class EvaluationModule {}
