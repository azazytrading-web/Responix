import type { OicResolvedModel, OicRuntimeContext, OicRuntimeExecutionResult, OicRuntimeExecutor, OicRuntimeExecutionStreamChunk, OicRuntimeRequest } from "@oic/contracts";
import { OicRuntimeException } from "./runtime-errors";

export const OIC_RUNTIME_EXECUTOR = Symbol("OIC_RUNTIME_EXECUTOR");

/** Fails closed. OIC-2 has no production model executor. */
export class UnavailableOicRuntimeExecutor implements OicRuntimeExecutor {
  execute(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): Promise<OicRuntimeExecutionResult> {
    void model; void request; void context; void signal;
    return Promise.reject(new OicRuntimeException("RUNTIME_UNAVAILABLE"));
  }
  stream(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): AsyncIterable<OicRuntimeExecutionStreamChunk> {
    void model; void request; void context; void signal;
    return {
      [Symbol.asyncIterator]() {
        return { next: () => Promise.reject(new OicRuntimeException("RUNTIME_UNAVAILABLE")) };
      }
    };
  }
}
