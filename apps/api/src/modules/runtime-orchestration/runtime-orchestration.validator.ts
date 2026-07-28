import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  ExecutionBindingDto,
  ExecutionConcurrencyPolicyDto,
  ExecutionDependencyDto,
  ExecutionFallbackPolicyDto,
  ExecutionLimitDto,
  ExecutionRetryPolicyDto,
  ExecutionTimeoutDto
} from "./dto/runtime-orchestration.dto";

export type OrchestrationValidationInput = {
  bindings: ExecutionBindingDto[];
  dependencies: ExecutionDependencyDto[];
  retryPolicy?: ExecutionRetryPolicyDto;
  timeouts?: ExecutionTimeoutDto;
  concurrencyPolicy?: ExecutionConcurrencyPolicyDto;
  fallbackPolicy?: ExecutionFallbackPolicyDto;
  limits?: ExecutionLimitDto;
};

@Injectable()
export class RuntimeOrchestrationValidator {
  validate(input: OrchestrationValidationInput): void {
    this.unique(input.bindings.map((item) => item.key), "Execution bindings");
    this.unique(
      input.dependencies.map((item) => `${item.bindingKey}:${item.dependsOnBindingKey}`),
      "Execution dependencies"
    );
    this.validateDependencies(input.bindings, input.dependencies);
    this.validateRetry(input.retryPolicy);
    this.validateTimeouts(input.timeouts);
    this.validateConcurrency(input.concurrencyPolicy);
    this.validateFallback(input.fallbackPolicy);
    this.validateLimits(input.limits);
  }

  private validateDependencies(bindings: ExecutionBindingDto[], dependencies: ExecutionDependencyDto[]): void {
    const keys = new Set(bindings.map((item) => item.key));
    const adjacency = new Map<string, string[]>();
    for (const dependency of dependencies) {
      if (!keys.has(dependency.bindingKey) || !keys.has(dependency.dependsOnBindingKey)) {
        throw new BadRequestException("Execution dependencies must reference existing binding keys");
      }
      if (dependency.bindingKey === dependency.dependsOnBindingKey) {
        throw new BadRequestException("Execution bindings cannot depend on themselves");
      }
      const values = adjacency.get(dependency.bindingKey) ?? [];
      values.push(dependency.dependsOnBindingKey);
      adjacency.set(dependency.bindingKey, values);
    }

    const active = new Set<string>();
    const complete = new Set<string>();
    const visit = (key: string): void => {
      if (active.has(key)) throw new BadRequestException("Execution dependencies contain a circular dependency");
      if (complete.has(key)) return;
      active.add(key);
      for (const dependency of adjacency.get(key) ?? []) visit(dependency);
      active.delete(key);
      complete.add(key);
    };
    for (const key of keys) visit(key);
  }

  private validateRetry(policy?: ExecutionRetryPolicyDto): void {
    if (!policy) return;
    if (
      !Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 20 ||
      !Number.isInteger(policy.initialDelayMs) || policy.initialDelayMs < 0 || policy.initialDelayMs > 3_600_000 ||
      !Number.isInteger(policy.maxDelayMs) || policy.maxDelayMs < 0 || policy.maxDelayMs > 3_600_000 ||
      !Number.isFinite(policy.multiplier) || policy.multiplier < 1 || policy.multiplier > 100
    ) {
      throw new BadRequestException("Retry policy values are outside the supported ranges");
    }
    if (policy.maxAttempts === 1 && (policy.initialDelayMs !== 0 || policy.maxDelayMs !== 0)) {
      throw new BadRequestException("A single-attempt retry policy cannot define retry delays");
    }
    if (policy.maxAttempts > 1 && policy.maxDelayMs < policy.initialDelayMs) {
      throw new BadRequestException("Retry maxDelayMs must be greater than or equal to initialDelayMs");
    }
  }

  private validateTimeouts(timeouts?: ExecutionTimeoutDto): void {
    if (!timeouts) return;
    if (
      !Number.isInteger(timeouts.totalMs) || timeouts.totalMs < 100 || timeouts.totalMs > 86_400_000 ||
      (timeouts.stepMs !== undefined && (!Number.isInteger(timeouts.stepMs) || timeouts.stepMs < 100 || timeouts.stepMs > 86_400_000)) ||
      (timeouts.idleMs !== undefined && (!Number.isInteger(timeouts.idleMs) || timeouts.idleMs < 100 || timeouts.idleMs > 86_400_000))
    ) {
      throw new BadRequestException("Execution timeout values are outside the supported ranges");
    }
    if (timeouts.stepMs !== undefined && timeouts.stepMs > timeouts.totalMs) {
      throw new BadRequestException("Step timeout cannot exceed total timeout");
    }
    if (timeouts.idleMs !== undefined && timeouts.idleMs > timeouts.totalMs) {
      throw new BadRequestException("Idle timeout cannot exceed total timeout");
    }
  }

  private validateConcurrency(policy?: ExecutionConcurrencyPolicyDto): void {
    if (!policy) return;
    if (
      !Number.isInteger(policy.maxParallel) || policy.maxParallel < 1 || policy.maxParallel > 10_000 ||
      !Number.isInteger(policy.maxQueued) || policy.maxQueued < 0 || policy.maxQueued > 1_000_000
    ) {
      throw new BadRequestException("Concurrency values are outside the supported ranges");
    }
    if (policy.maxQueued === 0 && policy.strategy.toUpperCase() === "QUEUE") {
      throw new BadRequestException("QUEUE concurrency strategy requires maxQueued greater than zero");
    }
    if (policy.keyTemplate && policy.strategy.toUpperCase() !== "KEYED") {
      throw new BadRequestException("Concurrency keyTemplate is only valid for KEYED strategy");
    }
    if (!policy.keyTemplate && policy.strategy.toUpperCase() === "KEYED") {
      throw new BadRequestException("KEYED concurrency strategy requires a keyTemplate");
    }
  }

  private validateFallback(policy?: ExecutionFallbackPolicyDto): void {
    if (!policy) return;
    if (Boolean(policy.targetType) !== Boolean(policy.targetReferenceId)) {
      throw new BadRequestException("Fallback targetType and targetReferenceId must be provided together");
    }
  }

  private validateLimits(limits?: ExecutionLimitDto): void {
    if (!limits) return;
    const positive = [limits.maxSteps, limits.maxTokens, limits.maxPayloadBytes];
    if (
      positive.some((value) => value !== undefined && (!Number.isInteger(value) || value < 1)) ||
      (limits.maxCostMinor !== undefined && (!Number.isInteger(limits.maxCostMinor) || limits.maxCostMinor < 0))
    ) {
      throw new BadRequestException("Execution limit values are invalid");
    }
  }

  private unique(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`${label} must be unique`);
    }
  }
}
