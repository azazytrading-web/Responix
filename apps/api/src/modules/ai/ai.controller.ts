import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseFilters,
  Version
} from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiRequestTimeoutResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import { CurrentWorkspace } from "../auth/current-user.decorator";
import { AiHttpExceptionFilter } from "./ai-http-exception.filter";
import {
  AiInvocationHistoryQueryDto, AiInvocationRequestDto, AiRoutingRequestDto
} from "./dto/ai-request.dto";
import {
  AiErrorResponseDto,
  AiInvocationResponseDto,
  AiProviderResponseDto,
  AiRoutingResponseDto
} from "./dto/ai-response.dto";
import { InvocationService } from "./invocation/invocation.service";
import { ProviderDiscoveryService } from "./providers/provider-discovery.service";
import { RoutingService } from "./router/routing.service";

@ApiTags("AI")
@ApiBearerAuth()
@ApiHeader({
  name: "x-request-id",
  required: false,
  description: "Optional correlation ID; a generated value is returned when omitted"
})
@ApiUnauthorizedResponse({ description: "A valid bearer token is required" })
@ApiForbiddenResponse({ description: "Active tenant membership and permission are required" })
@UseFilters(AiHttpExceptionFilter)
@Controller("ai")
export class AiController {
  constructor(
    private readonly providers: ProviderDiscoveryService,
    private readonly routing: RoutingService,
    private readonly invocations: InvocationService
  ) {}

  @Permissions("ai.configure")
  @Get("providers")
  @Version("1")
  @ApiOperation({
    summary: "Discover AI providers",
    description:
      "Returns provider-neutral provider and model metadata for the authenticated workspace."
  })
  @ApiOkResponse({ type: [AiProviderResponseDto], description: "Workspace provider discovery" })
  async discover(@CurrentWorkspace() workspace: { id: string }): Promise<AiProviderResponseDto[]> {
    const providers = await this.providers.discover(workspace.id);
    return providers.map((provider) => AiProviderResponseDto.from(provider));
  }

  @Permissions("ai.invoke")
  @Post("routing/resolve")
  @HttpCode(HttpStatus.OK)
  @Version("1")
  @ApiOperation({
    summary: "Resolve an AI route",
    description:
      "Selects an eligible provider and model for the authenticated workspace without executing it."
  })
  @ApiBody({ type: AiRoutingRequestDto })
  @ApiOkResponse({ type: AiRoutingResponseDto, description: "Provider-neutral routing decision" })
  @ApiBadRequestResponse({ type: AiErrorResponseDto, description: "Invalid routing requirements" })
  @ApiUnprocessableEntityResponse({
    type: AiErrorResponseDto,
    description: "No eligible provider model satisfies the requirements"
  })
  async resolveRoute(
    @CurrentWorkspace() workspace: { id: string },
    @Body() dto: AiRoutingRequestDto
  ): Promise<AiRoutingResponseDto> {
    const decision = await this.routing.route({
      workspaceId: workspace.id,
      ...dto
    });
    return AiRoutingResponseDto.from(decision);
  }

  @Permissions("ai.invoke")
  @Get("invocations")
  @Version("1")
  @ApiOperation({
    summary: "List provider executions",
    description: "Returns filtered, paginated, workspace-isolated provider execution records."
  })
  @ApiOkResponse({ description: "Paginated provider execution history" })
  listInvocations(
    @CurrentWorkspace() workspace: { id: string },
    @Query() query: AiInvocationHistoryQueryDto
  ) {
    return this.invocations.list(workspace.id, query);
  }

  @Permissions("ai.invoke")
  @Post("invocations")
  @HttpCode(HttpStatus.OK)
  @Version("1")
  @ApiOperation({
    summary: "Invoke AI",
    description:
      "Executes a synchronous provider-neutral AI invocation in the authenticated workspace."
  })
  @ApiBody({ type: AiInvocationRequestDto })
  @ApiOkResponse({ type: AiInvocationResponseDto, description: "Normalized AI response" })
  @ApiBadRequestResponse({ type: AiErrorResponseDto, description: "Invalid invocation request" })
  @ApiUnprocessableEntityResponse({
    type: AiErrorResponseDto,
    description: "No eligible provider model is available"
  })
  @ApiTooManyRequestsResponse({
    type: AiErrorResponseDto,
    description: "The selected provider rate limit was exceeded"
  })
  @ApiBadGatewayResponse({
    type: AiErrorResponseDto,
    description: "The provider returned an invalid response"
  })
  @ApiServiceUnavailableResponse({
    type: AiErrorResponseDto,
    description: "Provider execution or credentials are unavailable"
  })
  @ApiRequestTimeoutResponse({
    type: AiErrorResponseDto,
    description: "Provider execution was cancelled or timed out"
  })
  @ApiInternalServerErrorResponse({
    type: AiErrorResponseDto,
    description: "The invocation could not be completed"
  })
  async invoke(
    @Req() request: {
      id: string;
      once?: (event: string, listener: () => void) => unknown;
      removeListener?: (event: string, listener: () => void) => unknown;
    },
    @Body() dto: AiInvocationRequestDto
  ): Promise<AiInvocationResponseDto> {
    const controller = new AbortController();
    const cancel = () => controller.abort(new DOMException("Client disconnected", "AbortError"));
    request.once?.("aborted", cancel);
    try {
      const response = await this.invocations.invoke({
        requestId: request.id,
        taskType: dto.taskType,
        messages: dto.messages,
        mode: dto.mode,
        signal: controller.signal,
        ...(dto.language ? { language: dto.language } : {})
      });
      return AiInvocationResponseDto.from(response);
    } finally {
      request.removeListener?.("aborted", cancel);
    }
  }
}
