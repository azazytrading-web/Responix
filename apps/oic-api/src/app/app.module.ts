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

@Module({
  imports: [OicConfigModule, OicDatabaseModule, ControlPlaneModule, RuntimePlaneModule, IntelligenceModule, IdentityModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: OicExceptionFilter }]
})
export class AppModule {}
