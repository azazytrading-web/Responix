import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  PromptExecutionListQueryDto, RenderPromptExecutionDto
} from "./dto/prompt-execution.dto";
import { PromptExecutionService } from "./prompt-execution.service";

@ApiTags("Prompt Execution")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and Prompt Execution permission required" })
@ApiNotFoundResponse({ description: "Prompt package or execution payload was not found in the workspace" })
@Controller("prompt-executions")
export class PromptExecutionController {
  constructor(private readonly service: PromptExecutionService) {}
  @Post() @Version("1") @Permissions("prompt.execution.render")
  @ApiOperation({ summary: "Render and persist an immutable provider-ready prompt payload" })
  @ApiBadRequestResponse({ description: "Prompt hash, variables, conditions, or references are invalid" })
  render(@Req() req: TenantRequest, @Body() dto: RenderPromptExecutionDto) {
    const context = req.tenantContext!;
    return this.service.render(context.workspace.id, context.user.id, dto);
  }
  @Post("validate") @Version("1") @Permissions("prompt.execution.validate")
  @ApiOperation({ summary: "Validate prompt execution without persisting a payload" })
  validate(@Req() req: TenantRequest, @Body() dto: RenderPromptExecutionDto) {
    const context = req.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, dto);
  }
  @Get() @Version("1") @Permissions("prompt.execution.read")
  @ApiOperation({ summary: "Filter and paginate immutable prompt execution payloads" })
  list(@Req() req: TenantRequest, @Query() query: PromptExecutionListQueryDto) {
    return this.service.list(req.tenantContext!.workspace.id, query);
  }
  @Get(":id") @Version("1") @Permissions("prompt.execution.read")
  @ApiOperation({ summary: "Load an immutable prompt execution payload" })
  get(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.get(req.tenantContext!.workspace.id, id);
  }
}
