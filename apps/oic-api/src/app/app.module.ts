import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { OicExceptionFilter } from "../common/oic-exception.filter";
import { OicConfigModule } from "../config/oic-config.module";
import { OicDatabaseModule } from "../database/oic-database.module";
import { ControlPlaneModule } from "../modules/control-plane/control-plane.module";
import { HealthModule } from "../modules/health/health.module";
import { IdentityModule } from "../modules/identity/identity.module";
import { IntelligenceModule } from "../modules/intelligence/intelligence.module";
import { RuntimePlaneModule } from "../modules/runtime-plane/runtime-plane.module";
import { UsageEvidenceModule } from "../modules/usage-evidence/usage-evidence.module";
import { EconomicsModule } from "../modules/economics/economics.module";
import { EvaluationModule } from "../modules/evaluation/evaluation.module";

@Module({
  imports: [OicConfigModule, OicDatabaseModule, ControlPlaneModule, RuntimePlaneModule, IntelligenceModule, IdentityModule, HealthModule, UsageEvidenceModule, EconomicsModule, EvaluationModule],
  providers: [{ provide: APP_FILTER, useClass: OicExceptionFilter }]
})
export class AppModule {}
