import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EvaluationSandboxAdapter } from "./sandbox-adapter";
import { EvaluationWorkQueue } from "./evaluation-work-queue";

/** Reclaims only adapter-owned containers whose physical attempt no longer has a live DB lease. */
@Injectable()
export class EvaluationReconciler implements OnApplicationBootstrap, OnApplicationShutdown {
  private stopped = false;
  private loopStarted = false;

  constructor(
    private readonly config: ConfigService,
    private readonly queue: EvaluationWorkQueue,
    private readonly sandbox: EvaluationSandboxAdapter
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || this.loopStarted) return;
    this.loopStarted = true;
    void this.poll();
  }

  onApplicationShutdown(): void { this.stopped = true; }

  async processOnce(): Promise<"DISABLED" | { inspected: number; removed: number; retained: number; admissionUncertain: number; cancelled: number; exhausted: number; budgetInspected: number; budgetReconciled: number; budgetReleasedOiu: string }> {
    if (this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true") return "DISABLED";
    const expired = await this.queue.reconcileExpired();
    const budget = await this.queue.reconcileBudget();
    const containers = this.config.get<string>("OIC_EVALUATOR_ENABLED") === "true"
      ? await this.sandbox.reconcileOrphans((attemptId) => this.queue.isAttemptLeaseValid(attemptId))
      : { inspected: 0, removed: 0, retained: 0 };
    return { ...containers, ...expired, budgetInspected: budget.inspected, budgetReconciled: budget.reconciled, budgetReleasedOiu: budget.releasedOiu };
  }

  private async poll(): Promise<void> {
    while (!this.stopped) {
      try { await this.processOnce(); }
      catch { /* Backend loss remains visible to the explicit sandbox preflight and no host fallback occurs. */ }
      if (!this.stopped) await new Promise((resolve) => setTimeout(resolve, 30_000));
    }
  }
}
