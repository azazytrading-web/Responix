import { Module } from "@nestjs/common";
import { OicRuntimeService } from "./oic-runtime.service";
import { OicTenantProvisioningService } from "./oic-tenant-provisioning.service";
import { OicCatalogController } from "./oic-catalog.controller";

@Module({ controllers: [OicCatalogController], providers: [OicRuntimeService, OicTenantProvisioningService], exports: [OicRuntimeService, OicTenantProvisioningService] })
export class OicIntegrationModule {}
