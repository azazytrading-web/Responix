import { Body, Controller, Get, Param, Post, Put, Req, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { CreateStudioProjectDto, PublishStudioProjectDto, RollbackStudioProjectDto, UpdateStudioProjectDraftDto } from "./dto/studio-project.dto";
import { StudioProjectService } from "./studio-project.service";
@ApiTags("Studio Projects") @ApiBearerAuth() @Controller("studio/projects")
export class StudioProjectController {
  constructor(private readonly service: StudioProjectService) {}
  @Get() @Version("1") @Permissions("studio.project.read") @ApiOperation({ summary: "List workspace studio projects" }) list(@Req() r: TenantRequest) { return this.service.list(r.tenantContext!.workspace.id); }
  @Get(":projectId") @Version("1") @Permissions("studio.project.read") @ApiOperation({ summary: "Get a studio project" }) get(@Req() r: TenantRequest, @Param("projectId") id: string) { return this.service.get(r.tenantContext!.workspace.id, id); }
  @Get(":projectId/history") @Version("1") @Permissions("studio.project.read") @ApiOperation({ summary: "Get immutable project revision history" }) history(@Req() r: TenantRequest, @Param("projectId") id: string) { return this.service.history(r.tenantContext!.workspace.id, id); }
  @Post() @Version("1") @Permissions("studio.project.write") @ApiOperation({ summary: "Create a studio project draft" }) create(@Req() r: TenantRequest, @Body() dto: CreateStudioProjectDto) { const c=r.tenantContext!; return this.service.create(c.workspace.id,c.user.id,dto); }
  @Put(":projectId") @Version("1") @Permissions("studio.project.write") @ApiOperation({ summary: "Update a studio project draft" }) update(@Req() r: TenantRequest,@Param("projectId") id:string,@Body() dto:UpdateStudioProjectDraftDto){const c=r.tenantContext!;return this.service.updateDraft(c.workspace.id,c.user.id,id,dto);}
  @Post(":projectId/publish") @Version("1") @Permissions("studio.project.publish") @ApiOperation({ summary: "Publish an immutable studio project revision" }) publish(@Req() r:TenantRequest,@Param("projectId")id:string,@Body()dto:PublishStudioProjectDto){const c=r.tenantContext!;return this.service.publish(c.workspace.id,c.user.id,id,dto.changeSummary);}
  @Post(":projectId/rollback") @Version("1") @Permissions("studio.project.rollback") @ApiOperation({ summary: "Create a new published revision from a prior revision" }) rollback(@Req()r:TenantRequest,@Param("projectId")id:string,@Body()dto:RollbackStudioProjectDto){const c=r.tenantContext!;return this.service.rollback(c.workspace.id,c.user.id,id,dto.revision,dto.changeSummary);}
  @Post(":projectId/archive") @Version("1") @Permissions("studio.project.archive") @ApiOperation({ summary: "Archive a studio project" }) archive(@Req()r:TenantRequest,@Param("projectId")id:string){const c=r.tenantContext!;return this.service.archive(c.workspace.id,c.user.id,id);}
}
