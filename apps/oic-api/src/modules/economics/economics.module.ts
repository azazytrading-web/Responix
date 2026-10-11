import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { EconomicsController } from "./economics.controller";
import { EconomicsService } from "./economics.service";
import { AdmissionModule } from "../admission/admission.module";

@Module({
  imports: [OicDatabaseModule, AdmissionModule],
  controllers: [EconomicsController],
  providers: [EconomicsService, OicAuthenticationGuard, OicScopeGuard]
})
export class EconomicsModule {}
