import { Body, Controller, Delete, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CloneConversationRuntimeDto, CompareConversationSnapshotsDto,
  ConversationRuntimeListQueryDto, ConversationSnapshotListQueryDto,
  PrepareConversationRuntimeDto, RollbackConversationRuntimeDto,
  TransitionConversationStateDto
} from "./dto/conversation-runtime.dto";
import { ConversationRuntimeService } from "./conversation-runtime.service";

@ApiTags("Conversation Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Conversation Runtime permission required" })
@ApiNotFoundResponse({ description: "Conversation Runtime resource was not found in the active workspace" })
@Controller("conversation-runtime")
export class ConversationRuntimeController {
  constructor(private readonly service: ConversationRuntimeService) {}

  @Post() @Version("1") @Permissions("conversation.runtime.create")
  @ApiBadRequestResponse({ description: "Conversation metadata or referenced resources are invalid" })
  @ApiOperation({ summary: "Prepare normalized conversation runtime metadata without AI execution" })
  prepare(@Req() request: TenantRequest, @Body() dto: PrepareConversationRuntimeDto) {
    const context = request.tenantContext!;
    return this.service.prepare(context.workspace.id, context.user.id, dto);
  }

  @Post(":id/validate") @Version("1") @Permissions("conversation.runtime.update")
  @ApiOperation({ summary: "Validate normalized conversation metadata and snapshot integrity" })
  validate(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, id);
  }

  @Post(":id/state") @Version("1") @Permissions("conversation.runtime.update")
  @ApiOperation({ summary: "Apply a validated conversation metadata state transition" })
  transition(@Req() request: TenantRequest, @Param("id") id: string,
    @Body() dto: TransitionConversationStateDto) {
    const context = request.tenantContext!;
    return this.service.transition(context.workspace.id, context.user.id, id, dto);
  }

  @Post(":id/publish") @Version("1") @Permissions("conversation.runtime.publish")
  @ApiOperation({ summary: "Publish immutable conversation snapshot and version records" })
  publish(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.publish(context.workspace.id, context.user.id, id);
  }

  @Post(":id/rollback") @Version("1") @Permissions("conversation.runtime.rollback")
  @ApiOperation({ summary: "Rollback by creating a new published revision from immutable history" })
  rollback(@Req() request: TenantRequest, @Param("id") id: string,
    @Body() dto: RollbackConversationRuntimeDto) {
    const context = request.tenantContext!;
    return this.service.rollback(context.workspace.id, context.user.id, id, dto.versionId);
  }

  @Post(":id/clone") @Version("1") @Permissions("conversation.runtime.clone")
  @ApiOperation({ summary: "Clone conversation metadata with entirely new persistence identities" })
  clone(@Req() request: TenantRequest, @Param("id") id: string,
    @Body() dto: CloneConversationRuntimeDto) {
    const context = request.tenantContext!;
    return this.service.clone(context.workspace.id, context.user.id, id, dto);
  }

  @Post(":id/archive") @Version("1") @Permissions("conversation.runtime.archive")
  @ApiOperation({ summary: "Archive conversation runtime without deleting revision history" })
  archive(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.archive(context.workspace.id, context.user.id, id);
  }

  @Post(":id/restore") @Version("1") @Permissions("conversation.runtime.restore")
  @ApiOperation({ summary: "Restore archived or soft-deleted conversation runtime metadata" })
  restore(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.restore(context.workspace.id, context.user.id, id);
  }

  @Delete(":id") @Version("1") @Permissions("conversation.runtime.delete")
  @ApiOperation({ summary: "Soft-delete conversation runtime while preserving immutable history" })
  softDelete(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.softDelete(context.workspace.id, context.user.id, id);
  }

  @Get() @Version("1") @Permissions("conversation.runtime.read")
  @ApiOperation({ summary: "Filter and paginate workspace conversation runtime records" })
  list(@Req() request: TenantRequest, @Query() query: ConversationRuntimeListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }

  @Get("snapshots/compare") @Version("1") @Permissions("conversation.runtime.compare")
  @ApiOperation({ summary: "Compare immutable conversation runtime snapshots" })
  compare(@Req() request: TenantRequest, @Query() query: CompareConversationSnapshotsDto) {
    return this.service.compare(request.tenantContext!.workspace.id, query.leftId, query.rightId);
  }

  @Get("snapshots") @Version("1") @Permissions("conversation.runtime.read")
  @ApiOperation({ summary: "Filter and paginate immutable conversation runtime snapshots" })
  listSnapshots(@Req() request: TenantRequest, @Query() query: ConversationSnapshotListQueryDto) {
    return this.service.listSnapshots(request.tenantContext!.workspace.id, query);
  }

  @Get("snapshots/:id") @Version("1") @Permissions("conversation.runtime.read")
  @ApiOperation({ summary: "Load an immutable conversation runtime snapshot" })
  getSnapshot(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.getSnapshot(request.tenantContext!.workspace.id, id);
  }

  @Get(":id") @Version("1") @Permissions("conversation.runtime.read")
  @ApiOperation({ summary: "Load normalized conversation runtime metadata and history" })
  get(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.get(request.tenantContext!.workspace.id, id);
  }
}
