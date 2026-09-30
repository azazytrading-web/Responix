import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/auth.guard";
import type { TenantRequest } from "../../tenant/tenant-context.service";
import { CatalogModelResponseDto, CatalogPageResponseDto, CreateCustomModelDto, ModelCatalogQueryDto, UpdateCustomModelDto } from "./model-catalog.dto";
import { ModelCatalogService } from "./model-catalog.service";

@ApiTags("AI Model Catalog") @ApiBearerAuth() @Controller("ai/models")
export class ModelCatalogController {
  constructor(private readonly catalog: ModelCatalogService) {}
  @Get() @Version("1") @Permissions("ai.providers.read") @ApiOkResponse({ type: CatalogPageResponseDto })
  list(@Req() request: TenantRequest, @Query() query: ModelCatalogQueryDto) { return this.catalog.list(request.tenantContext!.workspace.id, query); }
  @Get(":modelId") @Version("1") @Permissions("ai.providers.read") @ApiOkResponse({ type: CatalogModelResponseDto })
  get(@Req() request: TenantRequest, @Param("modelId", ParseUUIDPipe) id: string) { return this.catalog.get(request.tenantContext!.workspace.id, id); }
  @Post() @Version("1") @Permissions("ai.models.write") @ApiCreatedResponse({ type: CatalogModelResponseDto })
  create(@Req() request: TenantRequest, @Body() input: CreateCustomModelDto) { const context = request.tenantContext!; return this.catalog.create(context.workspace.id, context.user.id, input); }
  @Patch(":modelId") @Version("1") @Permissions("ai.models.write") @ApiOkResponse({ type: CatalogModelResponseDto })
  update(@Req() request: TenantRequest, @Param("modelId", ParseUUIDPipe) id: string, @Body() input: UpdateCustomModelDto) { const context = request.tenantContext!; return this.catalog.update(context.workspace.id, context.user.id, id, input); }
  @Post(":modelId/archive") @Version("1") @HttpCode(200) @Permissions("ai.models.write") @ApiOkResponse({ type: CatalogModelResponseDto })
  archive(@Req() request: TenantRequest, @Param("modelId", ParseUUIDPipe) id: string) { const context = request.tenantContext!; return this.catalog.transition(context.workspace.id, context.user.id, id, "archive"); }
  @Post(":modelId/restore") @Version("1") @HttpCode(200) @Permissions("ai.models.write") @ApiOkResponse({ type: CatalogModelResponseDto })
  restore(@Req() request: TenantRequest, @Param("modelId", ParseUUIDPipe) id: string) { const context = request.tenantContext!; return this.catalog.transition(context.workspace.id, context.user.id, id, "restore"); }
}
