import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse,
  ApiNotFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { CancelWorkflowExecutionDto, ExecuteWorkflowDto, ResolveApprovalDto,
  WorkflowExecutionListQueryDto } from "./dto/workflow-runtime.dto";
import { WorkflowRuntimeService } from "./workflow-runtime.service";

@ApiTags("Workflow Runtime") @ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active workspace membership and workflow runtime permission are required" })
@ApiNotFoundResponse({ description: "Workflow execution or dependency was not found in the active workspace" })
@Controller("workflow-runtime")
export class WorkflowRuntimeController {
  constructor(private readonly service: WorkflowRuntimeService) {}
  @Post("executions") @Version("1") @Permissions("workflow.execution.execute")
  @ApiOperation({ summary: "Execute a hash-verified immutable workflow version" })
  @ApiBadRequestResponse({ description: "Workflow graph, input, node configuration, or dependency is invalid" })
  @ApiConflictResponse({ description: "Workflow snapshot integrity or execution state changed" })
  execute(@Req() request: TenantRequest, @Body() dto: ExecuteWorkflowDto) { const context = request.tenantContext!;
    return this.service.execute(context.workspace.id, context.user.id, dto); }
  @Post("executions/:id/cancel") @Version("1") @Permissions("workflow.execution.cancel")
  @ApiOperation({ summary: "Cancel a running or waiting workflow through the Execution Kernel" })
  cancel(@Req() request: TenantRequest, @Param("id") id: string, @Body() dto: CancelWorkflowExecutionDto) {
    const context = request.tenantContext!; return this.service.cancel(context.workspace.id, context.user.id, id, dto); }
  @Post("executions/:id/approval") @Version("1") @Permissions("workflow.runtime.approve")
  @ApiOperation({ summary: "Resolve an approval node and resume or fail the workflow" })
  approve(@Req() request: TenantRequest, @Param("id") id: string, @Body() dto: ResolveApprovalDto) {
    const context = request.tenantContext!; return this.service.resolveApproval(context.workspace.id, context.user.id, id, dto); }
  @Get("executions") @Version("1") @Permissions("workflow.history.read")
  @ApiOperation({ summary: "Filter and paginate workspace workflow executions" })
  list(@Req() request: TenantRequest, @Query() query: WorkflowExecutionListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query); }
  @Get("executions/:id") @Version("1") @Permissions("workflow.runtime.read")
  @ApiOperation({ summary: "Get execution context, node timeline, diagnostics, and metrics" })
  get(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.get(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/history") @Version("1") @Permissions("workflow.history.read")
  history(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.history(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/diagnostics") @Version("1") @Permissions("workflow.history.read")
  diagnostics(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.diagnostics(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/metrics") @Version("1") @Permissions("workflow.history.read")
  metrics(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.metrics(request.tenantContext!.workspace.id, id); }
}
