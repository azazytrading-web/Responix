import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { ExecuteRetrievalDto, RetrievalExecutionListQueryDto } from "./dto/retrieval-execution.dto";
import { RetrievalExecutionService } from "./retrieval-execution.service";

@ApiTags("Retrieval Execution") @ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and Retrieval Execution permission are required" })
@ApiNotFoundResponse({ description: "Retrieval dependency was not found in the active workspace" })
@Controller("retrieval-executions")
export class RetrievalExecutionController {
  constructor(private readonly service: RetrievalExecutionService) {}
  @Post() @Version("1") @Permissions("retrieval.execution.execute")
  @ApiOperation({ summary: "Execute an immutable retrieval snapshot into prompt-ready context" })
  @ApiBadRequestResponse({ description: "Retrieval dependencies, integrity, compatibility, or query are invalid" })
  execute(@Req() request: TenantRequest, @Body() dto: ExecuteRetrievalDto) {
    const context = request.tenantContext!;
    return this.service.execute(context.workspace.id, context.user.id, dto);
  }
  @Get() @Version("1") @Permissions("retrieval.execution.read")
  @ApiOperation({ summary: "Filter and paginate workspace retrieval executions" })
  list(@Req() request: TenantRequest, @Query() query: RetrievalExecutionListQueryDto) {
    return this.service.list(request.tenantContext!.workspace.id, query);
  }
  @Get(":id/diagnostics") @Version("1") @Permissions("retrieval.execution.read")
  diagnostics(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.diagnostics(request.tenantContext!.workspace.id, id);
  }
  @Get(":id/metrics") @Version("1") @Permissions("retrieval.execution.read")
  metrics(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.metrics(request.tenantContext!.workspace.id, id);
  }
  @Get(":id") @Version("1") @Permissions("retrieval.execution.read")
  get(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.service.get(request.tenantContext!.workspace.id, id);
  }
}
