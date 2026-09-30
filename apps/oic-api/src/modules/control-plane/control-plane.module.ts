import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { ProviderControlController } from "./provider-control.controller";
import { ProviderControlService } from "./provider-control.service";
import { ModelFabricController } from "./model-fabric.controller";
import { ModelFabricService } from "./model-fabric.service";

@Module({
  imports: [OicDatabaseModule],
  controllers: [ProviderControlController, ModelFabricController],
  providers: [ProviderControlService, ModelFabricService, OicAuthenticationGuard, OicScopeGuard]
})
export class ControlPlaneModule {}
