import { Module } from "@nestjs/common";
import { PlatformControlModule } from "../platform-control/platform-control.module";
import { DashboardRuntimeCacheService } from "./dashboard-runtime-cache.service";
import { DashboardRuntimeController } from "./dashboard-runtime.controller";
import { DashboardRuntimeService } from "./dashboard-runtime.service";
import { LayoutRegistryService } from "./layout-registry.service";
import { WidgetRegistryService } from "./widget-registry.service";

@Module({
  imports: [PlatformControlModule],
  controllers: [DashboardRuntimeController],
  providers: [DashboardRuntimeCacheService, LayoutRegistryService, WidgetRegistryService, DashboardRuntimeService],
  exports: [DashboardRuntimeService, WidgetRegistryService]
})
export class DashboardRuntimeModule {}
