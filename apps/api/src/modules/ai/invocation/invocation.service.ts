import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../tenant/tenant-context.service";
import type { AiResponseContract, AuthenticatedInvocationRequest, ProviderStreamEvent } from "../contracts";
import { InvocationOrchestratorService } from "./invocation-orchestrator.service";
import { RequestNormalizerService } from "./request-normalizer.service";
import type { AiInvocationHistoryQueryDto } from "../dto/ai-request.dto";
import { InvocationRepository } from "./invocation.repository";
import type { StreamInvocationResult } from "./invocation-orchestrator.service";

@Injectable()
export class InvocationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly requests: RequestNormalizerService,
    private readonly orchestrator: InvocationOrchestratorService,
    private readonly repository: InvocationRepository
  ) {}

  invoke(request: AuthenticatedInvocationRequest): Promise<AiResponseContract> {
    const normalized = this.requests.normalize(request, this.tenantContext.resolved);
    return this.orchestrator.invoke(normalized);
  }

  stream(
    request: AuthenticatedInvocationRequest,
    emit: (event: ProviderStreamEvent) => Promise<void>
  ): Promise<StreamInvocationResult> {
    const normalized = this.requests.normalizeStream(request, this.tenantContext.resolved);
    return this.orchestrator.stream(normalized, emit);
  }

  list(workspaceId: string, query: AiInvocationHistoryQueryDto) {
    return this.repository.list(workspaceId, query);
  }
}
