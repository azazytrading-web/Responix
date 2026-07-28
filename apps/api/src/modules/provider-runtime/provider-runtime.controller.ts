import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CompareProviderSnapshotsDto,
  PrepareProviderRequestDto,
  ProviderRequestListQueryDto,
  ProviderSnapshotListQueryDto
} from "./dto/provider-runtime.dto";
import { ProviderRuntimeService } from "./provider-runtime.service";

@ApiTags("Provider Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Provider Runtime permission are required" })
@ApiNotFoundResponse({ description: "Provider Runtime resource was not found in the active workspace" })
@Controller("provider-runtime")
export class ProviderRuntimeController {
  constructor(private readonly service: ProviderRuntimeService) {}

  @Post("requests") @Version("1") @Permissions("provider.runtime.prepare")
  @ApiBadRequestResponse({ description: "Provider sources or requested capabilities are invalid" })
  @ApiOperation({ summary: "Prepare an immutable, vendor-neutral provider request without execution" })
  prepare(@Req() request: TenantRequest, @Body() dto: PrepareProviderRequestDto) {
    const context = request.tenantContext!;
    return this.service.prepare(context.workspace.id, context.user.id, dto);
  }

  @Post("requests/:id/validate") @Version("1") @Permissions("provider.runtime.validate")
  @ApiOperation({ summary: "Revalidate a prepared provider request against its resolved sources" })
  validate(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, id);
  }

  @Post("requests/:id/snapshots") @Version("1") @Permissions("provider.runtime.snapshot")
  @ApiOperation({ summary: "Create an immutable versioned provider request snapshot" })
  createSnapshot(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.createSnapshot(context.workspace.id, context.user.id, id);
  }

  @Get("requests") @Version("1") @Permissions("provider.runtime.read")
  @ApiOperation({ summary: "Filter and paginate workspace provider requests" })
  listRequests(@Req() request: TenantRequest, @Query() query: ProviderRequestListQueryDto) {
    return this.service.listRequests(request.tenantContext!.workspace.id, query);
  }

  @Get("requests/:id") @Version("1") @Permissions("provider.runtime.read")
  @ApiOperation({ summary: "Load a workspace-isolated prepared provider request" })
  getRequest(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.getRequest(request.tenantContext!.workspace.id, id);
  }

  @Get("snapshots/compare") @Version("1") @Permissions("provider.runtime.manage")
  @ApiOperation({ summary: "Compare two immutable provider request snapshots" })
  compare(@Req() request: TenantRequest, @Query() query: CompareProviderSnapshotsDto) {
    return this.service.compareSnapshots(
      request.tenantContext!.workspace.id,
      query.leftId,
      query.rightId
    );
  }

  @Get("snapshots") @Version("1") @Permissions("provider.runtime.read")
  @ApiOperation({ summary: "Filter and paginate immutable provider request snapshots" })
  listSnapshots(@Req() request: TenantRequest, @Query() query: ProviderSnapshotListQueryDto) {
    return this.service.listSnapshots(request.tenantContext!.workspace.id, query);
  }

  @Get("snapshots/:id") @Version("1") @Permissions("provider.runtime.read")
  @ApiOperation({ summary: "Load an immutable provider request snapshot" })
  getSnapshot(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.getSnapshot(request.tenantContext!.workspace.id, id);
  }
}
