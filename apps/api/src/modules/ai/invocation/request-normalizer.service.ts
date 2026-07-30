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
    if (request.tools?.length) {
      throw new AiContractError("INVALID_REQUEST", "Tool invocation is not supported");
    }
    if (!request.messages.length || request.messages.some(({ content }) => !content.trim())) {
      throw new AiContractError("INVALID_REQUEST", "Invocation messages are invalid");
    }
    if (request.messages.some(({ role }) => role === "tool")) {
      throw new AiContractError("INVALID_REQUEST", "Tool messages are not supported");
    }
    return {
      requestId: request.requestId,
      workspaceId: tenant.workspace.id,
      membershipId: tenant.membership.id,
      taskType: request.taskType,
      messages: request.messages.map(({ role, content }) => ({ role, content })),
      ...(request.language ? { language: request.language } : {}),
      ...(request.signal ? { signal: request.signal } : {})
    } as TrustedInvocationRequest;
  }
}
