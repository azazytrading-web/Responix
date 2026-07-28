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
import { ToolRegistryService } from "./tool-registry.service";
import {
  CloneToolDefinitionDto,
  CreateToolDefinitionDto,
  CreateToolGroupDto,
  PublishToolDefinitionDto,
  RollbackToolDefinitionDto,
  ToolDefinitionListQueryDto,
  ToolTaxonomyDto,
  UpdateToolDefinitionDto,
  UpdateToolGroupDto,
  UpdateToolTaxonomyDto
} from "./dto/tool-registry.dto";

@ApiTags("Tool Registry")
@ApiBearerAuth()
@ApiForbiddenResponse({description:"Active membership and endpoint-specific Tool Registry permission are required"})
@ApiNotFoundResponse({description:"Tool Registry resource was not found in the active workspace"})
@Controller("tool-registry")
export class ToolRegistryController {
  constructor(private readonly service:ToolRegistryService){}

  @Get("categories") @Version("1") @Permissions("tool.registry.read") @ApiOperation({summary:"List tool categories"})
  categories(@Req()r:TenantRequest){return this.service.listCategories(r.tenantContext!.workspace.id);}
  @Post("categories") @Version("1") @Permissions("tool.registry.manage") @ApiOperation({summary:"Create a tool category"})
  createCategory(@Req()r:TenantRequest,@Body()d:ToolTaxonomyDto){const c=r.tenantContext!;return this.service.createCategory(c.workspace.id,c.user.id,d);}
  @Put("categories/:id") @Version("1") @Permissions("tool.registry.manage") @ApiOperation({summary:"Update a tool category"})
  updateCategory(@Req()r:TenantRequest,@Param("id")id:string,@Body()d:UpdateToolTaxonomyDto){const c=r.tenantContext!;return this.service.updateCategory(c.workspace.id,c.user.id,id,d);}
  @Delete("categories/:id") @Version("1") @Permissions("tool.registry.manage") @ApiConflictResponse({description:"Category is in use"}) @ApiOperation({summary:"Delete an unused tool category"})
  deleteCategory(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteCategory(c.workspace.id,c.user.id,id);}

  @Get("groups") @Version("1") @Permissions("tool.registry.read") @ApiOperation({summary:"List tool groups"})
  groups(@Req()r:TenantRequest,@Query("categoryId")categoryId?:string){return this.service.listGroups(r.tenantContext!.workspace.id,categoryId);}
  @Post("groups") @Version("1") @Permissions("tool.registry.manage") @ApiOperation({summary:"Create a tool group"})
  createGroup(@Req()r:TenantRequest,@Body()d:CreateToolGroupDto){const c=r.tenantContext!;return this.service.createGroup(c.workspace.id,c.user.id,d);}
  @Put("groups/:id") @Version("1") @Permissions("tool.registry.manage") @ApiOperation({summary:"Update a tool group"})
  updateGroup(@Req()r:TenantRequest,@Param("id")id:string,@Body()d:UpdateToolGroupDto){const c=r.tenantContext!;return this.service.updateGroup(c.workspace.id,c.user.id,id,d);}
  @Delete("groups/:id") @Version("1") @Permissions("tool.registry.manage") @ApiConflictResponse({description:"Group is in use"}) @ApiOperation({summary:"Delete an unused tool group"})
  deleteGroup(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteGroup(c.workspace.id,c.user.id,id);}

  @Get("tools") @Version("1") @Permissions("tool.registry.read") @ApiOperation({summary:"Search and paginate tool definitions"})
  list(@Req()r:TenantRequest,@Query()q:ToolDefinitionListQueryDto){return this.service.list(r.tenantContext!.workspace.id,q);}
  @Get("tools/:id") @Version("1") @Permissions("tool.registry.read") @ApiOperation({summary:"Get a tool definition"})
  get(@Req()r:TenantRequest,@Param("id")id:string){return this.service.get(r.tenantContext!.workspace.id,id);}
  @Get("tools/:id/history") @Version("1") @Permissions("tool.registry.read") @ApiOperation({summary:"Get immutable tool version history"})
  history(@Req()r:TenantRequest,@Param("id")id:string){return this.service.history(r.tenantContext!.workspace.id,id);}
  @Post("tools") @Version("1") @Permissions("tool.registry.write") @ApiBadRequestResponse({description:"Tool metadata, schema, permission, or taxonomy is invalid"}) @ApiOperation({summary:"Create a tool definition draft"})
  create(@Req()r:TenantRequest,@Body()d:CreateToolDefinitionDto){const c=r.tenantContext!;return this.service.create(c.workspace.id,c.user.id,d);}
  @Put("tools/:id") @Version("1") @Permissions("tool.registry.write") @ApiOperation({summary:"Update tool definition draft metadata"})
  update(@Req()r:TenantRequest,@Param("id")id:string,@Body()d:UpdateToolDefinitionDto){const c=r.tenantContext!;return this.service.updateDraft(c.workspace.id,c.user.id,id,d);}
  @Post("tools/:id/publish") @Version("1") @Permissions("tool.registry.publish") @ApiOperation({summary:"Publish an immutable tool definition revision"})
  publish(@Req()r:TenantRequest,@Param("id")id:string,@Body()d:PublishToolDefinitionDto){const c=r.tenantContext!;return this.service.publish(c.workspace.id,c.user.id,id,d.changeSummary);}
  @Post("tools/:id/rollback") @Version("1") @Permissions("tool.registry.rollback") @ApiOperation({summary:"Create a new published revision from prior tool metadata"})
  rollback(@Req()r:TenantRequest,@Param("id")id:string,@Body()d:RollbackToolDefinitionDto){const c=r.tenantContext!;return this.service.rollback(c.workspace.id,c.user.id,id,d);}
  @Post("tools/:id/clone") @Version("1") @Permissions("tool.registry.write") @ApiOperation({summary:"Clone a tool into an independent draft"})
  clone(@Req()r:TenantRequest,@Param("id")id:string,@Body()d:CloneToolDefinitionDto){const c=r.tenantContext!;return this.service.clone(c.workspace.id,c.user.id,id,d);}
  @Post("tools/:id/archive") @Version("1") @Permissions("tool.registry.archive") @ApiOperation({summary:"Archive a tool without deleting version history"})
  archive(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.archive(c.workspace.id,c.user.id,id);}
  @Post("tools/:id/restore") @Version("1") @Permissions("tool.registry.archive") @ApiOperation({summary:"Restore an archived or soft-deleted tool"})
  restore(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.restore(c.workspace.id,c.user.id,id);}
  @Delete("tools/:id") @Version("1") @Permissions("tool.registry.delete") @ApiOperation({summary:"Soft-delete a tool without deleting version history"})
  delete(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.delete(c.workspace.id,c.user.id,id);}
}
