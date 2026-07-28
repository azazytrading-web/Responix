import { BadRequestException } from "@nestjs/common";
import { RuntimeOrchestrationValidator } from "./runtime-orchestration.validator";

describe("RuntimeOrchestrationValidator", () => {
  const validator = new RuntimeOrchestrationValidator();
  const valid = () => ({
    bindings: [
      { key: "workflow", targetType: "WORKFLOW" as const, referenceId: "11111111-1111-4111-8111-111111111111" },
      { key: "tool", targetType: "TOOL" as const, referenceId: "22222222-2222-4222-8222-222222222222" }
    ],
    dependencies: [{ bindingKey: "tool", dependsOnBindingKey: "workflow" }],
    retryPolicy: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, multiplier: 2 },
    timeouts: { totalMs: 30000, stepMs: 5000, idleMs: 10000 },
    concurrencyPolicy: { maxParallel: 5, maxQueued: 100, strategy: "QUEUE" },
    fallbackPolicy: {
      strategy: "USE_TARGET", targetType: "AGENT" as const,
      targetReferenceId: "33333333-3333-4333-8333-333333333333"
    }
  });

  it("accepts consistent orchestration policies and dependencies", () => {
    expect(() => validator.validate(valid())).not.toThrow();
  });

  it("rejects duplicate and missing binding dependencies", () => {
    const duplicate = valid();
    duplicate.bindings.push({ ...duplicate.bindings[0]! });
    expect(() => validator.validate(duplicate)).toThrow(BadRequestException);
    const missing = valid();
    missing.dependencies[0]!.dependsOnBindingKey = "missing";
    expect(() => validator.validate(missing)).toThrow(BadRequestException);
  });

  it("rejects circular dependencies", () => {
    const input = valid();
    input.dependencies.push({ bindingKey: "workflow", dependsOnBindingKey: "tool" });
    expect(() => validator.validate(input)).toThrow(BadRequestException);
  });

  it.each([
    ["retry delay order", (input: ReturnType<typeof valid>) => { input.retryPolicy.maxDelayMs = 10; }],
    ["single-attempt delay", (input: ReturnType<typeof valid>) => { input.retryPolicy.maxAttempts = 1; }],
    ["step timeout", (input: ReturnType<typeof valid>) => { input.timeouts.stepMs = 40000; }],
    ["idle timeout", (input: ReturnType<typeof valid>) => { input.timeouts.idleMs = 40000; }],
    ["queue capacity", (input: ReturnType<typeof valid>) => { input.concurrencyPolicy.maxQueued = 0; }],
    ["fallback pair", (input: ReturnType<typeof valid>) => { input.fallbackPolicy.targetReferenceId = undefined as never; }]
  ])("rejects invalid %s", (_label, mutate) => {
    const input = valid();
    mutate(input);
    expect(() => validator.validate(input)).toThrow(BadRequestException);
  });

  it("enforces numeric ranges even when called outside the controller validation pipe", () => {
    const retry = valid();
    retry.retryPolicy.maxAttempts = 21;
    expect(() => validator.validate(retry)).toThrow(BadRequestException);
    const timeout = valid();
    timeout.timeouts.totalMs = 99;
    expect(() => validator.validate(timeout)).toThrow(BadRequestException);
    const concurrency = valid();
    concurrency.concurrencyPolicy.maxParallel = -1;
    expect(() => validator.validate(concurrency)).toThrow(BadRequestException);
    expect(() => validator.validate({ ...valid(), limits: { maxSteps: 0 } }))
      .toThrow(BadRequestException);
  });

  it("enforces keyed concurrency templates", () => {
    const missing = valid();
    missing.concurrencyPolicy.strategy = "KEYED";
    expect(() => validator.validate(missing)).toThrow(BadRequestException);
    const validKeyed = valid();
    validKeyed.concurrencyPolicy = {
      maxParallel: 2, maxQueued: 10, strategy: "KEYED", keyTemplate: "{{workspace.id}}"
    } as never;
    expect(() => validator.validate(validKeyed)).not.toThrow();
  });
});
