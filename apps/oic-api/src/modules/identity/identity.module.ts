import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "./auth.guard";
import { FoundationController } from "./foundation.controller";
import { FoundationService } from "./foundation.service";
import { OIC_FOUNDATION_AUDIT_WRITER, PrismaFoundationAuditWriter } from "./foundation-audit-writer";

@Module({ imports: [OicDatabaseModule], controllers: [FoundationController], providers: [FoundationService, OicAuthenticationGuard, OicScopeGuard, { provide: OIC_FOUNDATION_AUDIT_WRITER, useClass: PrismaFoundationAuditWriter }] })
export class IdentityModule {}
