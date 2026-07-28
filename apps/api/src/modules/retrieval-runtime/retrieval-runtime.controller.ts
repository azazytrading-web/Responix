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
  CompareRetrievalSnapshotsDto,
  PrepareRetrievalRuntimeDto,
  RetrievalRuntimeListQueryDto,
  RetrievalSnapshotListQueryDto
} from "./dto/retrieval-runtime.dto";
import { RetrievalRuntimeService } from "./retrieval-runtime.service";

@ApiTags("Retrieval Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Retrieval Runtime permission are required" })
@ApiNotFoundResponse({ description: "Retrieval Runtime resource was not found in the active workspace" })
@Controller("retrieval-runtime")
export class RetrievalRuntimeController {
  constructor(private readonly service: RetrievalRuntimeService) {}

  @Post() @Version("1") @Permissions("retrieval.runtime.create")
  @ApiBadRequestResponse({ description: "Knowledge references or retrieval metadata are invalid" })
  @ApiOperation({ summary: "Prepare immutable retrieval metadata without search or execution" })
  prepare(@Req() request: TenantRequest, @Body() dto: PrepareRetrievalRuntimeDto) {
    const context = request.tenantContext!;
    return this.service.prepare(context.workspace.id, context.user.id, dto);
  }

  @Post(":id/validate") @Version("1") @Permissions("retrieval.runtime.update")
  @ApiOperation({ summary: "Validate prepared metadata against current published Knowledge assets" })
  validate(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, id);
  }

  @Post(":id/publish") @Version("1") @Permissions("retrieval.runtime.publish")
  @ApiOperation({ summary: "Publish an immutable versioned retrieval snapshot" })
  publish(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.publish(context.workspace.id, context.user.id, id);
  }

  @Post(":id/archive") @Version("1") @Permissions("retrieval.runtime.archive")
  @ApiOperation({ summary: "Archive retrieval metadata without deleting snapshot history" })
  archive(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.archive(context.workspace.id, context.user.id, id);
  }

  @Post(":id/restore") @Version("1") @Permissions("retrieval.runtime.restore")
  @ApiOperation({ summary: "Restore archived retrieval metadata and preserve history" })
  restore(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.restore(context.workspace.id, context.user.id, id);
  }

  @Get() @Version("1") @Permissions("retrieval.runtime.read")
  @ApiOperation({ summary: "Filter and paginate workspace retrieval packages" })
  list(@Req() request: TenantRequest, @Query() query: RetrievalRuntimeListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }

  @Get("snapshots/compare") @Version("1") @Permissions("retrieval.runtime.compare")
  @ApiOperation({ summary: "Compare two immutable retrieval snapshots" })
  compare(@Req() request: TenantRequest, @Query() query: CompareRetrievalSnapshotsDto) {
    return this.service.compare(
      request.tenantContext!.workspace.id,
      query.leftId,
      query.rightId
    );
  }

  @Get("snapshots") @Version("1") @Permissions("retrieval.runtime.read")
  @ApiOperation({ summary: "Filter and paginate immutable retrieval snapshots" })
  listSnapshots(@Req() request: TenantRequest, @Query() query: RetrievalSnapshotListQueryDto) {
    return this.service.listSnapshots(request.tenantContext!.workspace.id, query);
  }

  @Get("snapshots/:id") @Version("1") @Permissions("retrieval.runtime.read")
  @ApiOperation({ summary: "Load an immutable retrieval snapshot" })
  getSnapshot(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.getSnapshot(request.tenantContext!.workspace.id, id);
  }

  @Get(":id") @Version("1") @Permissions("retrieval.runtime.read")
  @ApiOperation({ summary: "Load a workspace-isolated retrieval package and diagnostics" })
  get(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.get(request.tenantContext!.workspace.id, id);
  }
}
