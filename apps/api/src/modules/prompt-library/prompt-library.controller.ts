import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Version } from "@nestjs/common";
import {
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
  ClonePromptDto,
  CreatePromptDto,
  FavoritePromptDto,
  PromptListQueryDto,
  PromptNamedDto,
  PublishPromptDto,
  RollbackPromptDto,
  UpdatePromptDraftDto,
  UpdatePromptMetadataDto,
  UpdatePromptNamedDto
} from "./dto/prompt-library.dto";
import { PromptLibraryService } from "./prompt-library.service";

@ApiTags("Prompt Library")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active workspace membership and the endpoint permission are required" })
@Controller("prompt-library")
export class PromptLibraryController {
  constructor(private readonly service: PromptLibraryService) {}

  @Get()
  @Version("1")
  @Permissions("prompt.library.read")
  @ApiOperation({ summary: "Search and paginate workspace prompts" })
  list(@Req() request: TenantRequest, @Query() query: PromptListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }

  @Get("categories")
  @Version("1")
  @Permissions("prompt.library.read")
  @ApiOperation({ summary: "List workspace prompt categories" })
  categories(@Req() request: TenantRequest) {
    return this.service.listCategories(request.tenantContext!.workspace.id);
  }

  @Post("categories")
  @Version("1")
  @Permissions("prompt.library.manage")
  @ApiOperation({ summary: "Create a workspace prompt category" })
  createCategory(@Req() request: TenantRequest, @Body() dto: PromptNamedDto) {
    const context = request.tenantContext!;
    return this.service.createCategory(context.workspace.id, context.user.id, dto);
  }

  @Put("categories/:id")
  @Version("1")
  @Permissions("prompt.library.manage")
  @ApiOperation({ summary: "Update a workspace prompt category" })
  updateCategory(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() dto: UpdatePromptNamedDto
  ) {
    const context = request.tenantContext!;
    return this.service.updateCategory(context.workspace.id, context.user.id, id, dto);
  }

  @Delete("categories/:id")
  @Version("1")
  @Permissions("prompt.library.manage")
  @ApiConflictResponse({ description: "The category is assigned to a prompt" })
  @ApiOperation({ summary: "Delete an unused workspace prompt category" })
  deleteCategory(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.deleteCategory(context.workspace.id, context.user.id, id);
  }

  @Get("tags")
  @Version("1")
  @Permissions("prompt.library.read")
  @ApiOperation({ summary: "List workspace prompt tags" })
  tags(@Req() request: TenantRequest) {
    return this.service.listTags(request.tenantContext!.workspace.id);
  }

  @Post("tags")
  @Version("1")
  @Permissions("prompt.library.manage")
  @ApiOperation({ summary: "Create a workspace prompt tag" })
  createTag(@Req() request: TenantRequest, @Body() dto: PromptNamedDto) {
    const context = request.tenantContext!;
    return this.service.createTag(context.workspace.id, context.user.id, dto);
  }

  @Put("tags/:id")
  @Version("1")
  @Permissions("prompt.library.manage")
  @ApiOperation({ summary: "Update a workspace prompt tag" })
  updateTag(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() dto: UpdatePromptNamedDto
  ) {
    const context = request.tenantContext!;
    return this.service.updateTag(context.workspace.id, context.user.id, id, dto);
  }

  @Delete("tags/:id")
  @Version("1")
  @Permissions("prompt.library.manage")
  @ApiConflictResponse({ description: "The tag is assigned to a prompt" })
  @ApiOperation({ summary: "Delete an unused workspace prompt tag" })
  deleteTag(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.deleteTag(context.workspace.id, context.user.id, id);
  }

  @Get(":id")
  @Version("1")
  @Permissions("prompt.library.read")
  @ApiNotFoundResponse({ description: "Prompt not found in this workspace" })
  @ApiOperation({ summary: "Get a workspace prompt" })
  get(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Query("includeArchived") includeArchived?: string
  ) {
    return this.service.get(request.tenantContext!.workspace.id, id, includeArchived === "true");
  }

  @Get(":id/history")
  @Version("1")
  @Permissions("prompt.library.read")
  @ApiOperation({ summary: "Get immutable published prompt history" })
  history(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.history(request.tenantContext!.workspace.id, id);
  }

  @Post()
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Create a prompt draft" })
  create(@Req() request: TenantRequest, @Body() dto: CreatePromptDto) {
    const context = request.tenantContext!;
    return this.service.create(context.workspace.id, context.user.id, dto);
  }

  @Put(":id")
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Edit a prompt draft" })
  update(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() dto: UpdatePromptDraftDto
  ) {
    const context = request.tenantContext!;
    return this.service.updateDraft(context.workspace.id, context.user.id, id, dto);
  }

  @Patch(":id/metadata")
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Edit prompt variable metadata and metadata while in draft" })
  updateMetadata(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() dto: UpdatePromptMetadataDto
  ) {
    const context = request.tenantContext!;
    return this.service.updateMetadata(context.workspace.id, context.user.id, id, dto);
  }

  @Post(":id/publish")
  @Version("1")
  @Permissions("prompt.library.publish")
  @ApiOperation({ summary: "Publish an immutable prompt version" })
  publish(@Req() request: TenantRequest, @Param("id") id: string, @Body() dto: PublishPromptDto) {
    const context = request.tenantContext!;
    return this.service.publish(context.workspace.id, context.user.id, id, dto);
  }

  @Post(":id/rollback")
  @Version("1")
  @Permissions("prompt.library.rollback")
  @ApiOperation({ summary: "Create a new published version from a prior version" })
  rollback(@Req() request: TenantRequest, @Param("id") id: string, @Body() dto: RollbackPromptDto) {
    const context = request.tenantContext!;
    return this.service.rollback(context.workspace.id, context.user.id, id, dto);
  }

  @Post(":id/clone")
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Clone a prompt into a new independent draft" })
  clone(@Req() request: TenantRequest, @Param("id") id: string, @Body() dto: ClonePromptDto) {
    const context = request.tenantContext!;
    return this.service.clone(context.workspace.id, context.user.id, id, dto);
  }

  @Post(":id/archive")
  @Version("1")
  @Permissions("prompt.library.archive")
  @ApiOperation({ summary: "Soft-delete a prompt without deleting version history" })
  archive(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.archive(context.workspace.id, context.user.id, id);
  }

  @Post(":id/restore")
  @Version("1")
  @Permissions("prompt.library.archive")
  @ApiOperation({ summary: "Restore an archived prompt" })
  restore(@Req() request: TenantRequest, @Param("id") id: string) {
    const context = request.tenantContext!;
    return this.service.restore(context.workspace.id, context.user.id, id);
  }

  @Put(":id/favorite")
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Set prompt favorite state" })
  favorite(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() dto: FavoritePromptDto
  ) {
    const context = request.tenantContext!;
    return this.service.favorite(context.workspace.id, context.user.id, id, dto.favorite);
  }

  @Post(":id/tags/:tagId")
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Assign a workspace tag to a draft prompt" })
  assignTag(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Param("tagId") tagId: string
  ) {
    const context = request.tenantContext!;
    return this.service.assignTag(context.workspace.id, context.user.id, id, tagId);
  }

  @Delete(":id/tags/:tagId")
  @Version("1")
  @Permissions("prompt.library.write")
  @ApiOperation({ summary: "Remove a workspace tag from a draft prompt" })
  removeTag(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Param("tagId") tagId: string
  ) {
    const context = request.tenantContext!;
    return this.service.removeTag(context.workspace.id, context.user.id, id, tagId);
  }
}
