import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvocationRepository } from "../invocation/invocation.repository";
import { RuntimeProtectionRepository } from "./runtime-protection.repository";

@Injectable()
export class RuntimeRecoveryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RuntimeRecoveryService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    private readonly runtimeRepository: RuntimeProtectionRepository,
    private readonly invocationRepository: InvocationRepository,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap(): void {
    void this.recover();
    const intervalMs = this.config.getOrThrow<number>(
      "ai.runtime.recoveryIntervalMs"
    );
    this.timer = setInterval(() => void this.recover(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async recover(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const batchSize = this.config.getOrThrow<number>(
        "ai.runtime.recoveryBatchSize"
      );
      await this.invocationRepository.recoverPendingFinalizations(batchSize);
      await this.runtimeRepository.recoverStaleReservations(
        this.config.getOrThrow<number>("ai.runtime.reservationTtlMs"),
        batchSize
      );
    } catch {
      this.logger.error({ event: "ai.runtime.recovery_failed" });
    } finally {
      this.running = false;
    }
  }
}
