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
import {
  InvitationResponseDto,
  MemberListResponseDto,
  SafeMembershipResponseDto,
  WorkspaceCreationResponseDto,
  WorkspaceResponseDto
} from "./dto/workspace-response.dto";
import { WorkspaceService } from "./workspace.service";

@Controller("workspaces")
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Permissions("workspace.create")
  @Post()
  @Version("1")
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateWorkspaceDto) {
    return WorkspaceCreationResponseDto.from(await this.service.create(user.id, dto));
  }

  @Permissions("workspace.read")
  @Get("current")
  @Version("1")
  async get(@CurrentWorkspace() workspace: { id: string }, @CurrentUser() user: { id: string }) {
    return WorkspaceResponseDto.from(await this.service.workspace(workspace.id, user.id));
  }

  @Permissions("workspace.update")
  @Patch("current")
  @Version("1")
  async update(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateWorkspaceDto
  ) {
    return WorkspaceResponseDto.from(await this.service.update(workspace.id, user.id, dto));
  }

  @Permissions("workspace.update")
  @Post("current/suspend")
  @Version("1")
  async suspend(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string }
  ) {
    return WorkspaceResponseDto.from(await this.service.suspendWorkspace(workspace.id, user.id));
  }

  @Permissions("workspace.update")
  @Post("current/archive")
  @Version("1")
  async archive(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string }
  ) {
    return WorkspaceResponseDto.from(await this.service.archiveWorkspace(workspace.id, user.id));
  }

  @AllowInactiveWorkspace()
  @Permissions("workspace.update")
  @Post("current/restore")
  @Version("1")
  async restore(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string }
  ) {
    return WorkspaceResponseDto.from(await this.service.restoreWorkspace(workspace.id, user.id));
  }

  @Permissions("workspace.update")
  @Delete("current")
  @Version("1")
  async softDelete(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string }
  ) {
    return WorkspaceResponseDto.from(
      await this.service.softDeleteWorkspace(workspace.id, user.id)
    );
  }

  @Permissions("workspace.members.read")
  @Get("current/members")
  @Version("1")
  async members(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Query() query: ListMembersQueryDto
  ) {
    return MemberListResponseDto.from(await this.service.members(workspace.id, user.id, query));
  }

  @Permissions("workspace.members.manage")
  @Post("current/members")
  @Version("1")
  async invite(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: InviteMemberDto
  ) {
    return InvitationResponseDto.from(
      await this.service.invite(workspace.id, user.id, dto.userId, dto.roleId)
    );
  }

  @SkipTenantContext()
  @Post("invitations/accept")
  @Version("1")
  async accept(@Req() request: { user?: AuthClaims }, @Body() dto: InvitationTokenDto) {
    return SafeMembershipResponseDto.from(
      await this.service.acceptInvitation(dto.token, request.user!.sub)
    );
  }

  @SkipTenantContext()
  @Post("invitations/reject")
  @Version("1")
  async reject(@Req() request: { user?: AuthClaims }, @Body() dto: InvitationTokenDto) {
    return SafeMembershipResponseDto.from(
      await this.service.rejectInvitation(dto.token, request.user!.sub)
    );
  }

  @Permissions("workspace.members.manage")
  @Delete("current/members/:membershipId/invitation")
  @Version("1")
  async revokeInvitation(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return SafeMembershipResponseDto.from(
      await this.service.revokeInvitation(workspace.id, user.id, params.membershipId)
    );
  }

  @Permissions("workspace.members.manage")
  @Delete("current/members/:membershipId")
  @Version("1")
  async remove(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return SafeMembershipResponseDto.from(
      await this.service.removeMember(workspace.id, user.id, params.membershipId)
    );
  }

  @Permissions("workspace.members.manage")
  @Post("current/members/:membershipId/suspend")
  @Version("1")
  async suspendMember(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return SafeMembershipResponseDto.from(
      await this.service.suspendMember(workspace.id, user.id, params.membershipId)
    );
  }

  @Permissions("workspace.members.manage")
  @Post("current/members/:membershipId/restore")
  @Version("1")
  async restoreMember(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto
  ) {
    return SafeMembershipResponseDto.from(
      await this.service.restoreMember(workspace.id, user.id, params.membershipId)
    );
  }

  @Permissions("workspace.members.manage")
  @Patch("current/members/:membershipId/role")
  @Version("1")
  async updateMemberRole(
    @CurrentWorkspace() workspace: { id: string },
    @CurrentUser() user: { id: string },
    @Param() params: MembershipIdParamDto,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return SafeMembershipResponseDto.from(
      await this.service.updateMemberRole(
        workspace.id,
        user.id,
        params.membershipId,
        dto.roleId
      )
    );
  }
}
