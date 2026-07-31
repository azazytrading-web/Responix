import { Body, Controller, Get, Param, Post, Put, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse,
  ApiNotFoundResponse, ApiOperation, ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import {
  CommitMemoryWritesDto, CompareMemorySnapshotsDto, CreateMemoryRuntimeDto,
  MemoryRuntimeListQueryDto, MemorySnapshotListQueryDto, ResolveMemoryRuntimeDto,
  RollbackMemoryRuntimeDto, UpdateMemoryRuntimeDto
} from "./dto/memory-runtime.dto";
import { MemoryRuntimeService } from "./memory-runtime.service";

@ApiTags("Memory Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and Memory Runtime permission are required" })
@ApiNotFoundResponse({ description: "Memory Runtime resource was not found in the active workspace" })
@Controller("memory-runtime")
export class MemoryRuntimeController {
  constructor(private readonly service: MemoryRuntimeService) {}
  @Post() @Version("1") @Permissions("memory.runtime.write")
  @ApiOperation({ summary: "Create workspace-isolated memory runtime metadata" })
  @ApiBadRequestResponse({ description: "Memory scope, ownership, or references are invalid" })
  create(@Req() req: TenantRequest, @Body() dto: CreateMemoryRuntimeDto) {
    const c = req.tenantContext!; return this.service.create(c.workspace.id, c.user.id, dto);
  }
  @Put(":id") @Version("1") @Permissions("memory.runtime.write")
  @ApiConflictResponse({ description: "Memory state version changed" })
  update(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: UpdateMemoryRuntimeDto) {
    const c = req.tenantContext!; return this.service.update(c.workspace.id, c.user.id, id, dto);
  }
  @Post(":id/publish") @Version("1") @Permissions("memory.runtime.publish")
  publish(@Req() req: TenantRequest, @Param("id") id: string) {
    const c = req.tenantContext!; return this.service.publish(c.workspace.id, c.user.id, id);
  }
  @Post(":id/rollback") @Version("1") @Permissions("memory.runtime.publish")
  rollback(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: RollbackMemoryRuntimeDto) {
    const c = req.tenantContext!;
    return this.service.rollback(c.workspace.id, c.user.id, id, dto.versionId, dto.expectedStateVersion);
  }
  @Post(":id/archive") @Version("1") @Permissions("memory.runtime.archive")
  archive(@Req() req: TenantRequest, @Param("id") id: string) {
    const c = req.tenantContext!; return this.service.archive(c.workspace.id, c.user.id, id);
  }
  @Post("resolve") @Version("1") @Permissions("memory.runtime.read")
  resolve(@Req() req: TenantRequest, @Body() dto: ResolveMemoryRuntimeDto) {
    const c = req.tenantContext!; return this.service.resolve(c.workspace.id, c.user.id, dto);
  }
  @Post("writes/commit") @Version("1") @Permissions("memory.runtime.write")
  commit(@Req() req: TenantRequest, @Body() dto: CommitMemoryWritesDto) {
    const c = req.tenantContext!; return this.service.commitWrite(c.workspace.id, c.user.id, dto);
  }
  @Get() @Version("1") @Permissions("memory.runtime.read")
  list(@Req() req: TenantRequest, @Query() q: MemoryRuntimeListQueryDto) {
    return this.service.list(req.tenantContext!.workspace.id, q);
  }
  @Get("snapshots/compare") @Version("1") @Permissions("memory.runtime.compare")
  compare(@Req() req: TenantRequest, @Query() q: CompareMemorySnapshotsDto) {
    return this.service.compare(req.tenantContext!.workspace.id, q.leftId, q.rightId);
  }
  @Get("snapshots") @Version("1") @Permissions("memory.runtime.read")
  snapshots(@Req() req: TenantRequest, @Query() q: MemorySnapshotListQueryDto) {
    return this.service.listSnapshots(req.tenantContext!.workspace.id, q);
  }
  @Get("snapshots/:id") @Version("1") @Permissions("memory.runtime.read")
  snapshot(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.getSnapshot(req.tenantContext!.workspace.id, id);
  }
  @Get(":id/diagnostics") @Version("1") @Permissions("memory.runtime.read")
  diagnostics(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.diagnostics(req.tenantContext!.workspace.id, id);
  }
  @Get(":id/metrics") @Version("1") @Permissions("memory.runtime.read")
  metrics(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.metrics(req.tenantContext!.workspace.id, id);
  }
  @Get(":id/history") @Version("1") @Permissions("memory.runtime.read")
  history(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.history(req.tenantContext!.workspace.id, id);
  }
  @Get(":id") @Version("1") @Permissions("memory.runtime.read")
  get(@Req() req: TenantRequest, @Param("id") id: string) {
    return this.service.get(req.tenantContext!.workspace.id, id);
  }
}
