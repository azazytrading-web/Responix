import { Injectable } from "@nestjs/common";
import type { ResolvedTenantContext } from "../../tenant/tenant-context.service";
import { AiContractError } from "../contracts";
import type { AuthenticatedInvocationRequest, NormalizedInvocationRequest } from "../contracts";

declare const trustedInvocationRequest: unique symbol;

export type TrustedInvocationRequest = NormalizedInvocationRequest & {
  readonly [trustedInvocationRequest]: true;
};

@Injectable()
export class RequestNormalizerService {
  normalize(
    request: AuthenticatedInvocationRequest,
    tenant: ResolvedTenantContext
  ): TrustedInvocationRequest {
    return this.normalizeForModes(request, tenant, ["sync"]);
  }

  normalizeStream(request: AuthenticatedInvocationRequest, tenant: ResolvedTenantContext): TrustedInvocationRequest {
    return this.normalizeForModes(request, tenant, ["stream"]);
  }

  private normalizeForModes(
    request: AuthenticatedInvocationRequest, tenant: ResolvedTenantContext,
    modes: readonly ("sync" | "stream")[]
  ): TrustedInvocationRequest {
    if (!modes.includes(request.mode)) {
      throw new AiContractError("INVALID_REQUEST", "Invocation mode is not supported by this operation");
    }
    if (!request.messages.length || request.messages.some(({ content }) => !content.trim())) {
      throw new AiContractError("INVALID_REQUEST", "Invocation messages are invalid");
    }
    if (request.tools?.some((tool) => !tool.name.trim() || !tool.description.trim() ||
      !tool.inputSchema || typeof tool.inputSchema !== "object")) {
      throw new AiContractError("INVALID_REQUEST", "Tool definitions are invalid");
    }
    return {
      requestId: request.requestId,
      workspaceId: tenant.workspace.id,
      membershipId: tenant.membership.id,
      taskType: request.taskType,
      messages: request.messages.map(({ role, content }) => ({ role, content })),
      ...(request.language ? { language: request.language } : {}),
      ...(request.tools?.length ? { tools: structuredClone(request.tools) } : {}),
      ...(request.promptCache ? { promptCache: structuredClone(request.promptCache) } : {}),
      ...(request.signal ? { signal: request.signal } : {})
    } as TrustedInvocationRequest;
  }
}
