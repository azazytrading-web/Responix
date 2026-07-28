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
  CloneWorkflowDto,
  CreateWorkflowDto,
  PublishWorkflowDto,
  RollbackWorkflowDto,
  UpdateWorkflowDto,
  UpdateWorkflowTaxonomyDto,
  WorkflowListQueryDto,
  WorkflowTaxonomyDto
} from "./dto/workflow-engine.dto";
import { WorkflowEngineService } from "./workflow-engine.service";

@ApiTags("Workflow Engine")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Workflow Engine permission are required" })
@ApiNotFoundResponse({ description: "Workflow resource was not found in the active workspace" })
@Controller("workflow-engine")
export class WorkflowEngineController {
  constructor(private readonly service: WorkflowEngineService) {}

  @Get("categories") @Version("1") @Permissions("workflow.engine.read") @ApiOperation({ summary: "List workflow categories" })
  categories(@Req() r: TenantRequest) { return this.service.listCategories(r.tenantContext!.workspace.id); }
  @Post("categories") @Version("1") @Permissions("workflow.engine.manage") @ApiOperation({ summary: "Create a workflow category" })
  createCategory(@Req() r: TenantRequest, @Body() d: WorkflowTaxonomyDto) { const c = r.tenantContext!; return this.service.createCategory(c.workspace.id, c.user.id, d); }
  @Put("categories/:id") @Version("1") @Permissions("workflow.engine.manage") @ApiOperation({ summary: "Update a workflow category" })
  updateCategory(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateWorkflowTaxonomyDto) { const c = r.tenantContext!; return this.service.updateCategory(c.workspace.id, c.user.id, id, d); }
  @Delete("categories/:id") @Version("1") @Permissions("workflow.engine.manage") @ApiConflictResponse({ description: "Category is in use" }) @ApiOperation({ summary: "Delete an unused workflow category" })
  deleteCategory(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.deleteCategory(c.workspace.id, c.user.id, id); }

  @Get("tags") @Version("1") @Permissions("workflow.engine.read") @ApiOperation({ summary: "List workflow tags" })
  tags(@Req() r: TenantRequest) { return this.service.listTags(r.tenantContext!.workspace.id); }
  @Post("tags") @Version("1") @Permissions("workflow.engine.manage") @ApiOperation({ summary: "Create a workflow tag" })
  createTag(@Req() r: TenantRequest, @Body() d: WorkflowTaxonomyDto) { const c = r.tenantContext!; return this.service.createTag(c.workspace.id, c.user.id, d); }
  @Put("tags/:id") @Version("1") @Permissions("workflow.engine.manage") @ApiOperation({ summary: "Update a workflow tag" })
  updateTag(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateWorkflowTaxonomyDto) { const c = r.tenantContext!; return this.service.updateTag(c.workspace.id, c.user.id, id, d); }
  @Delete("tags/:id") @Version("1") @Permissions("workflow.engine.manage") @ApiConflictResponse({ description: "Tag is in use" }) @ApiOperation({ summary: "Delete an unused workflow tag" })
  deleteTag(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.deleteTag(c.workspace.id, c.user.id, id); }

  @Get("workflows") @Version("1") @Permissions("workflow.engine.read") @ApiOperation({ summary: "Search, filter, sort, and paginate workflow definitions" })
  list(@Req() r: TenantRequest, @Query() q: WorkflowListQueryDto) { return this.service.list(r.tenantContext!.workspace.id, q); }
  @Get("workflows/:id") @Version("1") @Permissions("workflow.engine.read") @ApiOperation({ summary: "Get a workspace-isolated workflow draft and graph" })
  get(@Req() r: TenantRequest, @Param("id") id: string) { return this.service.get(r.tenantContext!.workspace.id, id); }
  @Get("workflows/:id/history") @Version("1") @Permissions("workflow.engine.read") @ApiOperation({ summary: "Get immutable workflow version history" })
  history(@Req() r: TenantRequest, @Param("id") id: string) { return this.service.history(r.tenantContext!.workspace.id, id); }
  @Post("workflows") @Version("1") @Permissions("workflow.engine.write")
  @ApiBadRequestResponse({ description: "Graph topology, workspace references, metadata, or permission requirements are invalid" })
  @ApiOperation({ summary: "Create a workflow definition draft" })
  create(@Req() r: TenantRequest, @Body() d: CreateWorkflowDto) { const c = r.tenantContext!; return this.service.create(c.workspace.id, c.user.id, d); }
  @Put("workflows/:id") @Version("1") @Permissions("workflow.engine.write")
  @ApiBadRequestResponse({ description: "Only drafts may be edited and the complete draft graph must be valid" })
  @ApiOperation({ summary: "Update workflow draft metadata and topology" })
  update(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: UpdateWorkflowDto) { const c = r.tenantContext!; return this.service.updateDraft(c.workspace.id, c.user.id, id, d); }
  @Post("workflows/:id/publish") @Version("1") @Permissions("workflow.engine.publish")
  @ApiBadRequestResponse({ description: "Workflow graph is incomplete or invalid" })
  @ApiOperation({ summary: "Publish an immutable workflow snapshot" })
  publish(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: PublishWorkflowDto) { const c = r.tenantContext!; return this.service.publish(c.workspace.id, c.user.id, id, d); }
  @Post("workflows/:id/rollback") @Version("1") @Permissions("workflow.engine.rollback")
  @ApiOperation({ summary: "Create a new published revision from a prior immutable snapshot" })
  rollback(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: RollbackWorkflowDto) { const c = r.tenantContext!; return this.service.rollback(c.workspace.id, c.user.id, id, d); }
  @Post("workflows/:id/clone") @Version("1") @Permissions("workflow.engine.write")
  @ApiOperation({ summary: "Clone workflow metadata and topology into an independent draft" })
  clone(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: CloneWorkflowDto) { const c = r.tenantContext!; return this.service.clone(c.workspace.id, c.user.id, id, d); }
  @Post("workflows/:id/archive") @Version("1") @Permissions("workflow.engine.archive")
  @ApiOperation({ summary: "Archive a workflow without removing graph or version history" })
  archive(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.archive(c.workspace.id, c.user.id, id); }
  @Post("workflows/:id/restore") @Version("1") @Permissions("workflow.engine.archive")
  @ApiOperation({ summary: "Restore an archived or soft-deleted workflow" })
  restore(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.restore(c.workspace.id, c.user.id, id); }
  @Delete("workflows/:id") @Version("1") @Permissions("workflow.engine.delete")
  @ApiOperation({ summary: "Soft-delete a workflow while retaining immutable history" })
  delete(@Req() r: TenantRequest, @Param("id") id: string) { const c = r.tenantContext!; return this.service.delete(c.workspace.id, c.user.id, id); }
}
