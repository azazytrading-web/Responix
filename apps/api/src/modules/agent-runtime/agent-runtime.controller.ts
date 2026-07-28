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
  AgentRuntimeListQueryDto,
  PrepareAgentRuntimeDto
} from "./dto/agent-runtime.dto";
import { AgentRuntimeService } from "./agent-runtime.service";

@ApiTags("Agent Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Agent Runtime permission are required" })
@ApiNotFoundResponse({ description: "Agent runtime resource was not found in the active workspace" })
@Controller("agent-runtime")
export class AgentRuntimeController {
  constructor(private readonly service: AgentRuntimeService) {}

  @Post("runtimes") @Version("1") @Permissions("agent.runtime.prepare")
  @ApiBadRequestResponse({ description: "Agent, prompts, provider, profile, context, or variables are not runtime-ready" })
  @ApiOperation({ summary: "Resolve and persist an Agent Runtime preparation without invoking a provider" })
  prepare(@Req() request: TenantRequest, @Body() dto: PrepareAgentRuntimeDto) {
    const context = request.tenantContext!;
    return this.service.prepare(context.workspace.id, context.user.id, dto);
  }

  @Get("runtimes") @Version("1") @Permissions("agent.runtime.read")
  @ApiOperation({ summary: "Filter and paginate prepared Agent Runtime records" })
  list(@Req() request: TenantRequest, @Query() query: AgentRuntimeListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }

  @Get("runtimes/:id") @Version("1") @Permissions("agent.runtime.read")
  @ApiOperation({ summary: "Load Agent Runtime preparation, conversation metadata, and snapshot reference" })
  get(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.get(request.tenantContext!.workspace.id, id);
  }

  @Post("runtimes/:id/validate") @Version("1") @Permissions("agent.runtime.validate")
  @ApiOperation({ summary: "Revalidate runtime readiness against current workspace configuration" })
  validate(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, id);
  }

  @Post("runtimes/:id/resolve") @Version("1") @Permissions("agent.runtime.manage")
  @ApiBadRequestResponse({ description: "Stored preparation can no longer be resolved" })
  @ApiOperation({ summary: "Resolve a prepared runtime without executing or mutating it" })
  resolve(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.resolve(context.workspace.id, context.user.id, id);
  }

  @Post("runtimes/:id/snapshot") @Version("1") @Permissions("agent.runtime.snapshot")
  @ApiConflictResponse({ description: "Runtime already has an immutable snapshot" })
  @ApiOperation({ summary: "Create the immutable Provider Runtime handoff snapshot" })
  snapshot(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.createSnapshot(context.workspace.id, context.user.id, id);
  }

  @Get("snapshots/:id") @Version("1") @Permissions("agent.runtime.read")
  @ApiOperation({ summary: "Load an immutable Agent Runtime snapshot" })
  getSnapshot(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.getSnapshot(request.tenantContext!.workspace.id, id);
  }
}

