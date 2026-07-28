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
import { AgentStudioService } from "./agent-studio.service";
import {
  AgentListQueryDto,
  CloneAgentDto,
  CreateAgentDto,
  PublishAgentDto,
  RollbackAgentDto,
  UpdateAgentDraftDto
} from "./dto/agent-studio.dto";

@ApiTags("Agent Studio")
@ApiBearerAuth()
@ApiForbiddenResponse({
  description: "Active workspace membership and the endpoint-specific Agent Studio permission are required"
})
@ApiNotFoundResponse({ description: "Agent was not found in the active workspace" })
@Controller("agent-studio/agents")
export class AgentStudioController {
  constructor(private readonly service: AgentStudioService) {}

  @Get()
  @Version("1")
  @Permissions("agent.studio.read")
  @ApiOperation({ summary: "List workspace Agent Studio agents" })
  list(@Req() request: TenantRequest, @Query() query: AgentListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }

  @Get(":agentId")
  @Version("1")
  @Permissions("agent.studio.read")
  @ApiOperation({ summary: "Get an Agent Studio agent" })
  get(@Req() request: TenantRequest, @Param("agentId") agentId: string) {
    return this.service.get(request.tenantContext!.workspace.id, agentId);
  }

  @Get(":agentId/history")
  @Version("1")
  @Permissions("agent.studio.read")
  @ApiOperation({ summary: "Get immutable Agent Studio version history" })
  history(@Req() request: TenantRequest, @Param("agentId") agentId: string) {
    return this.service.history(request.tenantContext!.workspace.id, agentId);
  }

  @Post()
  @Version("1")
  @Permissions("agent.studio.write")
  @ApiBadRequestResponse({ description: "Agent configuration or a referenced resource is invalid" })
  @ApiConflictResponse({ description: "Agent name or slug already exists in the workspace" })
  @ApiOperation({ summary: "Create an Agent Studio draft" })
  create(@Req() request: TenantRequest, @Body() dto: CreateAgentDto) {
    const context = request.tenantContext!;
    return this.service.create(context.workspace.id, context.user.id, dto);
  }

  @Put(":agentId")
  @Version("1")
  @Permissions("agent.studio.write")
  @ApiBadRequestResponse({ description: "Only draft agents can be edited" })
  @ApiOperation({ summary: "Update an Agent Studio draft" })
  update(
    @Req() request: TenantRequest,
    @Param("agentId") agentId: string,
    @Body() dto: UpdateAgentDraftDto
  ) {
    const context = request.tenantContext!;
    return this.service.updateDraft(context.workspace.id, context.user.id, agentId, dto);
  }

  @Post(":agentId/publish")
  @Version("1")
  @Permissions("agent.studio.publish")
  @ApiBadRequestResponse({ description: "Only draft agents can be published" })
  @ApiOperation({ summary: "Publish an immutable Agent Studio version" })
  publish(
    @Req() request: TenantRequest,
    @Param("agentId") agentId: string,
    @Body() dto: PublishAgentDto
  ) {
    const context = request.tenantContext!;
    return this.service.publish(context.workspace.id, context.user.id, agentId, dto);
  }

  @Post(":agentId/rollback")
  @Version("1")
  @Permissions("agent.studio.rollback")
  @ApiOperation({ summary: "Create a new published version from a prior Agent Studio version" })
  rollback(
    @Req() request: TenantRequest,
    @Param("agentId") agentId: string,
    @Body() dto: RollbackAgentDto
  ) {
    const context = request.tenantContext!;
    return this.service.rollback(context.workspace.id, context.user.id, agentId, dto);
  }

  @Post(":agentId/clone")
  @Version("1")
  @Permissions("agent.studio.write")
  @ApiConflictResponse({ description: "Clone name or slug already exists in the workspace" })
  @ApiOperation({ summary: "Clone an agent into an independent draft" })
  clone(
    @Req() request: TenantRequest,
    @Param("agentId") agentId: string,
    @Body() dto: CloneAgentDto
  ) {
    const context = request.tenantContext!;
    return this.service.clone(context.workspace.id, context.user.id, agentId, dto);
  }

  @Post(":agentId/archive")
  @Version("1")
  @Permissions("agent.studio.archive")
  @ApiOperation({ summary: "Archive an Agent Studio agent while retaining history" })
  archive(@Req() request: TenantRequest, @Param("agentId") agentId: string) {
    const context = request.tenantContext!;
    return this.service.archive(context.workspace.id, context.user.id, agentId);
  }

  @Post(":agentId/restore")
  @Version("1")
  @Permissions("agent.studio.archive")
  @ApiOperation({ summary: "Restore an archived or soft-deleted Agent Studio agent" })
  restore(@Req() request: TenantRequest, @Param("agentId") agentId: string) {
    const context = request.tenantContext!;
    return this.service.restore(context.workspace.id, context.user.id, agentId);
  }

  @Delete(":agentId")
  @Version("1")
  @Permissions("agent.studio.delete")
  @ApiOperation({ summary: "Soft-delete an Agent Studio agent without deleting history" })
  delete(@Req() request: TenantRequest, @Param("agentId") agentId: string) {
    const context = request.tenantContext!;
    return this.service.delete(context.workspace.id, context.user.id, agentId);
  }
}
