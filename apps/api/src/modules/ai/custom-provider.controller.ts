import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Req, UseFilters, Version
} from "@nestjs/common";
import {
  ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { AiHttpExceptionFilter } from "./ai-http-exception.filter";
import {
  CustomProviderCredentialDto, CustomProviderCredentialMetadataDto, CustomProviderCredentialWriteResponseDto, CustomProviderResponseDto,
  CustomProviderValidationResponseDto, CreateCustomProviderDto, UpdateCustomProviderDto
} from "./dto/custom-provider.dto";
import { CustomProviderLifecycleService } from "./providers/custom-provider-lifecycle.service";
import { CustomProviderValidationService } from "./providers/custom-provider-validation.service";

@ApiTags("AI Custom Providers")
@ApiBearerAuth()
@UseFilters(AiHttpExceptionFilter)
@Controller("ai/custom-providers")
export class CustomProviderController {
  constructor(
    private readonly lifecycle: CustomProviderLifecycleService,
    private readonly validation: CustomProviderValidationService
  ) {}

  @Permissions("ai.providers.read") @Get() @Version("1")
  @ApiOperation({ summary: "List workspace Custom Providers" })
  @ApiOkResponse({ type: [CustomProviderResponseDto], description: "Custom Providers with safe credential metadata" })
  list(@Req() request: TenantRequest) {
    return this.lifecycle.list(request.tenantContext!.workspace.id);
  }

  @Permissions("ai.providers.read") @Get(":providerId") @Version("1")
  @ApiOperation({ summary: "Get a workspace Custom Provider" })
  @ApiOkResponse({ type: CustomProviderResponseDto, description: "Custom Provider with safe credential metadata" })
  get(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    return this.lifecycle.get(request.tenantContext!.workspace.id, providerId);
  }

  @Permissions("ai.providers.write") @Post() @Version("1")
  @ApiOperation({ summary: "Register a workspace Custom Provider" })
  @ApiCreatedResponse({ type: CustomProviderResponseDto, description: "Registered Custom Provider" })
  create(@Req() request: TenantRequest, @Body() dto: CreateCustomProviderDto) {
    const context = request.tenantContext!;
    return this.lifecycle.create(context.workspace.id, context.user.id, dto);
  }

  @Permissions("ai.providers.write") @Patch(":providerId") @Version("1")
  @ApiOperation({ summary: "Update allowed Custom Provider definition fields" })
  @ApiOkResponse({ type: CustomProviderResponseDto, description: "Updated Custom Provider" })
  update(@Req() request: TenantRequest, @Param("providerId") providerId: string, @Body() dto: UpdateCustomProviderDto) {
    const context = request.tenantContext!;
    return this.lifecycle.update(context.workspace.id, context.user.id, providerId, dto);
  }

  @Permissions("ai.providers.write") @Post(":providerId/enable") @Version("1") @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Enable a configured Custom Provider" })
  @ApiOkResponse({ type: CustomProviderResponseDto })
  enable(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    const context = request.tenantContext!;
    return this.lifecycle.enable(context.workspace.id, context.user.id, providerId);
  }

  @Permissions("ai.providers.write") @Post(":providerId/disable") @Version("1") @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disable a Custom Provider" })
  @ApiOkResponse({ type: CustomProviderResponseDto })
  disable(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    const context = request.tenantContext!;
    return this.lifecycle.disable(context.workspace.id, context.user.id, providerId);
  }

  @Permissions("ai.providers.write") @Post(":providerId/archive") @Version("1") @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a Custom Provider" })
  @ApiOkResponse({ type: CustomProviderResponseDto })
  archive(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    const context = request.tenantContext!;
    return this.lifecycle.archive(context.workspace.id, context.user.id, providerId);
  }

  @Permissions("ai.providers.write") @Post(":providerId/restore") @Version("1") @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Restore an archived Custom Provider" })
  @ApiOkResponse({ type: CustomProviderResponseDto })
  restore(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    const context = request.tenantContext!;
    return this.lifecycle.restore(context.workspace.id, context.user.id, providerId);
  }

  @Permissions("ai.providers.read") @Get(":providerId/credentials") @Version("1")
  @ApiOperation({ summary: "List safe Custom Provider credential metadata" })
  @ApiOkResponse({ type: [CustomProviderCredentialMetadataDto] })
  listCredentials(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    return this.lifecycle.listCredentials(request.tenantContext!.workspace.id, providerId);
  }

  @Permissions("ai.providers.write") @Put(":providerId/credentials") @Version("1")
  @ApiOperation({ summary: "Create or replace a write-only Custom Provider credential" })
  @ApiOkResponse({ type: CustomProviderCredentialWriteResponseDto, description: "Safe credential metadata; secret is never returned" })
  replaceCredential(@Req() request: TenantRequest, @Param("providerId") providerId: string, @Body() dto: CustomProviderCredentialDto) {
    const context = request.tenantContext!;
    return this.lifecycle.replaceCredential(context.workspace.id, context.user.id, providerId, dto);
  }

  @Permissions("ai.providers.validate") @Post(":providerId/validate") @Version("1") @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Test connection to a saved Custom Provider" })
  @ApiOkResponse({ type: CustomProviderValidationResponseDto })
  validate(@Req() request: TenantRequest, @Param("providerId") providerId: string) {
    const context = request.tenantContext!;
    return this.validation.validate(context.workspace.id, context.user.id, providerId);
  }
}
