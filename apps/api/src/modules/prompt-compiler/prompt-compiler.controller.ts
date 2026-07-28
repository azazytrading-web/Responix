import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CompareCompiledPromptsDto,
  CompilePromptDto,
  CompiledPromptListQueryDto
} from "./dto/prompt-compiler.dto";
import { PromptCompilerService } from "./prompt-compiler.service";

@ApiTags("Prompt Compiler")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Prompt Compiler permission are required" })
@ApiNotFoundResponse({ description: "Compiled prompt was not found in the active workspace" })
@Controller("prompt-compiler")
export class PromptCompilerController {
  constructor(private readonly service: PromptCompilerService) {}

  @Post("compile") @Version("1") @Permissions("prompt.compiler.compile")
  @ApiBadRequestResponse({ description: "Prompt sources, variables, templates, versions, or ownership are invalid" })
  @ApiOperation({ summary: "Compile and persist an immutable prompt package without provider execution" })
  compile(@Req() request: TenantRequest, @Body() dto: CompilePromptDto) {
    const context = request.tenantContext!;
    return this.service.compile(context.workspace.id, context.user.id, dto);
  }

  @Post("preview") @Version("1") @Permissions("prompt.compiler.preview")
  @ApiOperation({ summary: "Compile an audited, non-persisted prompt package preview" })
  preview(@Req() request: TenantRequest, @Body() dto: CompilePromptDto) {
    const context = request.tenantContext!;
    return this.service.preview(context.workspace.id, context.user.id, dto);
  }

  @Post("validate") @Version("1") @Permissions("prompt.compiler.validate")
  @ApiOperation({ summary: "Validate prompt sources, variables, dependencies, and size metadata" })
  validate(@Req() request: TenantRequest, @Body() dto: CompilePromptDto) {
    const context = request.tenantContext!;
    return this.service.validate(context.workspace.id, context.user.id, dto);
  }

  @Get("compiled") @Version("1") @Permissions("prompt.compiler.read")
  @ApiOperation({ summary: "Filter and paginate immutable compiled prompt records" })
  list(@Req() request: TenantRequest, @Query() query: CompiledPromptListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }

  @Get("compiled/:id") @Version("1") @Permissions("prompt.compiler.read")
  @ApiOperation({ summary: "Load an immutable compiled prompt package" })
  get(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.get(request.tenantContext!.workspace.id, id);
  }

  @Get("compare") @Version("1") @Permissions("prompt.compiler.manage")
  @ApiOperation({ summary: "Compare two workspace-isolated compiled prompt versions" })
  compare(@Req() request: TenantRequest, @Query() query: CompareCompiledPromptsDto) {
    return this.service.compare(
      request.tenantContext!.workspace.id,
      query.leftId,
      query.rightId
    );
  }
}

