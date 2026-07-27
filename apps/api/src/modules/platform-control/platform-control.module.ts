import { Module } from "@nestjs/common";
import { BrandingService } from "./branding.service";
import { DashboardMetadataService } from "./dashboard-metadata.service";
import { FeatureResolutionService } from "./feature-resolution.service";
import { LicenseResolutionService } from "./license-resolution.service";
import { PermissionResolutionService } from "./permission-resolution.service";
import { PlatformControlController } from "./platform-control.controller";
import { PlatformControlRepository } from "./platform-control.repository";
import { PlatformControlService } from "./platform-control.service";

@Module({
  controllers: [PlatformControlController],
  providers: [
    PlatformControlRepository, PermissionResolutionService, FeatureResolutionService,
    LicenseResolutionService, BrandingService, DashboardMetadataService, PlatformControlService
  ],
  exports: [PermissionResolutionService, PlatformControlService]
})
export class PlatformControlModule {}
