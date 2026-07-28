import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
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
  AppendExecutionEventDto,
  AppendExecutionLogDto,
  CancelExecutionDto,
  CreateExecutionRequestDto,
  CreateExecutionRunDto,
  ExecutionRequestListQueryDto,
  ExecutionRunListQueryDto,
  RecordExecutionFailureDto,
  RecordExecutionStepDto,
  TransitionExecutionDto
} from "./dto/execution-kernel.dto";
import { ExecutionKernelService } from "./execution-kernel.service";

@ApiTags("Execution Kernel")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Execution Kernel permission are required" })
@ApiNotFoundResponse({ description: "Execution record was not found in the active workspace" })
@Controller("execution-kernel")
export class ExecutionKernelController {
  constructor(private readonly service: ExecutionKernelService) {}

  @Get("requests") @Version("1") @Permissions("execution.kernel.read")
  @ApiOperation({ summary: "Filter and paginate workspace execution requests" })
  listRequests(@Req() r: TenantRequest, @Query() q: ExecutionRequestListQueryDto) {
    return this.service.listRequests(r.tenantContext!.workspace.id, q);
  }

  @Get("requests/:id") @Version("1") @Permissions("execution.kernel.read")
  @ApiOperation({ summary: "Get execution request history and associated runs" })
  getRequest(@Req() r: TenantRequest, @Param("id") id: string) {
    return this.service.getRequest(r.tenantContext!.workspace.id, id);
  }

  @Post("requests") @Version("1") @Permissions("execution.kernel.create")
  @ApiBadRequestResponse({ description: "Source reference, priority, correlation, or idempotency metadata is invalid" })
  @ApiConflictResponse({ description: "Idempotency key was reused with a different request" })
  @ApiOperation({ summary: "Create an idempotent execution request without executing it" })
  createRequest(@Req() r: TenantRequest, @Body() d: CreateExecutionRequestDto) {
    const c = r.tenantContext!;
    return this.service.createRequest(c.workspace.id, c.user.id, d);
  }

  @Post("requests/:id/runs") @Version("1") @Permissions("execution.kernel.create")
  @ApiOperation({ summary: "Create a requested execution run without starting execution" })
  createRun(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: CreateExecutionRunDto) {
    const c = r.tenantContext!;
    return this.service.createRun(c.workspace.id, c.user.id, id, d);
  }

  @Get("runs") @Version("1") @Permissions("execution.kernel.read")
  @ApiOperation({ summary: "Filter and paginate execution runs" })
  listRuns(@Req() r: TenantRequest, @Query() q: ExecutionRunListQueryDto) {
    return this.service.listRuns(r.tenantContext!.workspace.id, q);
  }

  @Get("runs/:id") @Version("1") @Permissions("execution.kernel.read")
  @ApiOperation({ summary: "Get run lifecycle, steps, append-only events, and structured logs" })
  getRun(@Req() r: TenantRequest, @Param("id") id: string) {
    return this.service.getRun(r.tenantContext!.workspace.id, id);
  }

  @Post("runs/:id/transition") @Version("1") @Permissions("execution.kernel.update")
  @ApiBadRequestResponse({ description: "Requested lifecycle transition is invalid" })
  @ApiConflictResponse({ description: "Expected state version is stale or state changed concurrently" })
  @ApiOperation({ summary: "Transactionally transition execution lifecycle state" })
  transition(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: TransitionExecutionDto) {
    const c = r.tenantContext!;
    return this.service.transition(c.workspace.id, c.user.id, id, d);
  }

  @Post("runs/:id/cancel") @Version("1") @Permissions("execution.kernel.manage")
  @ApiOperation({ summary: "Record a transactional cancellation request" })
  cancel(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: CancelExecutionDto) {
    const c = r.tenantContext!;
    return this.service.cancel(c.workspace.id, c.user.id, id, d);
  }

  @Post("runs/:id/failure") @Version("1") @Permissions("execution.kernel.manage")
  @ApiOperation({ summary: "Record terminal failure information and lifecycle event" })
  recordFailure(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: RecordExecutionFailureDto) {
    const c = r.tenantContext!;
    return this.service.recordFailure(c.workspace.id, c.user.id, id, d);
  }

  @Post("runs/:id/steps") @Version("1") @Permissions("execution.kernel.update")
  @ApiConflictResponse({ description: "Step sequence already exists or run is terminal" })
  @ApiOperation({ summary: "Append an ordered immutable execution step record" })
  recordStep(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: RecordExecutionStepDto) {
    const c = r.tenantContext!;
    return this.service.recordStep(c.workspace.id, c.user.id, id, d);
  }

  @Post("runs/:id/events") @Version("1") @Permissions("execution.kernel.audit")
  @ApiOperation({ summary: "Append a diagnostic event to the immutable execution timeline" })
  appendEvent(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: AppendExecutionEventDto) {
    const c = r.tenantContext!;
    return this.service.appendEvent(c.workspace.id, c.user.id, id, d);
  }

  @Post("runs/:id/logs") @Version("1") @Permissions("execution.kernel.audit")
  @ApiOperation({ summary: "Append a structured execution log record" })
  appendLog(@Req() r: TenantRequest, @Param("id") id: string, @Body() d: AppendExecutionLogDto) {
    const c = r.tenantContext!;
    return this.service.appendLog(c.workspace.id, c.user.id, id, d);
  }
}
