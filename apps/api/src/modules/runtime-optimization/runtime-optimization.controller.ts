import { Body, Controller, Get, Param, Post, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CacheCompiledPromptDto, CacheRenderedPromptDto, CacheRetrievalRuntimeDto,
  CreateRuntimeContextSnapshotDto, RuntimeOptimizationListQueryDto
} from "./dto/runtime-optimization.dto";
import { RuntimeOptimizationService } from "./runtime-optimization.service";

@ApiTags("Runtime Optimization")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Runtime Optimization permission required" })
@ApiNotFoundResponse({ description: "Immutable runtime asset was not found in the workspace" })
@Controller("runtime-optimizations")
export class RuntimeOptimizationController {
  constructor(private readonly service: RuntimeOptimizationService) {}
  @Post("compiled-prompts") @Version("1") @Permissions("runtime.optimization.create")
  @ApiOperation({ summary: "Cache or reuse an immutable compiled prompt package" })
  cacheCompiled(@Req() req: TenantRequest, @Body() dto: CacheCompiledPromptDto) {
    const c = req.tenantContext!; return this.service.cacheCompiled(c.workspace.id, c.user.id, dto);
  }
  @Post("rendered-prompts") @Version("1") @Permissions("runtime.optimization.create")
  @ApiOperation({ summary: "Cache deterministic static prompt rendering only" })
  @ApiBadRequestResponse({ description: "Variables are dynamic or not deterministic" })
  cacheRendered(@Req() req: TenantRequest, @Body() dto: CacheRenderedPromptDto) {
    const c = req.tenantContext!; return this.service.cacheRendered(c.workspace.id, c.user.id, dto);
  }
  @Post("runtime-contexts") @Version("1") @Permissions("runtime.optimization.create")
  @ApiOperation({ summary: "Create or reuse a complete immutable runtime context snapshot" })
  createContext(@Req() req: TenantRequest, @Body() dto: CreateRuntimeContextSnapshotDto) {
    const c = req.tenantContext!; return this.service.createContext(c.workspace.id, c.user.id, dto);
  }
  @Post("retrieval-packages") @Version("1") @Permissions("runtime.optimization.create")
  @ApiOperation({ summary: "Cache deterministic query-independent retrieval preparation" })
  cacheRetrieval(@Req() req: TenantRequest, @Body() dto: CacheRetrievalRuntimeDto) {
    const c = req.tenantContext!;
    return this.service.cacheRetrieval(c.workspace.id, c.user.id, dto);
  }
  @Get() @Version("1") @Permissions("runtime.optimization.read")
  @ApiOperation({ summary: "Filter and paginate immutable optimization packages" })
  list(@Req() req: TenantRequest, @Query() query: RuntimeOptimizationListQueryDto) {
    return this.service.list(req.tenantContext!.workspace.id, query);
  }
  @Get(":id/metrics") @Version("1") @Permissions("runtime.optimization.read")
  @ApiOperation({ summary: "Load aggregated optimization reuse metrics" })
  metrics(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.getMetrics(req.tenantContext!.workspace.id, id);
  }
  @Get(":id") @Version("1") @Permissions("runtime.optimization.read")
  @ApiOperation({ summary: "Load an immutable optimization package" })
  get(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.get(req.tenantContext!.workspace.id, id);
  }
}
