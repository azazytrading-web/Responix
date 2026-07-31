import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, RawBodyRequest, Req, Version } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse, ApiHeader, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import type { IncomingMessage } from "node:http";
import { Permissions, Public } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { ChannelRuntimeService } from "./channel-runtime.service";
import { ChannelListQueryDto, ChannelMessageListQueryDto, CreateChannelConnectionDto, CreateChannelDto, SendChannelMessageDto,
  TransitionChannelMessageDto, UploadChannelAttachmentDto, WebhookVerificationDto } from "./dto/channel-runtime.dto";
import { CreateChannelBatchDto, CreateProviderConnectionDto, RotateChannelCredentialDto, TransitionChannelConnectionDto, UpdateChannelConfigurationDto } from "./dto/channel-runtime.dto";

@ApiTags("Channel Runtime")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active workspace membership and channel permission are required" })
@Controller("channel-runtime")
export class ChannelRuntimeController {
  constructor(private readonly service: ChannelRuntimeService) {}
  @Post("channels") @Version("1") @Permissions("channel.runtime.write")
  @ApiOperation({ summary: "Create an immutable workspace channel runtime" })
  create(@Req() req: TenantRequest, @Body() dto: CreateChannelDto) { const c = req.tenantContext!; return this.service.createChannel(c.workspace.id, c.user.id, dto); }
  @Get("channels") @Version("1") @Permissions("channel.runtime.read")
  list(@Req() req: TenantRequest, @Query() query: ChannelListQueryDto) { return this.service.listChannels(req.tenantContext!.workspace.id, query); }
  @Get("channels/:id") @Version("1") @Permissions("channel.runtime.read")
  get(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.getChannel(req.tenantContext!.workspace.id, id); }
  @Get("providers") @Version("1") @Permissions("channel.runtime.read")
  providers() { return this.service.providers(); }
  @Get("providers/:providerKey/capabilities") @Version("1") @Permissions("channel.runtime.read")
  capabilities(@Param("providerKey") providerKey: string) { return this.service.capabilities(providerKey); }
  @Post("providers/:providerKey/capabilities/refresh") @Version("1") @Permissions("channel.runtime.admin")
  refreshCapabilities(@Param("providerKey") providerKey: string) { return this.service.refreshCapabilities(providerKey); }
  @Post("channels/:id/provider-connections") @Version("1") @Permissions("channel.runtime.write")
  @ApiOperation({ summary: "Create a vendor-neutral provider connection" })
  providerConnection(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: CreateProviderConnectionDto) { const c = req.tenantContext!;
    return this.service.createProviderConnection(c.workspace.id, c.user.id, id, dto); }
  @Post("channels/:id/connections") @Version("1") @Permissions("whatsapp.connection.write")
  @ApiOperation({ summary: "Create an encrypted Meta WhatsApp Cloud connection" })
  @ApiBadRequestResponse({ description: "Meta connection configuration is invalid" })
  connection(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: CreateChannelConnectionDto) { const c = req.tenantContext!;
    return this.service.createConnection(c.workspace.id, c.user.id, id, dto); }
  @Get("channels/:id/connections") @Version("1") @Permissions("whatsapp.connection.read")
  connections(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.listConnections(req.tenantContext!.workspace.id, id); }
  @Get("phone-numbers") @Version("1") @Permissions("whatsapp.connection.read")
  phoneNumbers(@Req() req: TenantRequest) { return this.service.phoneNumbers(req.tenantContext!.workspace.id); }
  @Post("connections/:id/health") @Version("1") @Permissions("whatsapp.connection.admin")
  health(@Req() req: TenantRequest, @Param("id") id: string) { const c = req.tenantContext!; return this.service.health(c.workspace.id, c.user.id, id); }
  @Get("connections/:id/configurations") @Version("1") @Permissions("whatsapp.connection.read")
  configurations(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.configurations(req.tenantContext!.workspace.id, id); }
  @Patch("connections/:id/configuration") @Version("1") @Permissions("whatsapp.connection.write")
  updateConfiguration(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: UpdateChannelConfigurationDto) { const c = req.tenantContext!;
    return this.service.updateConfiguration(c.workspace.id, c.user.id, id, dto.configuration, dto.expectedStateVersion); }
  @Patch("connections/:id/state") @Version("1") @Permissions("whatsapp.connection.admin")
  connectionState(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: TransitionChannelConnectionDto) { const c = req.tenantContext!;
    return this.service.transitionConnection(c.workspace.id, c.user.id, id, dto); }
  @Post("connections/:id/credentials/rotate") @Version("1") @Permissions("channel.runtime.admin")
  @ApiOperation({ summary: "Rotate an encrypted channel credential using optimistic versioning" })
  rotateCredential(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: RotateChannelCredentialDto) { const c = req.tenantContext!;
    return this.service.rotateCredential(c.workspace.id, c.user.id, id, dto); }
  @Post("connections/:id/batches") @Version("1") @Permissions("channel.runtime.write")
  createBatch(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: CreateChannelBatchDto) {
    return this.service.createBatch(req.tenantContext!.workspace.id, id, dto); }
  @Get("connections/:id/batches") @Version("1") @Permissions("channel.runtime.read")
  batches(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.batches(req.tenantContext!.workspace.id, id); }
  @Public() @Get("webhooks/whatsapp/:pathKey")
  @ApiOperation({ summary: "Verify a Meta WhatsApp webhook subscription" })
  verify(@Param("pathKey") pathKey: string, @Query() query: WebhookVerificationDto) {
    return this.service.verifyWebhook(pathKey, query["hub.mode"], query["hub.verify_token"], query["hub.challenge"]); }
  @Public() @Post("webhooks/whatsapp/:pathKey")
  @ApiHeader({ name: "x-hub-signature-256", required: true })
  @ApiHeader({ name: "x-hub-delivery-timestamp", required: false })
  @ApiUnauthorizedResponse({ description: "Signature or replay-window validation failed" })
  webhook(@Param("pathKey") pathKey: string, @Req() req: RawBodyRequest<IncomingMessage>, @Body() payload: unknown,
    @Headers("x-hub-signature-256") signature = "", @Headers("x-hub-delivery-timestamp") timestamp?: string) {
    if (!req.rawBody) throw new BadRequestException("Raw webhook body is unavailable");
    return this.service.webhook(pathKey, req.rawBody, payload, signature, timestamp); }
  @Public() @Get("webhooks/:providerKey/:pathKey")
  verifyProvider(@Param("pathKey") pathKey: string, @Query() query: WebhookVerificationDto) {
    return this.service.verifyWebhook(pathKey, query["hub.mode"], query["hub.verify_token"], query["hub.challenge"]); }
  @Public() @Post("webhooks/:providerKey/:pathKey")
  providerWebhook(@Param("pathKey") pathKey: string, @Req() req: RawBodyRequest<IncomingMessage>, @Body() payload: unknown,
    @Headers("x-channel-signature") channelSignature = "", @Headers("x-hub-signature-256") metaSignature = "",
    @Headers("x-channel-timestamp") channelTimestamp?: string, @Headers("x-hub-delivery-timestamp") metaTimestamp?: string) {
    if (!req.rawBody) throw new BadRequestException("Raw webhook body is unavailable");
    return this.service.webhook(pathKey, req.rawBody, payload, channelSignature || metaSignature, channelTimestamp ?? metaTimestamp); }
  @Post("channels/:id/messages") @Version("1") @Permissions("channel.runtime.write")
  @ApiOperation({ summary: "Queue-ready provider-neutral outbound channel message" })
  send(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: SendChannelMessageDto) { const c = req.tenantContext!;
    return this.service.send(c.workspace.id, c.user.id, id, dto); }
  @Patch("messages/:id/state") @Version("1") @Permissions("channel.runtime.admin") @ApiConflictResponse({ description: "Optimistic state version changed" })
  transition(@Req() req: TenantRequest, @Param("id") id: string, @Body() dto: TransitionChannelMessageDto) { const c = req.tenantContext!;
    return this.service.transition(c.workspace.id, c.user.id, id, dto); }
  @Get("messages") @Version("1") @Permissions("channel.runtime.read")
  messages(@Req() req: TenantRequest, @Query() query: ChannelMessageListQueryDto) { return this.service.listMessages(req.tenantContext!.workspace.id, query); }
  @Get("messages/:id") @Version("1") @Permissions("channel.runtime.read")
  message(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.getMessage(req.tenantContext!.workspace.id, id); }
  @Post("attachments") @Version("1") @Permissions("channel.runtime.write")
  upload(@Req() req: TenantRequest, @Body() dto: UploadChannelAttachmentDto) { const c = req.tenantContext!; return this.service.upload(c.workspace.id, c.user.id, dto); }
  @Get("attachments") @Version("1") @Permissions("channel.runtime.read")
  attachments(@Req() req: TenantRequest, @Query("channelId") channelId?: string) { return this.service.attachments(req.tenantContext!.workspace.id, channelId); }
  @Get("attachments/:id") @Version("1") @Permissions("channel.runtime.read")
  attachment(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.attachment(req.tenantContext!.workspace.id, id); }
  @Get("conversations") @Version("1") @Permissions("channel.runtime.read")
  conversations(@Req() req: TenantRequest, @Query("channelId") channelId?: string) { return this.service.conversations(req.tenantContext!.workspace.id, channelId); }
  @Get("diagnostics") @Version("1") @Permissions("channel.runtime.admin")
  diagnostics(@Req() req: TenantRequest, @Query("channelId") channelId?: string) { return this.service.diagnostics(req.tenantContext!.workspace.id, channelId); }
  @Get("channels/:id/metrics") @Version("1") @Permissions("channel.runtime.read")
  metrics(@Req() req: TenantRequest, @Param("id") id: string) { return this.service.metrics(req.tenantContext!.workspace.id, id); }
}
