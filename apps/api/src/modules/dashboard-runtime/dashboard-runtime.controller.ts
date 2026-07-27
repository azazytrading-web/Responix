import { Controller, Get, Req, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { DashboardRuntimeBootstrapDto } from "./dto/dashboard-runtime.dto";
import { DashboardRuntimeService } from "./dashboard-runtime.service";

@ApiTags("Dashboard Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active workspace membership and platform.read permission are required" })
@Controller("dashboard-runtime")
export class DashboardRuntimeController {
  constructor(private readonly runtime: DashboardRuntimeService) {}

  @Get("bootstrap") @Version("1") @Permissions("platform.read")
  @ApiOperation({ summary: "Resolve the renderer-neutral dashboard bootstrap manifest" })
  @ApiOkResponse({ type: DashboardRuntimeBootstrapDto })
  bootstrap(@Req() request: TenantRequest): Promise<DashboardRuntimeBootstrapDto> {
    const context = request.tenantContext!;
    return this.runtime.bootstrap({ workspaceId: context.workspace.id, userId: context.user.id, roleId: context.role.id, roleName: context.role.name });
  }
}
