import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CloneExecutionProfileDto,
  CreateExecutionProfileDto,
  ExecutionPriorityLevelDto,
  ExecutionProfileListQueryDto,
  OrchestrationTaxonomyDto,
  PublishExecutionProfileDto,
  RollbackExecutionProfileDto,
  UpdateExecutionPriorityLevelDto,
  UpdateExecutionProfileDto,
  UpdateOrchestrationTaxonomyDto
} from "./dto/runtime-orchestration.dto";
import { RuntimeOrchestrationService } from "./runtime-orchestration.service";

@ApiTags("Runtime Orchestration")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Runtime Orchestration permission are required" })
@ApiNotFoundResponse({ description: "Runtime orchestration resource was not found in the active workspace" })
@Controller("runtime-orchestration")
export class RuntimeOrchestrationController {
  constructor(private readonly service: RuntimeOrchestrationService) {}

  @Get("queues") @Version("1") @Permissions("runtime.orchestration.read") @ApiOperation({ summary: "List queue metadata definitions" })
  queues(@Req() r: TenantRequest) { return this.service.listQueues(r.tenantContext!.workspace.id); }
  @Post("queues") @Version("1") @Permissions("runtime.orchestration.manage") @ApiOperation({ summary: "Create queue metadata without provisioning a queue" })
  createQueue(@Req() r: TenantRequest, @Body() d: OrchestrationTaxonomyDto) { const c = r.tenantContext!; return this.service.createQueue(c.workspace.id, c.user.id, d); }
  @Put("queues/:id") @Version("1") @Permissions("runtime.orchestration.manage") @ApiOperation({ summary: "Update queue metadata" })
  updateQueue(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateOrchestrationTaxonomyDto) { const c = r.tenantContext!; return this.service.updateQueue(c.workspace.id, c.user.id, id, d); }
  @Delete("queues/:id") @Version("1") @Permissions("runtime.orchestration.manage") @ApiConflictResponse({ description: "Queue definition is in use" }) @ApiOperation({ summary: "Delete unused queue metadata" })
  deleteQueue(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.deleteQueue(c.workspace.id, c.user.id, id); }

  @Get("priorities") @Version("1") @Permissions("runtime.orchestration.read") @ApiOperation({ summary: "List priority level metadata" })
  priorities(@Req() r: TenantRequest) { return this.service.listPriorities(r.tenantContext!.workspace.id); }
  @Post("priorities") @Version("1") @Permissions("runtime.orchestration.manage") @ApiOperation({ summary: "Create a validated priority level" })
  createPriority(@Req() r: TenantRequest, @Body() d: ExecutionPriorityLevelDto) { const c = r.tenantContext!; return this.service.createPriority(c.workspace.id, c.user.id, d); }
  @Put("priorities/:id") @Version("1") @Permissions("runtime.orchestration.manage") @ApiOperation({ summary: "Update a priority level" })
  updatePriority(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateExecutionPriorityLevelDto) { const c = r.tenantContext!; return this.service.updatePriority(c.workspace.id, c.user.id, id, d); }
  @Delete("priorities/:id") @Version("1") @Permissions("runtime.orchestration.manage") @ApiConflictResponse({ description: "Priority level is in use" }) @ApiOperation({ summary: "Delete an unused priority level" })
  deletePriority(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.deletePriority(c.workspace.id, c.user.id, id); }

  @Get("tags") @Version("1") @Permissions("runtime.orchestration.read") @ApiOperation({ summary: "List execution tags" })
  tags(@Req() r: TenantRequest) { return this.service.listTags(r.tenantContext!.workspace.id); }
  @Post("tags") @Version("1") @Permissions("runtime.orchestration.manage") @ApiOperation({ summary: "Create an execution tag" })
  createTag(@Req() r: TenantRequest, @Body() d: OrchestrationTaxonomyDto) { const c = r.tenantContext!; return this.service.createTag(c.workspace.id, c.user.id, d); }
  @Put("tags/:id") @Version("1") @Permissions("runtime.orchestration.manage") @ApiOperation({ summary: "Update an execution tag" })
  updateTag(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateOrchestrationTaxonomyDto) { const c = r.tenantContext!; return this.service.updateTag(c.workspace.id, c.user.id, id, d); }
  @Delete("tags/:id") @Version("1") @Permissions("runtime.orchestration.manage") @ApiConflictResponse({ description: "Execution tag is in use" }) @ApiOperation({ summary: "Delete an unused execution tag" })
  deleteTag(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.deleteTag(c.workspace.id, c.user.id, id); }

  @Get("profiles") @Version("1") @Permissions("runtime.orchestration.read") @ApiOperation({ summary: "Search, filter, sort, and paginate execution profiles" })
  list(@Req() r: TenantRequest, @Query() q: ExecutionProfileListQueryDto) { return this.service.list(r.tenantContext!.workspace.id, q); }
  @Get("profiles/:id") @Version("1") @Permissions("runtime.orchestration.read") @ApiOperation({ summary: "Get an execution profile and orchestration metadata" })
  get(@Req() r: TenantRequest, @Param("id") id: string) { return this.service.get(r.tenantContext!.workspace.id, id); }
  @Get("profiles/:id/history") @Version("1") @Permissions("runtime.orchestration.read") @ApiOperation({ summary: "Get immutable execution profile history" })
  history(@Req() r: TenantRequest, @Param("id") id: string) { return this.service.history(r.tenantContext!.workspace.id, id); }
  @Post("profiles") @Version("1") @Permissions("runtime.orchestration.write")
  @ApiBadRequestResponse({ description: "Policies, dependencies, limits, or workspace references are invalid" })
  @ApiOperation({ summary: "Create an execution profile draft" })
  create(@Req() r: TenantRequest, @Body() d: CreateExecutionProfileDto) { const c = r.tenantContext!; return this.service.create(c.workspace.id, c.user.id, d); }
  @Put("profiles/:id") @Version("1") @Permissions("runtime.orchestration.write")
  @ApiBadRequestResponse({ description: "Only drafts may be edited and all orchestration metadata must remain valid" })
  @ApiOperation({ summary: "Update an execution profile draft" })
  update(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateExecutionProfileDto) { const c = r.tenantContext!; return this.service.updateDraft(c.workspace.id, c.user.id, id, d); }
  @Post("profiles/:id/publish") @Version("1") @Permissions("runtime.orchestration.publish") @ApiOperation({ summary: "Publish an immutable orchestration metadata snapshot" })
  publish(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: PublishExecutionProfileDto) { const c = r.tenantContext!; return this.service.publish(c.workspace.id, c.user.id, id, d); }
  @Post("profiles/:id/rollback") @Version("1") @Permissions("runtime.orchestration.rollback") @ApiOperation({ summary: "Create a new published revision from an earlier snapshot" })
  rollback(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: RollbackExecutionProfileDto) { const c = r.tenantContext!; return this.service.rollback(c.workspace.id, c.user.id, id, d); }
  @Post("profiles/:id/clone") @Version("1") @Permissions("runtime.orchestration.write") @ApiOperation({ summary: "Clone orchestration metadata into an independent draft" })
  clone(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: CloneExecutionProfileDto) { const c = r.tenantContext!; return this.service.clone(c.workspace.id, c.user.id, id, d); }
  @Post("profiles/:id/archive") @Version("1") @Permissions("runtime.orchestration.archive") @ApiOperation({ summary: "Archive an execution profile without deleting history" })
  archive(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.archive(c.workspace.id, c.user.id, id); }
  @Post("profiles/:id/restore") @Version("1") @Permissions("runtime.orchestration.archive") @ApiOperation({ summary: "Restore an archived or soft-deleted execution profile" })
  restore(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.restore(c.workspace.id, c.user.id, id); }
  @Delete("profiles/:id") @Version("1") @Permissions("runtime.orchestration.delete") @ApiOperation({ summary: "Soft-delete an execution profile while retaining history" })
  delete(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.delete(c.workspace.id, c.user.id, id); }
}
