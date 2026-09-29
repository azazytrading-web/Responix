import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiContractError } from "../contracts";
import type {
  AiCostContract, AiResponseContract, AiToolCallContract, AiUsageContract, ProviderExecutionResult,
  ProviderStreamEvent
} from "../contracts";
import { ProviderCredentialService } from "../providers/provider-credential.service";
import { ProviderFactory } from "../providers/provider.factory";
import type { AiProviderAdapter } from "../providers/provider-adapter.interface";
import { RoutingService } from "../router/routing.service";
import type { RoutingDecision } from "../router/routing.types";
import { CostNormalizerService } from "./cost-normalizer.service";
import { ErrorNormalizerService, InvocationTimeoutError } from "./error-normalizer.service";
import { InvocationRepository } from "./invocation.repository";
import type { TrustedInvocationRequest } from "./request-normalizer.service";
import { ResponseNormalizerService } from "./response-normalizer.service";
import { UsageNormalizerService } from "./usage-normalizer.service";
import { RuntimeProtectionService } from "../runtime/runtime-protection.service";
import type { RuntimeReservation } from "../runtime/runtime.types";
import type { ModelPricing } from "./cost-normalizer.service";

export interface StreamInvocationResult {
  invocationId: string;
  responseContent: string;
  finishReason?: string;
  usage: AiUsageContract | null;
  cost: AiCostContract | null;
  pricing: ModelPricing;
  providerCompletedAt: Date;
  retryCount: number;
  providerId: string;
  modelId: string;
  nativePromptCacheSupported: boolean;
}

@Injectable()
export class InvocationOrchestratorService {
  private readonly logger = new Logger(InvocationOrchestratorService.name);

  constructor(
    private readonly routing: RoutingService,
    private readonly providers: ProviderFactory,
    private readonly credentials: ProviderCredentialService,
    private readonly repository: InvocationRepository,
    private readonly usage: UsageNormalizerService,
    private readonly costs: CostNormalizerService,
    private readonly responses: ResponseNormalizerService,
    private readonly errors: ErrorNormalizerService,
    private readonly config: ConfigService,
    private readonly runtime: RuntimeProtectionService
  ) {}

  async invoke(request: TrustedInvocationRequest): Promise<AiResponseContract> {
    let invocationId: string | undefined;
    let providerId: string | undefined;
    let modelId: string | undefined;
    let reservation: RuntimeReservation | undefined;
    let runtimeFinalized = false;
    let durableFinalizationStaged = false;
    let providerDurationMs = 0;
    let providerRetryCount = 0;
    const executionStartedAt = Date.now();
    try {
      reservation = await this.runtime.begin(request);
      const requirements = {
        workspaceId: request.workspaceId,
        ...(request.tools?.length ? { tools: true } : {})
      };
      const routing = await this.routing.route(requirements);
      providerId = routing.providerId;
      modelId = routing.modelId;
      const invocation = await this.repository.start({
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        providerId: routing.providerId,
        modelId: routing.modelId,
        taskType: request.taskType,
        messageCount: request.messages.length
      });
      invocationId = invocation.id;

      const providerStartedAt = Date.now();
      let providerResult: ProviderExecutionResult | undefined;
      let pricing: ModelPricing | undefined;
      let resolvedProvider: Awaited<ReturnType<ProviderFactory["create"]>> | undefined;
      let finalRouting = routing;
      let lastCandidateError: unknown = new AiContractError(
        "PROVIDER_UNAVAILABLE", "No eligible provider candidate completed the invocation"
      );
      const activeReservation = reservation;
      try {
        const execution = await this.runtime.withLease(activeReservation, (leaseSignal) =>
          (async () => {
            const candidates = [
              { providerId: routing.providerId, modelId: routing.modelId },
              ...routing.fallbacks
            ];
            let previous = candidates[0]!;
            for (let index = 0; index < candidates.length; index += 1) {
              const candidate = candidates[index]!;
              if (request.signal?.aborted || leaseSignal.aborted) {
                throw new DOMException("AI invocation cancelled", "AbortError");
              }
              if (index > 0) {
                const eligible = await this.routing.isCandidateEligible(requirements, candidate);
                if (!eligible) {
                  lastCandidateError = new AiContractError(
                    "PROVIDER_UNAVAILABLE", "Fallback provider candidate is no longer eligible"
                  );
                  continue;
                }
                await this.repository.recordProviderTransition({
                  invocationId: invocationId!, workspaceId: request.workspaceId,
                  fromProviderId: previous.providerId, fromModelId: previous.modelId,
                  toProviderId: candidate.providerId, toModelId: candidate.modelId,
                  fallbackIndex: index
                });
              }
              providerId = candidate.providerId;
              modelId = candidate.modelId;
              const candidateRouting = { ...routing, providerId, modelId };
              try {
                const resolved = await this.providers.create(request.workspaceId, providerId);
                const model = resolved.provider.models.find(({ modelId: id }) => id === modelId);
                if (!model) throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model is unavailable");
                this.runtime.validateModel(activeReservation, model);
                const candidatePricing = await this.repository.findModelPricing(
                  request.workspaceId, providerId, modelId
                );
                if (!candidatePricing) throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model pricing is unavailable");
                const execution = await this.executeProvider({
                  workspaceId: request.workspaceId, providerId, routing: candidateRouting,
                  modelName: model.modelName, apiBaseUrl: resolved.provider.apiBaseUrl,
                  adapter: resolved.adapter, request,
                  maxOutputTokens: activeReservation.estimate.outputTokens, leaseSignal,
                  maxAttempts: index === 0 ? 3 : 1,
                  onRetry: () => { providerRetryCount += 1; return providerRetryCount; }
                });
                providerResult = execution.result;
                pricing = candidatePricing;
                resolvedProvider = resolved;
                finalRouting = candidateRouting;
                return execution;
              } catch (error: unknown) {
                lastCandidateError = error;
                if (this.isCancellation(error, leaseSignal, request.signal) || this.isTerminalResponseError(error)) throw error;
                previous = candidate;
              }
            }
            throw lastCandidateError;
          })()
        );
        providerRetryCount = Math.max(providerRetryCount, execution.retryCount);
      } finally {
        providerDurationMs = Date.now() - providerStartedAt;
      }
      if (!providerResult || !pricing || !resolvedProvider) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "No provider candidate completed the invocation");
      }
      const usage = this.usage.normalize(providerResult.usage);
      const cost = this.costs.normalize(usage, pricing);
      const response = this.responses.normalize({
        requestId: request.requestId,
        providerResult,
        routing: finalRouting,
        usage,
        cost,
        metadata: { providerDurationMs,
          promptCache: { packageId: request.promptCache?.packageId ?? null,
            nativeSupported: resolvedProvider.adapter.promptCache?.supportsCaching() === true,
            mode: resolvedProvider.adapter.promptCache?.mode ?? "NONE",
            ttlSeconds: resolvedProvider.adapter.promptCache?.ttlSeconds ?? null } }
      });
      const runtimeCompletion = {
        reservation,
        invocationId,
        providerId: finalRouting.providerId,
        modelId: finalRouting.modelId,
        usage,
        cost,
        retryCount: providerRetryCount,
        executionDurationMs: Date.now() - executionStartedAt,
        providerDurationMs
      };
      const completion = {
        invocationId,
        workspaceId: request.workspaceId,
        providerId: finalRouting.providerId,
        modelId: finalRouting.modelId,
        routing: finalRouting,
        usage,
        cost,
        runtime: runtimeCompletion,
        ...(providerResult.finishReason ? { finishReason: providerResult.finishReason } : {})
      };
      const recoveryId = await this.repository.stageSuccess(completion);
      durableFinalizationStaged = true;
      await this.completeWithRetry({ ...completion, recoveryId });
      runtimeFinalized = true;
      this.logger.log({
        event: "ai.invocation.succeeded",
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        providerId: finalRouting.providerId,
        modelId: finalRouting.modelId
      });
      return response;
    } catch (error: unknown) {
      const normalized = this.errors.normalize(error);
      if (durableFinalizationStaged) {
        this.logger.error({
          event: "ai.invocation.finalization_deferred",
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          errorCode: normalized.code
        });
        throw new AiContractError(normalized.code, normalized.message);
      }
      if (reservation && !runtimeFinalized) {
        const timedOut = /timed out|timeout/i.test(normalized.message);
        const cancelled = normalized.code === "CANCELLED";
        const runtimeFailure = {
          reservation,
          ...(invocationId ? { invocationId } : {}),
          ...(providerId ? { providerId } : {}),
          ...(modelId ? { modelId } : {}),
          retryCount: providerRetryCount,
          executionDurationMs: Date.now() - executionStartedAt,
          providerDurationMs,
          failureReason: normalized.code,
          ...(timedOut ? { timeoutReason: normalized.message } : {}),
          cancelled
        };
        if (invocationId) {
          const failure = {
            invocationId,
            workspaceId: request.workspaceId,
            error: normalized,
            runtime: runtimeFailure
          };
          const recoveryId = await this.repository.stageFailure(failure);
          durableFinalizationStaged = true;
          await this.failWithRetry({ ...failure, recoveryId });
        } else {
          await this.runtime.recordFailure(runtimeFailure);
        }
        runtimeFinalized = true;
      } else if (invocationId) {
        await this.repository.fail(invocationId, request.workspaceId, normalized);
      }
      this.logger.error({
        event: "ai.invocation.failed",
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        errorCode: normalized.code,
        ...(normalized.code === "UNKNOWN"
          ? {
              errorName: error instanceof Error ? error.name : typeof error,
              errorMessage: error instanceof Error ? error.message : "Unknown invocation failure"
            }
          : {})
      });
      throw new AiContractError(normalized.code, normalized.message);
    } finally {
      if (reservation && !runtimeFinalized && !durableFinalizationStaged) {
        try {
          await this.runtime.release(reservation);
        } catch {
          this.logger.error({
            event: "ai.runtime.reservation_release_failed",
            requestId: request.requestId,
            workspaceId: request.workspaceId
          });
        }
      }
    }
  }

  async stream(
    request: TrustedInvocationRequest, emit: (event: ProviderStreamEvent) => Promise<void>
  ): Promise<StreamInvocationResult> {
    let reservation: RuntimeReservation | undefined;
    let invocationId: string | undefined;
    let providerId: string | undefined;
    let modelId: string | undefined;
    let routing: RoutingDecision | undefined;
    let providerDurationMs = 0;
    const startedAt = Date.now();
    let finalUsage: ProviderExecutionResult["usage"] | undefined;
    let finishReason: string | undefined;
    let responseContent = "";
    let pricing: ModelPricing | undefined;
    let providerRetryCount = 0;
    let providerCompletedAt: Date | undefined;
    let resolvedProvider: Awaited<ReturnType<ProviderFactory["create"]>> | undefined;
    let finalRouting: RoutingDecision | undefined;
    let outputEmitted = false;
    try {
      reservation = await this.runtime.begin(request);
      routing = await this.routing.route({ workspaceId: request.workspaceId, streaming: true,
        ...(request.tools?.length ? { tools: true } : {}) });
      providerId = routing.providerId; modelId = routing.modelId;
      finalRouting = routing;
      const invocation = await this.repository.start({
        requestId: request.requestId, workspaceId: request.workspaceId,
        providerId: routing.providerId, modelId: routing.modelId,
        taskType: request.taskType, messageCount: request.messages.length
      });
      invocationId = invocation.id;
      const providerStartedAt = Date.now();
      try {
        await this.runtime.withLease(reservation, async (leaseSignal) => {
        const candidates = [
          { providerId: routing!.providerId, modelId: routing!.modelId },
          ...routing!.fallbacks
        ];
        let previous = candidates[0]!;
        let lastError: unknown = new AiContractError("PROVIDER_UNAVAILABLE", "No streaming provider candidate completed the invocation");
        for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
          const candidate = candidates[candidateIndex]!;
          if (request.signal?.aborted || leaseSignal.aborted) {
            throw new DOMException("AI invocation cancelled", "AbortError");
          }
          if (candidateIndex > 0) {
            const eligible = await this.routing.isCandidateEligible(
              { workspaceId: request.workspaceId, streaming: true, ...(request.tools?.length ? { tools: true } : {}) }, candidate
            );
            if (!eligible) {
              lastError = new AiContractError("PROVIDER_UNAVAILABLE", "Fallback provider candidate is no longer eligible");
              continue;
            }
            await this.repository.recordProviderTransition({
              invocationId: invocationId!, workspaceId: request.workspaceId,
              fromProviderId: previous.providerId, fromModelId: previous.modelId,
              toProviderId: candidate.providerId, toModelId: candidate.modelId,
              fallbackIndex: candidateIndex
            });
          }
          providerId = candidate.providerId;
          modelId = candidate.modelId;
          const candidateRouting = { ...routing!, providerId, modelId };
          try {
            const candidateProvider = await this.providers.create(request.workspaceId, providerId);
            const model = candidateProvider.provider.models.find(({ modelId: id }) => id === modelId);
            if (!model || !candidateProvider.adapter.stream) {
              throw new AiContractError("PROVIDER_UNAVAILABLE", "The selected provider does not support streaming");
            }
            this.runtime.validateModel(reservation!, model);
            const candidatePricing = await this.repository.findModelPricing(request.workspaceId, providerId, modelId);
            if (!candidatePricing) throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model pricing is unavailable");
            let attemptUsage: ProviderExecutionResult["usage"] | undefined;
            let attemptFinishReason: string | undefined;
            const maxAttempts = candidateIndex === 0 ? 3 : 1;
            let candidateSuccess = false;
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
              try {
                await this.withTimeout(async (signal) => {
                  await this.credentials.useCredential(request.workspaceId, providerId!, (credential) =>
                    candidateProvider.adapter.stream!({
                      requestId: request.requestId, modelId: modelId!, modelName: model.modelName,
                      apiBaseUrl: candidateProvider.provider.apiBaseUrl, messages: request.messages,
                      maxOutputTokens: reservation!.estimate.outputTokens, signal,
                      ...(request.tools ? { tools: request.tools } : {}),
                      ...(request.promptCache ? { promptCache: request.promptCache } : {})
                    }, credential, async (event) => {
                      if (event.usage) {
                        const { inputTokens, outputTokens, cachedTokens } = event.usage;
                        if ((inputTokens !== undefined && (!Number.isInteger(inputTokens) || inputTokens < 0)) ||
                            (outputTokens !== undefined && (!Number.isInteger(outputTokens) || outputTokens < 0 ||
                              outputTokens > reservation!.estimate.outputTokens)) ||
                            (cachedTokens !== undefined && (!Number.isInteger(cachedTokens) || cachedTokens < 0))) {
                          throw new AiContractError("RESPONSE_INVALID", "AI provider returned invalid usage data");
                        }
                      }
                      if (event.usage && event.usage.inputTokens !== undefined && event.usage.outputTokens !== undefined) {
                        attemptUsage = {
                          inputTokens: event.usage.inputTokens, outputTokens: event.usage.outputTokens,
                          ...(event.usage.cachedTokens !== undefined ? { cachedTokens: event.usage.cachedTokens } : {})
                        };
                      }
                      if (event.finishReason) attemptFinishReason = event.finishReason;
                      if (event.content) responseContent += event.content;
                      if (event.toolCall) this.validateToolCall(event.toolCall, request);
                      if (event.content || event.toolCall) outputEmitted = true;
                      await emit(event);
                    })
                  );
                }, leaseSignal, request.signal);
                candidateSuccess = true;
                break;
              } catch (error: unknown) {
                lastError = error;
                if (this.isCancellation(error, leaseSignal, request.signal)) throw error;
                if (this.isTerminalResponseError(error)) throw error;
                const mayRetry = attempt < maxAttempts && !outputEmitted && this.retryable(error);
                if (mayRetry) {
                  providerRetryCount += 1;
                  await this.retryDelay(providerRetryCount, leaseSignal, request.signal);
                  continue;
                }
                if (outputEmitted) throw error;
                break;
              }
            }
            if (!candidateSuccess) {
              lastError = lastError ?? new AiContractError("PROVIDER_UNAVAILABLE", "Provider stream failed");
              previous = candidate;
              continue;
            }
            finalUsage = attemptUsage;
            finishReason = attemptFinishReason;
            pricing = candidatePricing;
            resolvedProvider = candidateProvider;
            finalRouting = candidateRouting;
            break;
          } catch (error: unknown) {
            lastError = error;
            if (this.isCancellation(error, leaseSignal, request.signal) ||
                this.isTerminalResponseError(error) || outputEmitted) throw error;
            previous = candidate;
          }
        }
        if (!resolvedProvider || !pricing) throw lastError;
        });
      } finally {
        providerDurationMs = Date.now() - providerStartedAt;
      }
      providerCompletedAt = new Date();
      const usage = finalUsage ? this.usage.normalize(finalUsage) : null;
      const activePricing = pricing;
      const activeProvider = resolvedProvider;
      if (!activePricing || !activeProvider) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "No streaming provider candidate completed the invocation");
      }
      const cost = usage ? this.costs.normalize(usage, activePricing) : null;
      const runtimeBase = {
        reservation, invocationId, providerId, modelId,
        retryCount: providerRetryCount,
        executionDurationMs: Date.now() - startedAt, providerDurationMs
      };
      if (usage && cost) {
        await this.repository.complete({
          invocationId, workspaceId: request.workspaceId, providerId, modelId, routing: finalRouting,
          usage, cost, ...(finishReason ? { finishReason } : {}), responseContent,
          runtime: { ...runtimeBase, usage, cost }
        });
      } else {
        await this.repository.completeUnknownUsage({
          invocationId, workspaceId: request.workspaceId, providerId, modelId, routing: finalRouting,
          responseContent, pricing: activePricing, ...(finishReason ? { finishReason } : {}),
          runtime: runtimeBase
        });
      }
      return {
        invocationId, responseContent, ...(finishReason ? { finishReason } : {}),
        usage, cost, pricing: activePricing, providerCompletedAt, retryCount: providerRetryCount,
        providerId, modelId,
        nativePromptCacheSupported: activeProvider.adapter.promptCache?.supportsCaching() === true
      };
    } catch (error: unknown) {
      if (reservation && invocationId) {
        const normalized = this.errors.normalize(error);
        await this.repository.failWithRuntime({
          invocationId, workspaceId: request.workspaceId, error: normalized,
          runtime: {
            reservation, ...(providerId ? { providerId } : {}), ...(modelId ? { modelId } : {}),
            retryCount: providerRetryCount,
            executionDurationMs: Date.now() - startedAt, providerDurationMs,
            failureReason: normalized.code, cancelled: normalized.code === "CANCELLED"
          }
        });
      } else if (reservation) {
        await this.runtime.release(reservation);
      }
      throw error;
    }
  }

  private async completeWithRetry(
    input: Parameters<InvocationRepository["complete"]>[0]
  ): Promise<void> {
    try {
      await this.repository.complete(input);
    } catch {
      await this.repository.complete(input);
    }
  }

  private async failWithRetry(
    input: Parameters<InvocationRepository["failWithRuntime"]>[0]
  ): Promise<void> {
    try {
      await this.repository.failWithRuntime(input);
    } catch {
      await this.repository.failWithRuntime(input);
    }
  }

  private async executeProvider(input: {
    workspaceId: string;
    providerId: string;
    routing: RoutingDecision;
    modelName: string;
    apiBaseUrl: string | null;
    adapter: AiProviderAdapter;
    request: TrustedInvocationRequest;
    maxOutputTokens: number;
    leaseSignal: AbortSignal;
    maxAttempts: number;
    onRetry: () => number;
  }): Promise<{ result: ProviderExecutionResult; retryCount: number }> {
    const attempts = input.maxAttempts;
    let result: ProviderExecutionResult | undefined;
    let retryCount = 0;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.withTimeout(async (signal) => {
          await this.credentials.useCredential(
            input.workspaceId,
            input.providerId,
            async (credential) => {
              result = await input.adapter.invoke(
                {
                  requestId: input.request.requestId,
                  modelId: input.routing.modelId,
                  modelName: input.modelName,
                  apiBaseUrl: input.apiBaseUrl,
                  messages: input.request.messages,
                  maxOutputTokens: input.maxOutputTokens,
                  ...(input.request.tools ? { tools: input.request.tools } : {}),
                  ...(input.request.promptCache ? { promptCache: input.request.promptCache } : {}),
                  signal
                },
                credential
              );
            }
          );
        }, input.leaseSignal, input.request.signal);
        break;
      } catch (error: unknown) {
        if (attempt >= attempts || !this.retryable(error) ||
          input.leaseSignal.aborted || input.request.signal?.aborted) throw error;
        retryCount = input.onRetry();
        await this.retryDelay(retryCount, input.leaseSignal, input.request.signal);
      }
    }
    if (!result) throw new AiContractError("RESPONSE_INVALID", "Provider returned no response");
    this.validateProviderResult(result, input.request);
    if (result.usage.outputTokens > input.maxOutputTokens) throw new AiContractError(
      "RESPONSE_INVALID", "AI provider output exceeded the reserved token limit"
    );
    return { result, retryCount };
  }

  private validateProviderResult(result: ProviderExecutionResult, request: TrustedInvocationRequest): void {
    if (!result || typeof result !== "object" || typeof result.content !== "string" ||
        !result.usage || !Number.isInteger(result.usage.inputTokens) || result.usage.inputTokens < 0 ||
        !Number.isInteger(result.usage.outputTokens) || result.usage.outputTokens < 0 ||
        (result.usage.cachedTokens !== undefined &&
          (!Number.isInteger(result.usage.cachedTokens) || result.usage.cachedTokens < 0)) ||
        (result.finishReason !== undefined && typeof result.finishReason !== "string") ||
        (result.toolCalls !== undefined && !Array.isArray(result.toolCalls))) {
      throw new AiContractError("RESPONSE_INVALID", "AI provider returned a malformed response");
    }
    for (const toolCall of result.toolCalls ?? []) this.validateToolCall(toolCall, request);
  }

  private validateToolCall(
    toolCall: AiToolCallContract,
    request: TrustedInvocationRequest
  ): void {
    if (!toolCall || typeof toolCall.id !== "string" || !toolCall.id.trim() ||
        typeof toolCall.name !== "string" || !toolCall.name.trim() ||
        !toolCall.arguments || typeof toolCall.arguments !== "object" || Array.isArray(toolCall.arguments) ||
        !["pending", "completed", "failed", "rejected"].includes(toolCall.status) ||
        (toolCall.result !== undefined &&
          (!toolCall.result || typeof toolCall.result !== "object" || Array.isArray(toolCall.result)))) {
      throw new AiContractError("RESPONSE_INVALID", "AI provider returned a malformed tool call");
    }
    if (request.tools?.length && !request.tools.some((tool) => tool.name === toolCall.name)) {
      throw new AiContractError("RESPONSE_INVALID", "AI provider returned an undeclared tool call");
    }
  }

  private async withTimeout(
    operation: (signal: AbortSignal) => Promise<void>,
    parentSignal: AbortSignal,
    requestSignal?: AbortSignal
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutMs = this.config.getOrThrow<number>("ai.requestTimeoutMs");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const abortFromParent = (): void => controller.abort(parentSignal.reason);
    const abortFromRequest = (): void => controller.abort(requestSignal?.reason);
    try {
      if (parentSignal.aborted) abortFromParent();
      else parentSignal.addEventListener("abort", abortFromParent, { once: true });
      if (requestSignal?.aborted) abortFromRequest();
      else requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
      if (controller.signal.aborted) {
        throw new DOMException("AI invocation cancelled", "AbortError");
      }
      await Promise.race([
        operation(controller.signal),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new InvocationTimeoutError());
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abortFromParent);
      requestSignal?.removeEventListener("abort", abortFromRequest);
    }
  }

  private retryable(error: unknown): boolean {
    return error instanceof InvocationTimeoutError ||
      (error instanceof AiContractError &&
        (error.code === "RATE_LIMITED" || error.metadata?.retryable === true));
  }

  private isCancellation(
    error: unknown, leaseSignal: AbortSignal, requestSignal?: AbortSignal
  ): boolean {
    return leaseSignal.aborted || requestSignal?.aborted === true ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof AiContractError && error.code === "CANCELLED");
  }

  private isTerminalResponseError(error: unknown): boolean {
    return error instanceof AiContractError && error.code === "RESPONSE_INVALID";
  }

  private async retryDelay(
    retryCount: number, leaseSignal: AbortSignal, requestSignal?: AbortSignal
  ): Promise<void> {
    const delay = retryCount <= 1 ? 1_000 : 3_000;
    if (!delay) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(done, delay);
      const abort = () => done(new DOMException("AI invocation cancelled", "AbortError"));
      function done(error?: Error): void {
        clearTimeout(timer);
        leaseSignal.removeEventListener("abort", abort);
        requestSignal?.removeEventListener("abort", abort);
        if (error) reject(error); else resolve();
      }
      leaseSignal.addEventListener("abort", abort, { once: true });
      requestSignal?.addEventListener("abort", abort, { once: true });
      if (leaseSignal.aborted || requestSignal?.aborted) abort();
    });
  }
}
