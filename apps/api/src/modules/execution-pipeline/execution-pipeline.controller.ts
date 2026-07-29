import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CloneExecutionPipelineDto, CompareExecutionPipelineSnapshotsDto, CreateExecutionPipelineDto,
  ExecutionPipelineListQueryDto, ExecutionPipelineSnapshotQueryDto,
  RollbackExecutionPipelineDto, UpdateExecutionPipelineDto
} from "./dto/execution-pipeline.dto";
import { ExecutionPipelineService } from "./execution-pipeline.service";

@ApiTags("AI Execution Pipeline")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Execution Pipeline permission required" })
@ApiNotFoundResponse({ description: "Execution Pipeline resource was not found in the active workspace" })
@Controller("execution-pipelines")
export class ExecutionPipelineController {
  constructor(private readonly service: ExecutionPipelineService) {}
  @Post() @Version("1") @Permissions("execution.pipeline.create")
  @ApiBadRequestResponse({ description: "Pipeline graph, variables, or immutable asset references are invalid" })
  @ApiOperation({ summary: "Assemble a metadata-only execution plan draft" })
  create(@Req() req: TenantRequest, @Body() dto: CreateExecutionPipelineDto) {
    const context = req.tenantContext!;
    return this.service.create(context.workspace.id, context.user.id, dto);
  }
  @Patch(":id") @Version("1") @Permissions("execution.pipeline.update")
  @ApiOperation({ summary: "Update an execution pipeline draft" })
  update(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: UpdateExecutionPipelineDto) {
    const context = req.tenantContext!;
    return this.service.update(context.workspace.id, context.user.id, id, dto);
  }
  @Post(":id/validate") @Version("1") @Permissions("execution.pipeline.update")
  @ApiOperation({ summary: "Validate graph, dependencies, compatibility, and snapshot integrity" })
  validate(@Req() req: TenantRequest, @Param("id") id: string) {
    const context = req.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, id);
  }
  @Post(":id/publish") @Version("1") @Permissions("execution.pipeline.publish")
  @ApiOperation({ summary: "Publish an immutable execution plan snapshot and revision" })
  publish(@Req() req: TenantRequest, @Param("id") id: string) {
    const context = req.tenantContext!;
    return this.service.publish(context.workspace.id, context.user.id, id);
  }
  @Post(":id/rollback") @Version("1") @Permissions("execution.pipeline.rollback")
  @ApiOperation({ summary: "Create a new published revision from immutable history" })
  rollback(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: RollbackExecutionPipelineDto) {
    const context = req.tenantContext!;
    return this.service.rollback(context.workspace.id, context.user.id, id, dto.revisionId);
  }
  @Post(":id/clone") @Version("1") @Permissions("execution.pipeline.create")
  @ApiOperation({ summary: "Clone an execution pipeline with new persistence identities" })
  clone(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: CloneExecutionPipelineDto) {
    const context = req.tenantContext!;
    return this.service.clone(context.workspace.id, context.user.id, id, dto);
  }
  @Post(":id/archive") @Version("1") @Permissions("execution.pipeline.archive")
  @ApiOperation({ summary: "Archive a pipeline while preserving immutable history" })
  archive(@Req() req: TenantRequest, @Param("id") id: string) {
    const context = req.tenantContext!;
    return this.service.archive(context.workspace.id, context.user.id, id);
  }
  @Post(":id/restore") @Version("1") @Permissions("execution.pipeline.restore")
  @ApiOperation({ summary: "Restore archived or soft-deleted pipeline metadata" })
  restore(@Req() req: TenantRequest, @Param("id") id: string) {
    const context = req.tenantContext!;
    return this.service.restore(context.workspace.id, context.user.id, id);
  }
  @Delete(":id") @Version("1") @Permissions("execution.pipeline.delete")
  @ApiOperation({ summary: "Soft-delete a pipeline while preserving history" })
  softDelete(@Req() req: TenantRequest, @Param("id") id: string) {
    const context = req.tenantContext!;
    return this.service.softDelete(context.workspace.id, context.user.id, id);
  }
  @Get() @Version("1") @Permissions("execution.pipeline.read")
  @ApiOperation({ summary: "Filter and paginate workspace execution pipelines" })
  list(@Req() req: TenantRequest, @Query() query: ExecutionPipelineListQueryDto) {
    return this.service.list(req.tenantContext!.workspace.id, query);
  }
  @Get("snapshots/compare") @Version("1") @Permissions("execution.pipeline.read")
  @ApiOperation({ summary: "Compare immutable execution plan snapshots" })
  compare(@Req() req: TenantRequest, @Query() query: CompareExecutionPipelineSnapshotsDto) {
    return this.service.compare(req.tenantContext!.workspace.id, query.leftId, query.rightId);
  }
  @Get("snapshots") @Version("1") @Permissions("execution.pipeline.read")
  @ApiOperation({ summary: "Filter and paginate immutable execution plan snapshots" })
  listSnapshots(@Req() req: TenantRequest, @Query() query: ExecutionPipelineSnapshotQueryDto) {
    return this.service.listSnapshots(req.tenantContext!.workspace.id, query);
  }
  @Get("snapshots/:id") @Version("1") @Permissions("execution.pipeline.read")
  @ApiOperation({ summary: "Load an immutable execution plan snapshot" })
  getSnapshot(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.getSnapshot(req.tenantContext!.workspace.id, id);
  }
  @Get(":id") @Version("1") @Permissions("execution.pipeline.read")
  @ApiOperation({ summary: "Load an execution pipeline and revision history" })
  get(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.get(req.tenantContext!.workspace.id, id);
  }
}
