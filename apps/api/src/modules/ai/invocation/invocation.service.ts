import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../tenant/tenant-context.service";
import type { AiResponseContract, AuthenticatedInvocationRequest } from "../contracts";
import { InvocationOrchestratorService } from "./invocation-orchestrator.service";
import { RequestNormalizerService } from "./request-normalizer.service";

@Injectable()
export class InvocationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly requests: RequestNormalizerService,
    private readonly orchestrator: InvocationOrchestratorService
  ) {}

  invoke(request: AuthenticatedInvocationRequest): Promise<AiResponseContract> {
    const normalized = this.requests.normalize(request, this.tenantContext.resolved);
    return this.orchestrator.invoke(normalized);
  }
}
