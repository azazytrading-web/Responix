import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { Prisma, OicDatabaseService } from "@oic/database";
import type {
  OicModelResolver, OicRawUsageEvidence, OicResolvedModel, OicRuntimeContext,
  OicRuntimeExecutionResult, OicRuntimeExecutor,
  OicRuntimePolicy, OicRuntimePolicyDecision, OicRuntimeRequest,
  OicRuntimeResponse, OicRuntimeStreamEvent, OicVisibleModel
} from "@oic/contracts";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { RuntimeContextResolver, RuntimeRequestIdentity } from "./runtime-context";
import { OIC_MODEL_RESOLVER } from "./model-resolver";
import { OicModelResolutionOperationError } from "./model-resolver";
import { OIC_RUNTIME_EXECUTOR } from "./runtime-executor";
import { OIC_RUNTIME_POLICY } from "./runtime-policy";
import { OicRuntimeException, runtimeErrorMessage } from "./runtime-errors";
import { AdmissionService } from "../admission/admission.service";

const OPERATION = "native.invoke.v1";
export type RuntimeOperation = typeof OPERATION | "native.stream.v1" | "compat.chat.v1" | "compat.responses.v1";
const MODEL_ID = /^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/i;
const MAX_OUTPUT_CHARACTERS = 1_000_000;

type Prepared = { context: OicRuntimeContext; policy: OicRuntimePolicyDecision; admissionKey?: string };
type Claim = { kind: "claimed"; id: string } | { kind: "running" } | { kind: "replayed"; response: OicRuntimeResponse };
type ManagedAbortController = AbortController & { oicTimer?: NodeJS.Timeout; oicParent?: AbortSignal; oicParentListener?: () => void };
export type EvaluationRuntimeTargetSnapshot = {
  modelId: string;
  resolverVersion: string;
  runtimeVersion: "1";
  revisionId: string | null;
  variantId: string | null;
  bindingId: string | null;
  profileId: string | null;
  profileRevision: number | null;
  providerConnectionId: string | null;
  providerDefinitionId: string | null;
  providerKey: string | null;
  upstreamModelRef: string | null;
  transportProfile: string | null;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
function cleanUsage(value: OicRawUsageEvidence | undefined): OicRawUsageEvidence | null {
  if (!value) return null;
  const result: OicRawUsageEvidence = {};
  for (const field of ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "internalComputeUnits", "retrievalUnits", "toolUnits"] as const) {
    const amount = value[field];
    if (amount !== undefined && Number.isSafeInteger(amount) && amount >= 0) result[field] = amount;
  }
  return Object.keys(result).length ? result : null;
}
function safeExecutionError(error: unknown): OicRuntimeException {
  return error instanceof OicRuntimeException ? error : new OicRuntimeException("RUNTIME_UNAVAILABLE");
}
function abortError(): Error {
  const error = new Error("Runtime request was cancelled");
  error.name = "AbortError";
  return error;
}

async function awaitRuntimeStep<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) throw abortError();
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([operation, aborted]); }
  finally { if (onAbort) signal.removeEventListener("abort", onAbort); }
}

@Injectable()
export class OicRuntimeService {
  constructor(
    private readonly db: OicDatabaseService,
    private readonly contexts: RuntimeContextResolver,
    @Inject(OIC_MODEL_RESOLVER) private readonly resolver: OicModelResolver,
    @Inject(OIC_RUNTIME_EXECUTOR) private readonly executor: OicRuntimeExecutor,
    @Inject(OIC_RUNTIME_POLICY) private readonly policy: OicRuntimePolicy,
    @Optional() private readonly admissions?: AdmissionService
  ) {}

  /** Static integration readiness; target and provider resolution remain a separate no-dispatch preflight. */
  evaluationAdmissionAvailable(): boolean {
    return Boolean(this.admissions);
  }

  async invoke(actor: AuthenticatedPrincipal, request: OicRuntimeRequest, identity: RuntimeRequestIdentity, idempotencyKey?: string, signal?: AbortSignal, operation: RuntimeOperation = OPERATION): Promise<OicRuntimeResponse> {
    const prepared = await this.prepare(actor, request, identity);
    if (idempotencyKey !== undefined && (idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey))) throw new OicRuntimeException("INVALID_REQUEST");
    const keyed = { ...prepared, admissionKey: idempotencyKey ?? randomUUID() };
    if (!idempotencyKey) return this.execute(keyed, request, signal, operation);
    const requestHash = createHash("sha256").update(canonical({ operation, request, applicationId: prepared.context.applicationId, tenantId: prepared.context.tenantId })).digest("hex");
    return this.executeIdempotently(actor, keyed, request, idempotencyKey, requestHash, operation, signal);
  }

  /** Trusted evaluation path: admission is keyed to the physical attempt and persisted before provider dispatch. */
  async describeEvaluationTarget(actor: AuthenticatedPrincipal, request: OicRuntimeRequest, identity: RuntimeRequestIdentity, onPreflightStage?: (stage: "RUNTIME_CONTEXT" | "MODEL_RESOLUTION") => Promise<void>): Promise<EvaluationRuntimeTargetSnapshot> {
    await onPreflightStage?.("RUNTIME_CONTEXT");
    const prepared = await this.prepare(actor, request, identity);
    await onPreflightStage?.("MODEL_RESOLUTION");
    const model = await this.resolveModel(request, prepared.context, "text.generate", true);
    return this.evaluationTargetSnapshot(model);
  }

  async invokeEvaluationAttempt(
    actor: AuthenticatedPrincipal,
    request: OicRuntimeRequest,
    identity: RuntimeRequestIdentity,
    attemptId: string,
    onAdmitted: (admissionId: string, target: EvaluationRuntimeTargetSnapshot) => Promise<void>,
    signal?: AbortSignal,
    onDispatchProgress?: (stage: "PROVIDER_ATTEMPT_CREATED" | "PROVIDER_DISPATCH_STARTED", providerAttemptId: string) => Promise<void>,
    onPreflightStage?: (stage: "RUNTIME_CONTEXT" | "MODEL_RESOLUTION") => Promise<void>
  ): Promise<{ response: OicRuntimeResponse; target: EvaluationRuntimeTargetSnapshot }> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) throw new OicRuntimeException("INVALID_REQUEST");
    if (!this.admissions) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
    await onPreflightStage?.("RUNTIME_CONTEXT");
    const prepared = { ...(await awaitRuntimeStep(this.prepare(actor, request, identity), signal)), admissionKey: `evaluation-attempt:${attemptId}` };
    await onPreflightStage?.("MODEL_RESOLUTION");
    const model = await awaitRuntimeStep(this.resolveModel(request, prepared.context, "text.generate", true), signal);
    if (signal?.aborted) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
    const target = this.evaluationTargetSnapshot(model);
    const response = await this.execute(prepared, request, signal, OPERATION, (admissionId) => onAdmitted(admissionId, target), model, onDispatchProgress);
    return { response, target };
  }

  private evaluationTargetSnapshot(model: OicResolvedModel): EvaluationRuntimeTargetSnapshot {
    const profile = model.intelligenceProfile;
    return {
      modelId: model.id,
      resolverVersion: model.resolverVersion,
      runtimeVersion: "1",
      revisionId: model.revisionId ?? null,
      variantId: (model as OicResolvedModel & { variantId?: string }).variantId ?? null,
      bindingId: (model as OicResolvedModel & { bindingId?: string }).bindingId ?? null,
      profileId: profile?.profileId ?? null,
      profileRevision: profile?.revision ?? null,
      providerConnectionId: (model as OicResolvedModel & { providerConnectionId?: string }).providerConnectionId ?? null,
      providerDefinitionId: (model as OicResolvedModel & { providerDefinitionId?: string }).providerDefinitionId ?? null,
      providerKey: (model as OicResolvedModel & { providerKey?: string }).providerKey ?? null,
      upstreamModelRef: (model as OicResolvedModel & { upstreamModelRef?: string | null }).upstreamModelRef ?? null,
      transportProfile: (model as OicResolvedModel & { transportProfile?: string }).transportProfile ?? null
    };
  }

  async stream(actor: AuthenticatedPrincipal, request: OicRuntimeRequest, identity: RuntimeRequestIdentity, idempotencyKey: string | undefined, signal?: AbortSignal): Promise<AsyncIterable<OicRuntimeStreamEvent>> {
    if (idempotencyKey !== undefined) throw new OicRuntimeException("STREAMING_IDEMPOTENCY_UNSUPPORTED");
    const prepared = { ...(await this.prepare(actor, request, identity)), admissionKey: randomUUID() };
    const model = await this.resolveModel(request, prepared.context, "text.stream");
    const admitted = await this.admit(prepared, request, "native.stream.v1");
    const responseId = randomUUID();
    return this.streamEvents(admitted, request, model, responseId, signal);
  }

  private async *streamEvents(prepared: Prepared, request: OicRuntimeRequest, model: OicResolvedModel, responseId: string, parentSignal?: AbortSignal): AsyncIterable<OicRuntimeStreamEvent> {
    const controller = this.executionSignal(prepared.policy.maxExecutionMs, parentSignal);
    const startedAt = Date.now();
    let outputText = "";
    let usage: OicRawUsageEvidence | undefined;
    let settled = false;
    try {
      yield { type: "response.started", responseId, model: request.model, requestId: prepared.context.requestId, traceId: prepared.context.traceId };
      const iterator = this.executor.stream(model, request, prepared.context, controller.signal)[Symbol.asyncIterator]();
      while (true) {
        const next = await this.nextWithAbort(iterator, controller.signal);
        if (next.done) break;
        const chunk = next.value;
        if (chunk.type === "content.delta") {
          outputText += chunk.text;
          if (outputText.length > MAX_OUTPUT_CHARACTERS) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
          yield { type: "content.delta", responseId, text: chunk.text };
        } else if (chunk.type === "usage.updated") {
          usage = cleanUsage(chunk.usage) ?? undefined;
          if (usage) yield { type: "usage.updated", responseId, usage };
        }
      }
      if (controller.signal.aborted) return;
      const response: OicRuntimeResponse = {
        object: "oic.runtime.response", id: responseId, model: request.model,
        output: [{ role: "assistant", content: [{ type: "text", text: outputText }] }],
        finishReason: "completed",
        usage: cleanUsage(usage), createdAt: new Date().toISOString(),
        requestId: prepared.context.requestId, traceId: prepared.context.traceId,
        execution: { runtimeVersion: "1", durationMs: Date.now() - startedAt }
      };
      if (prepared.context.admissionId && this.admissions) { await this.admissions.settle(prepared.context.admissionId, response.usage ?? null); settled = true; }
      yield { type: "response.completed", response };
    } catch (error) {
      if (controller.signal.aborted) return;
      const safe = safeExecutionError(error);
      if (prepared.context.admissionId && this.admissions && !settled) { await this.admissions.uncertain(prepared.context.admissionId).catch(() => undefined); settled = true; }
      yield { type: "response.error", error: { code: safe.code, message: runtimeErrorMessage(safe.code), requestId: prepared.context.requestId, traceId: prepared.context.traceId } };
    } finally {
      if (prepared.context.admissionId && this.admissions && !settled) await this.admissions.uncertain(prepared.context.admissionId).catch(() => undefined);
      this.disposeExecutionSignal(controller, parentSignal);
    }
  }

  async listVisibleModels(actor: AuthenticatedPrincipal, tenant: OicRuntimeRequest["tenant"], identity: RuntimeRequestIdentity): Promise<{ context: OicRuntimeContext; models: OicVisibleModel[] }> {
    if (!actor.scopes.includes("oic:runtime:models:read")) throw new OicRuntimeException("AUTHORIZATION_DENIED");
    const context = await this.contexts.resolve(actor, { tenant }, identity);
    const models = await this.resolver.listVisible(context);
    return { context, models: models.filter((model) => MODEL_ID.test(model.id)).sort((left, right) => left.id.localeCompare(right.id)) };
  }

  private async prepare(actor: AuthenticatedPrincipal, request: OicRuntimeRequest, identity: RuntimeRequestIdentity): Promise<Prepared> {
    if (!actor.scopes.includes("oic:runtime:invoke")) throw new OicRuntimeException("AUTHORIZATION_DENIED");
    const context = await this.contexts.resolve(actor, request, identity);
    const policy = await this.policy.evaluate(request, context);
    if (!policy.allowed) throw new OicRuntimeException("AUTHORIZATION_DENIED");
    return { context, policy };
  }

  private async resolveModel(request: OicRuntimeRequest, context: OicRuntimeContext, capability: "text.generate" | "text.stream", forEvaluation = false): Promise<OicResolvedModel> {
    if (!MODEL_ID.test(request.model)) throw new OicRuntimeException("INVALID_REQUEST");
    let model: OicResolvedModel | null;
    try {
      const evaluationResolver = this.resolver as OicModelResolver & { resolveForEvaluation?: (modelId: OicRuntimeRequest["model"], context: OicRuntimeContext) => Promise<OicResolvedModel | null> };
      model = forEvaluation && evaluationResolver.resolveForEvaluation
        ? await evaluationResolver.resolveForEvaluation(request.model, context)
        : await this.resolver.resolve(request.model, context);
    }
    catch (error) {
      const unavailable = new OicRuntimeException("RUNTIME_UNAVAILABLE");
      if (error instanceof OicModelResolutionOperationError) {
        Object.defineProperty(unavailable, "safeModelResolutionDiagnostic", { value: error.safeDiagnostic, enumerable: false });
      }
      throw unavailable;
    }
    if (!model) throw new OicRuntimeException("MODEL_NOT_AVAILABLE");
    if (!MODEL_ID.test(model.id) || model.id !== request.model) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
    if (model.tenantRequired && context.tenantId === null) throw new OicRuntimeException("TENANT_NOT_ALLOWED");
    if (!model.capabilities.includes(capability)) throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
    return model;
  }

  private async execute(prepared: Prepared, request: OicRuntimeRequest, signal?: AbortSignal, operation: RuntimeOperation = OPERATION, onAdmitted?: (admissionId: string) => Promise<void>, pinnedModel?: OicResolvedModel, onDispatchProgress?: (stage: "PROVIDER_ATTEMPT_CREATED" | "PROVIDER_DISPATCH_STARTED", providerAttemptId: string) => Promise<void>): Promise<OicRuntimeResponse> {
    const model = pinnedModel ?? await this.resolveModel(request, prepared.context, "text.generate");
    const admitted = await awaitRuntimeStep(this.admit(prepared, request, operation), signal);
    if (signal?.aborted) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
    const controller = this.executionSignal(prepared.policy.maxExecutionMs, signal);
    const startedAt = Date.now();
    try {
      if (onAdmitted && !admitted.context.admissionId) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
      if (admitted.context.admissionId && onAdmitted) {
        try {
          await onAdmitted(admitted.context.admissionId);
          await this.admissions!.markEvaluationDispatchedOnce(admitted.context.admissionId);
        }
        catch { if (this.admissions) await this.admissions.uncertain(admitted.context.admissionId).catch(() => undefined); throw new OicRuntimeException("RUNTIME_UNAVAILABLE"); }
      }
      let result: OicRuntimeExecutionResult;
      try { result = await this.executor.execute(model, request, admitted.context, controller.signal, onDispatchProgress); }
      catch (error) {
        if (admitted.context.admissionId && this.admissions) await this.admissions.uncertain(admitted.context.admissionId).catch(() => undefined);
        throw safeExecutionError(error);
      }
      if (controller.signal.aborted) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
      if (result.outputText.length > MAX_OUTPUT_CHARACTERS) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
      const response: OicRuntimeResponse = {
        object: "oic.runtime.response", id: randomUUID(), model: request.model,
        output: [{ role: "assistant", content: [{ type: "text", text: result.outputText }] }],
        finishReason: result.finishReason,
        usage: cleanUsage(result.usage), createdAt: new Date().toISOString(),
        requestId: prepared.context.requestId, traceId: prepared.context.traceId,
        execution: { runtimeVersion: "1", durationMs: Date.now() - startedAt }
      };
      if (admitted.context.admissionId && this.admissions) await this.admissions.settle(admitted.context.admissionId, response.usage ?? null);
      return response;
    } finally { this.disposeExecutionSignal(controller, signal); }
  }

  private async executeIdempotently(actor: AuthenticatedPrincipal, prepared: Prepared, request: OicRuntimeRequest, key: string, requestHash: string, operation: RuntimeOperation, signal?: AbortSignal): Promise<OicRuntimeResponse> {
    const scope = `${prepared.context.applicationId}:${prepared.context.tenantId ?? "application"}`;
    const leaseMs = Math.min(Number(process.env.OIC_RUNTIME_MAX_EXECUTION_MS ?? 60_000) + 30_000, 330_000);
    const deadline = Date.now() + 5_000;
    while (Date.now() <= deadline) {
      let claim: Claim;
      try { claim = await this.claim(actor, scope, key, requestHash, operation, leaseMs); }
      catch (error) { if (isUniqueConflict(error)) continue; throw error; }
      if (claim.kind === "replayed") return claim.response;
      if (claim.kind === "running") { await new Promise((resolve) => setTimeout(resolve, 30)); continue; }
      try {
        const response = await this.execute(prepared, request, signal, operation);
        const saved = await this.db.oicIdempotencyRecord.updateMany({
          where: { id: claim.id, status: "IN_PROGRESS", requestHash },
          data: { status: "COMPLETED", result: response }
        });
        if (saved.count !== 1) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
        return response;
      } catch (error) {
        await this.db.oicIdempotencyRecord.deleteMany({ where: { id: claim.id, status: "IN_PROGRESS" } }).catch(() => undefined);
        throw error;
      }
    }
    throw new OicRuntimeException("IDEMPOTENCY_IN_PROGRESS");
  }

  private async admit(prepared: Prepared, request: OicRuntimeRequest, operation: RuntimeOperation): Promise<Prepared> {
    if (!this.admissions || !prepared.admissionKey) return prepared;
    const inputBytes = Buffer.byteLength(request.input.flatMap((message) => message.content.map((part) => part.text)).join(""), "utf8");
    const result = await this.admissions.admit(prepared.context, request, operation, prepared.admissionKey, {
      requestUnits: "1", inputTokens: String(inputBytes), outputTokens: String(prepared.policy.maxOutputUnits)
    });
    if (result.status === "DENIED") throw new OicRuntimeException((result.denialCode ?? "NOT_ENTITLED") as ConstructorParameters<typeof OicRuntimeException>[0]);
    return { ...prepared, context: { ...prepared.context, admissionId: result.id } };
  }

  private async claim(actor: AuthenticatedPrincipal, scope: string, key: string, requestHash: string, operation: RuntimeOperation, leaseMs: number): Promise<Claim> {
    const unique = { principalId_scope_operation_key: { principalId: actor.id, scope, operation, key } };
    return this.db.$transaction(async (tx) => {
      const existing = await tx.oicIdempotencyRecord.findUnique({ where: unique });
      if (existing) {
        const stale = existing.expiresAt <= new Date() || (existing.status === "IN_PROGRESS" && Date.now() - existing.createdAt.getTime() > leaseMs);
        if (stale) await tx.oicIdempotencyRecord.delete({ where: { id: existing.id } });
        else {
          if (existing.requestHash !== requestHash) throw new OicRuntimeException("IDEMPOTENCY_CONFLICT");
          if (existing.status === "COMPLETED") {
            if (!existing.result || typeof existing.result !== "object" || Array.isArray(existing.result)) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
            return { kind: "replayed", response: existing.result as unknown as OicRuntimeResponse };
          }
          if (existing.status === "IN_PROGRESS") return { kind: "running" };
          await tx.oicIdempotencyRecord.delete({ where: { id: existing.id } });
        }
      }
      const created = await tx.oicIdempotencyRecord.create({ data: {
        principalId: actor.id, scope, operation, key, requestHash,
        status: "IN_PROGRESS", expiresAt: new Date(Date.now() + Number(process.env.OIC_RUNTIME_IDEMPOTENCY_TTL_SECONDS ?? 86_400) * 1000)
      }, select: { id: true } });
      return { kind: "claimed", id: created.id };
    });
  }

  private executionSignal(timeoutMs: number, parent?: AbortSignal): AbortController {
    const controller = new AbortController() as ManagedAbortController;
    if (parent?.aborted) controller.abort(parent.reason);
    else if (parent) {
      controller.oicParent = parent;
      controller.oicParentListener = () => controller.abort(parent.reason);
      parent.addEventListener("abort", controller.oicParentListener, { once: true });
    }
    controller.oicTimer = setTimeout(() => controller.abort(new Error("Runtime execution time limit exceeded")), timeoutMs);
    return controller;
  }

  private disposeExecutionSignal(controller: AbortController, parent?: AbortSignal): void {
    const managed = controller as ManagedAbortController;
    clearTimeout(managed.oicTimer);
    if (parent && managed.oicParentListener) parent.removeEventListener("abort", managed.oicParentListener);
  }

  private async nextWithAbort<T>(iterator: AsyncIterator<T>, signal: AbortSignal): Promise<IteratorResult<T>> {
    if (signal.aborted) { void iterator.return?.(); throw abortError(); }
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(abortError());
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try { return await Promise.race([iterator.next(), aborted]); }
    catch (error) { void Promise.resolve(iterator.return?.()).catch(() => undefined); throw error; }
    finally { if (onAbort) signal.removeEventListener("abort", onAbort); }
  }
}
