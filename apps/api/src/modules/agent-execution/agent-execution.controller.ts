import { Body, Controller, Delete, Get, MessageEvent, Param, Post, Query, Req, Sse, Version } from "@nestjs/common";
import type { Observable } from "rxjs";
import type { IncomingMessage } from "node:http";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  AgentExecutionListQueryDto, CancelAgentExecutionDto, ExecuteAgentExecutionDto,
  PrepareAgentExecutionDto, StreamAgentExecutionDto
} from "./dto/agent-execution.dto";
import { AgentExecutionService } from "./agent-execution.service";

@ApiTags("Agent Execution")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and Agent Execution permission required" })
@ApiNotFoundResponse({ description: "Execution or runtime asset was not found in the workspace" })
@Controller("agent-executions")
export class AgentExecutionController {
  constructor(private readonly service: AgentExecutionService) {}
  @Post() @Version("1") @Permissions("agent.execution.create")
  @ApiOperation({ summary: "Coordinate immutable runtime assets into an agent execution plan" })
  @ApiBadRequestResponse({ description: "Runtime dependencies or lifecycle state are invalid" })
  prepare(@Req() req: TenantRequest, @Body() dto: PrepareAgentExecutionDto) {
    const context = req.tenantContext!;
    return this.service.prepare(context.workspace.id, context.user.id, dto);
  }

  @Post(":id/cancel") @Version("1") @Permissions("agent.execution.cancel")
  @ApiOperation({ summary: "Cancel a coordinated agent execution through Execution Kernel" })
  cancel(
    @Req() req: TenantRequest, @Param("id") id: string,
    @Body() dto: CancelAgentExecutionDto
  ) {
    const context = req.tenantContext!;
    return this.service.cancel(context.workspace.id, context.user.id, id, dto);
  }
  @Get() @Version("1") @Permissions("agent.execution.read")
  @ApiOperation({ summary: "Filter and paginate agent execution plans" })
  list(@Req() req: TenantRequest, @Query() query: AgentExecutionListQueryDto) {
    return this.service.list(req.tenantContext!.workspace.id, query);
  }
  @Get(":id") @Version("1") @Permissions("agent.execution.read")
  @ApiOperation({ summary: "Load an immutable agent execution plan" })
  get(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.get(req.tenantContext!.workspace.id, id);
  }
}

@ApiTags("Agent Execution")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and execution permissions required" })
@Controller("agent-execution")
export class UnifiedAgentExecutionController {
  constructor(private readonly service: AgentExecutionService) {}

  @Post("execute") @Version("1") @Permissions("agent.execution.create", "ai.invoke")
  @ApiOperation({ summary: "Execute a validated immutable agent runtime plan" })
  @ApiBadRequestResponse({ description: "Runtime dependencies or the rendered prompt are invalid" })
  execute(@Req() req: TenantRequest, @Body() dto: ExecuteAgentExecutionDto) {
    const context = req.tenantContext!;
    return this.service.execute(context.workspace.id, context.user.id, dto);
  }

  @Post("stream") @Version("1") @Permissions("agent.execution.create", "ai.invoke", "stream.runtime.create")
  @ApiOperation({ summary: "Start a real provider stream backed by immutable runtime assets" })
  stream(@Req() req: TenantRequest, @Body() dto: StreamAgentExecutionDto) {
    const context = req.tenantContext!;
    return this.service.stream(context.workspace.id, context.user.id, dto);
  }

  @Delete("stream/:sessionId") @Version("1") @Permissions("agent.execution.cancel", "stream.runtime.cancel")
  @ApiOperation({ summary: "Cancel an active provider stream" })
  cancelStream(@Req() req: TenantRequest, @Param("sessionId") sessionId: string) {
    const context = req.tenantContext!;
    return this.service.cancelStream(context.workspace.id, context.user.id, sessionId);
  }

  @Sse("stream/:sessionId/events") @Permissions("agent.execution.read", "stream.runtime.read")
  @ApiOperation({ summary: "Receive incremental provider stream events over SSE" })
  async events(@Req() req: TenantRequest & Pick<IncomingMessage, "once">, @Param("sessionId") sessionId: string): Promise<Observable<MessageEvent>> {
    const context = req.tenantContext!;
    const events = await this.service.observeStream(context.workspace.id, sessionId);
    req.once("close", () => {
      void this.service.cancelStream(context.workspace.id, context.user.id, sessionId)
        .catch(() => undefined);
    });
    return events as unknown as Observable<MessageEvent>;
  }
}
