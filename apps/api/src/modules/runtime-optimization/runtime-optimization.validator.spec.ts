import { BadRequestException } from "@nestjs/common";
import { RuntimeOptimizationValidator } from "./runtime-optimization.validator";

describe("RuntimeOptimizationValidator", () => {
  const validator = new RuntimeOptimizationValidator();
  it("accepts deterministic static variables", () => {
    expect(() => validator.validateStaticVariables({
      brand: "Responix", locale: "en", settings: { tone: "concise" }
    })).not.toThrow();
  });
  it.each([
    "user.name", "message", "conversation.locale", "history_items",
    "execution.id", "request-id", "runtime.value", "dynamic.token"
  ])("rejects dynamic variable %s", (name) => {
    expect(() => validator.validateStaticVariables({ [name]: "value" }))
      .toThrow(BadRequestException);
  });
  it("rejects invalid and circular static values", () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    expect(() => validator.validateStaticVariables({ "bad name": true })).toThrow();
    expect(() => validator.validateStaticVariables({ static: circular })).toThrow();
  });
  it("requires a runtime context asset", () => {
    expect(() => validator.validateContext({})).toThrow("requires an asset");
  });
  it("accepts immutable context metadata", () => {
    expect(() => validator.validateContext({
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      immutableMetadata: { persona: "support" }
    })).not.toThrow();
  });
  it("validates unique BCP-47 retrieval languages", () => {
    expect(() => validator.validateRetrieval({
      retrievalRuntimeSnapshotId: "id", languages: ["en", "ar-EG"]
    })).not.toThrow();
    expect(() => validator.validateRetrieval({
      retrievalRuntimeSnapshotId: "id", languages: ["en", "en"]
    })).toThrow("unique");
    expect(() => validator.validateRetrieval({
      retrievalRuntimeSnapshotId: "id", languages: ["not valid"]
    })).toThrow("Invalid retrieval language");
  });
});
