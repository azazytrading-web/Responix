import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiContractError } from "../contracts";
import type { NormalizedInvocationRequest } from "../contracts";
import type { ProviderModel } from "../providers/provider.types";
import { AccountingService } from "./accounting.service";
import { CapabilityValidator } from "./capability-validator.service";
import { CostEstimator } from "./cost-estimator.service";
import { QuotaService } from "./quota.service";
import { ReservationService } from "./reservation.service";
import type {
  RuntimeFailureAccounting,
  RuntimeReservation
} from "./runtime.types";

@Injectable()
export class RuntimeProtectionService {
  constructor(
    private readonly config: ConfigService,
    private readonly estimator: CostEstimator,
    private readonly quotas: QuotaService,
    private readonly capabilities: CapabilityValidator,
    private readonly reservations: ReservationService,
    private readonly accounting: AccountingService
  ) {}

  async begin(request: NormalizedInvocationRequest): Promise<RuntimeReservation> {
    if (!this.config.getOrThrow<boolean>("ai.enabled")) {
      throw new AiContractError("PROVIDER_UNAVAILABLE", "AI runtime is disabled");
    }
    const limits = await this.quotas.limitsFor(request.workspaceId);
    const estimate = this.estimator.estimate(request, limits.maxOutputTokens);
    this.capabilities.validateWorkspaceEstimate(estimate, limits);
    return this.reservations.reserve({
      workspaceId: request.workspaceId,
      requestId: request.requestId,
      estimate,
      limits
    });
  }

  validateModel(reservation: RuntimeReservation, model: ProviderModel): void {
    this.capabilities.validateModel(reservation.estimate, model);
  }

  recordFailure(input: RuntimeFailureAccounting): Promise<void> {
    return this.accounting.recordFailure(input);
  }

  release(reservation: RuntimeReservation): Promise<void> {
    return this.reservations.release(reservation);
  }

  withLease<T>(
    reservation: RuntimeReservation,
    operation: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    return this.reservations.withLease(reservation, operation);
  }
}
