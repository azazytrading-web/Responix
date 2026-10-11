import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { EconomicsController } from "./economics.controller";
import { EconomicsService } from "./economics.service";

@Module({
  imports: [OicDatabaseModule],
  controllers: [EconomicsController],
  providers: [EconomicsService, OicAuthenticationGuard, OicScopeGuard]
})
export class EconomicsModule {}
