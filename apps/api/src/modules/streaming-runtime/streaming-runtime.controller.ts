import { Body, Controller, Get, MessageEvent, Param, Post, Query, Req, Sse, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Observable } from "rxjs";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import type { CancelStreamSessionDto, CompareStreamSnapshotsDto, CreateStreamSessionDto, StreamSessionListQueryDto } from "./dto/streaming-runtime.dto";
import { StreamingRuntimeService } from "./streaming-runtime.service";
@ApiTags("Streaming Runtime") @ApiBearerAuth() @ApiForbiddenResponse({description:"Streaming Runtime permission required"}) @Controller("stream-sessions") export class StreamingRuntimeController {
 constructor(private readonly service:StreamingRuntimeService){}
 @Post() @Version("1") @Permissions("stream.runtime.create") @ApiOperation({summary:"Create immutable streaming session"}) create(@Req() r:TenantRequest,@Body() d:CreateStreamSessionDto){const c=r.tenantContext!;return this.service.create(c.workspace.id,c.user.id,d);}
 @Post(":id/cancel") @Version("1") @Permissions("stream.runtime.cancel") @ApiOperation({summary:"Cancel a stream and propagate lifecycle cancellation"}) cancel(@Req() r:TenantRequest,@Param("id") id:string,@Body() d:CancelStreamSessionDto){const c=r.tenantContext!;return this.service.cancel(c.workspace.id,c.user.id,id,d);}
 @Get() @Version("1") @Permissions("stream.runtime.read") @ApiOperation({summary:"Filter and paginate stream sessions"}) list(@Req() r:TenantRequest,@Query() q:StreamSessionListQueryDto){return this.service.list(r.tenantContext!.workspace.id,q);}
 @Get(":id") @Version("1") @Permissions("stream.runtime.read") @ApiOperation({summary:"Load stream session"}) get(@Req() r:TenantRequest,@Param("id") id:string){return this.service.get(r.tenantContext!.workspace.id,id);}
 @Get(":id/metrics") @Version("1") @Permissions("stream.runtime.read") @ApiOperation({summary:"Load stream metrics"}) metrics(@Req() r:TenantRequest,@Param("id") id:string){return this.service.metrics(r.tenantContext!.workspace.id,id);}
 @Get(":id/diagnostics") @Version("1") @Permissions("stream.runtime.audit") @ApiOperation({summary:"Load stream diagnostics"}) diagnostics(@Req() r:TenantRequest,@Param("id") id:string){return this.service.diagnostics(r.tenantContext!.workspace.id,id);}
 @Get(":id/chunks") @Version("1") @Permissions("stream.runtime.read") @ApiOperation({summary:"Load immutable ordered stream chunks"}) chunks(@Req() r:TenantRequest,@Param("id") id:string){return this.service.chunks(r.tenantContext!.workspace.id,id);}
 @Post("compare") @Version("1") @Permissions("stream.runtime.compare") @ApiOperation({summary:"Compare immutable stream snapshots"}) compare(@Req() r:TenantRequest,@Body() d:CompareStreamSnapshotsDto){return this.service.compare(r.tenantContext!.workspace.id,d.leftId,d.rightId);}
 @Sse(":id/events") @Permissions("stream.runtime.read") async events(@Req() r:TenantRequest,@Param("id") id:string):Promise<Observable<MessageEvent>>{await this.service.get(r.tenantContext!.workspace.id,id);return this.service.observe(id) as unknown as Observable<MessageEvent>;}
}
