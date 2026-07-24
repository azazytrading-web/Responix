import { Module } from "@nestjs/common";
import { MembershipGuard } from "./membership.guard";
import { TenantContextService } from "./tenant-context.service";
import { TenantGuard } from "./tenant.guard";
import { TenantRepository } from "./tenant.repository";

@Module({
  providers: [TenantRepository, TenantContextService, TenantGuard, MembershipGuard],
  exports: [TenantRepository, TenantContextService, TenantGuard, MembershipGuard]
})
export class TenantModule {}
