import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { IntelligenceController } from "./intelligence.controller";
import { IntelligenceProfileService } from "./intelligence-profile.service";
import { IntelligenceDataService } from "./intelligence-data.service";

@Module({ imports: [OicDatabaseModule], controllers: [IntelligenceController], providers: [OicAuthenticationGuard, OicScopeGuard, IntelligenceProfileService, IntelligenceDataService], exports: [IntelligenceProfileService, IntelligenceDataService] })
export class IntelligenceModule {}
