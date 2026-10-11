import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { AdmissionController } from "./admission.controller";
import { AdmissionService } from "./admission.service";

@Module({ imports: [OicDatabaseModule], controllers: [AdmissionController], providers: [AdmissionService, OicAuthenticationGuard, OicScopeGuard], exports: [AdmissionService] })
export class AdmissionModule {}
