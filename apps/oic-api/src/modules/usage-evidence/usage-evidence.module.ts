import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { UsageEvidenceController } from "./usage-evidence.controller";
import { UsageEvidenceService } from "./usage-evidence.service";
import { AdmissionModule } from "../admission/admission.module";

@Module({
  imports: [OicDatabaseModule, AdmissionModule],
  controllers: [UsageEvidenceController],
  providers: [OicAuthenticationGuard, OicScopeGuard, UsageEvidenceService],
  exports: [UsageEvidenceService]
})
export class UsageEvidenceModule {}
