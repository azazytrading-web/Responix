import { Body, Controller, Delete, Get, Param, Post, Query, Req, Sse, Version } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse,
  ApiNotFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage } from "node:http";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { CancelToolExecutionDto, ExecuteToolDto, ToolExecutionListQueryDto } from "./dto/tool-runtime.dto";
import { ToolRuntimeService } from "./tool-runtime.service";

@ApiTags("Tool Runtime") @ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active workspace membership and tool permissions are required" })
@ApiNotFoundResponse({ description: "Tool version, execution, or dependency was not found in the active workspace" })
@Controller("tool-runtime")
export class ToolRuntimeController {
  constructor(private readonly service: ToolRuntimeService) {}
  @Post("executions") @Version("1") @Permissions("tool.execution.execute")
  @ApiOperation({ summary: "Execute a hash-verified immutable tool version" })
  @ApiBadRequestResponse({ description: "Tool input, output, policy, compatibility, or dependency is invalid" })
  @ApiConflictResponse({ description: "Tool snapshot integrity or execution state changed" })
  execute(@Req() request: TenantRequest, @Body() dto: ExecuteToolDto) { const context = request.tenantContext!;
    return this.service.execute(context.workspace.id, context.user.id, dto); }
  @Delete("executions/:id") @Version("1") @Permissions("tool.execution.cancel")
  @ApiOperation({ summary: "Cancel an active tool execution and its Execution Kernel run" })
  cancel(@Req() request: TenantRequest, @Param("id") id: string, @Body() dto: CancelToolExecutionDto) {
    const context = request.tenantContext!; return this.service.cancel(context.workspace.id, context.user.id, id, dto.reason); }
  @Get("executions") @Version("1") @Permissions("tool.history.read")
  @ApiOperation({ summary: "Filter and paginate immutable tool invocation history" })
  list(@Req() request: TenantRequest, @Query() query: ToolExecutionListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query); }
  @Get("executions/:id") @Version("1") @Permissions("tool.runtime.read")
  get(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.get(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/history") @Version("1") @Permissions("tool.history.read")
  history(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.history(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/diagnostics") @Version("1") @Permissions("tool.history.read")
  diagnostics(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.diagnostics(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/metrics") @Version("1") @Permissions("tool.history.read")
  metrics(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.metrics(request.tenantContext!.workspace.id, id); }
  @Get("executions/:id/events") @Version("1") @Permissions("tool.history.read")
  persistedEvents(@Req() request: TenantRequest, @Param("id") id: string) { return this.service.events(request.tenantContext!.workspace.id, id); }
  @Sse("executions/:id/stream") @Permissions("tool.runtime.stream")
  @ApiOperation({ summary: "Receive tool progress, partial-output, and terminal events over SSE" })
  async stream(@Req() request: TenantRequest & Pick<IncomingMessage, "once">,
    @Param("id") id: string): Promise<Observable<MessageEvent>> {
    const events = await this.service.observe(request.tenantContext!.workspace.id, id);
    return events as unknown as Observable<MessageEvent>;
  }
}
