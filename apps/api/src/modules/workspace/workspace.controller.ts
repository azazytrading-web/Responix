import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Version
} from "@nestjs/common";
import { Permissions } from "../auth/auth.guard";
import type { AuthClaims } from "../auth/auth.types";
import { CurrentUser, CurrentWorkspace } from "../auth/current-user.decorator";
import { AllowInactiveWorkspace, SkipTenantContext } from "../tenant/tenant.metadata";
import {
  CreateWorkspaceDto,
  InvitationTokenDto,
  InviteMemberDto,
  ListMembersQueryDto,
  MembershipIdParamDto,
  UpdateMemberRoleDto,
  UpdateWorkspaceDto
} from "./dto/workspace.dto";
import { WorkspaceService } from "./workspace.service";

@Controller("workspaces")
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Permissions("workspace.create")
  @Post()
  @Version("1")
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateWorkspaceDto) {
    return this.service.create(user.id, dto);
  }

  @Permissions("workspace.read")
  @Get("current")
  @Version("1")
  get(@CurrentWorkspace() workspace: { id: string }, @CurrentUser() user: { id: string }) {
    return this.service.workspace(workspace.id, user.id);
  }

  @Permissions("workspace.update")
  @Patch("current")
  @Version("1")
  update(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateWorkspaceDto
  ) {
    return this.service.update(workspace.id, user.id, dto);
  }

  @Permissions("workspace.update")
  @Post("current/suspend")
  @Version("1")
  suspend(@CurrentWorkspace() workspace: { id: string }, @CurrentUser() user: { id: string }) {
    return this.service.suspendWorkspace(workspace.id, user.id);
  }

  @Permissions("workspace.update")
  @Post("current/archive")
  @Version("1")
  archive(@CurrentWorkspace() workspace: { id: string }, @CurrentUser() user: { id: string }) {
    return this.service.archiveWorkspace(workspace.id, user.id);
  }

  @AllowInactiveWorkspace()
  @Permissions("workspace.update")
  @Post("current/restore")
  @Version("1")
  restore(@CurrentWorkspace() workspace: { id: string }, @CurrentUser() user: { id: string }) {
    return this.service.restoreWorkspace(workspace.id, user.id);
  }

  @Permissions("workspace.update")
  @Delete("current")
  @Version("1")
  softDelete(@CurrentWorkspace() workspace: { id: string }, @CurrentUser() user: { id: string }) {
    return this.service.softDeleteWorkspace(workspace.id, user.id);
  }

  @Permissions("workspace.members.read")
  @Get("current/members")
  @Version("1")
  members(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Query() query: ListMembersQueryDto
  ) {
    return this.service.members(workspace.id, user.id, query);
  }

  @Permissions("workspace.members.manage")
  @Post("current/members")
  @Version("1")
  invite(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: InviteMemberDto
  ) {
    return this.service.invite(workspace.id, user.id, dto.userId, dto.roleId);
  }

  @SkipTenantContext()
  @Post("invitations/accept")
  @Version("1")
  accept(@Req() request: { user?: AuthClaims }, @Body() dto: InvitationTokenDto) {
    return this.service.acceptInvitation(dto.token, request.user!.sub);
  }

  @SkipTenantContext()
  @Post("invitations/reject")
  @Version("1")
  reject(@Req() request: { user?: AuthClaims }, @Body() dto: InvitationTokenDto) {
    return this.service.rejectInvitation(dto.token, request.user!.sub);
  }

  @Permissions("workspace.members.manage")
  @Delete("current/members/:membershipId/invitation")
  @Version("1")
  revokeInvitation(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return this.service.revokeInvitation(workspace.id, user.id, params.membershipId);
  }

  @Permissions("workspace.members.manage")
  @Delete("current/members/:membershipId")
  @Version("1")
  remove(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return this.service.removeMember(workspace.id, user.id, params.membershipId);
  }

  @Permissions("workspace.members.manage")
  @Post("current/members/:membershipId/suspend")
  @Version("1")
  suspendMember(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return this.service.suspendMember(workspace.id, user.id, params.membershipId);
  }

  @Permissions("workspace.members.manage")
  @Post("current/members/:membershipId/restore")
  @Version("1")
  restoreMember(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return this.service.restoreMember(workspace.id, user.id, params.membershipId);
  }

  @Permissions("workspace.members.manage")
  @Patch("current/members/:membershipId/role")
  @Version("1")
  updateMemberRole(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.service.updateMemberRole(workspace.id, user.id, params.membershipId, dto.roleId);
  }
}
