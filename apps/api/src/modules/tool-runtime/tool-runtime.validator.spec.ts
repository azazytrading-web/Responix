import { BadRequestException } from "@nestjs/common";
import { ToolRuntimeValidator } from "./tool-runtime.validator";
import type { ToolRuntimeSnapshot } from "./tool-runtime.types";

describe("ToolRuntimeValidator", () => {
  const validator = new ToolRuntimeValidator();
  const snapshot = { parameters: [], permissions: [], capabilities: [],
    compatibilityMetadata: { runtimeVersion: "1.2" }, schemas: [
      { kind: "INPUT", schema: { type: "object", additionalProperties: false,
        required: ["query"], properties: { query: { type: "string", pattern: "^[a-z]+$" },
          limit: { type: "integer", default: 10 }, nested: { type: "object", properties: {
            enabled: { type: "boolean", default: true } } } } } },
      { kind: "OUTPUT", schema: { type: "object", required: ["ok"],
        properties: { ok: { type: "boolean" } } } }
    ] } as unknown as ToolRuntimeSnapshot;

  it("normalizes nested strongly typed input and applies immutable defaults", () => {
    validator.validateSnapshot(snapshot);
    expect(validator.normalizeInput(snapshot, { query: "hello", nested: {} })).toEqual({
      query: "hello", limit: 10, nested: { enabled: true }
    });
  });

  it.each([{ query: "UPPER" }, { query: "valid", extra: true }, { limit: 1 }])(
    "rejects invalid schema input %#", (input) => {
      expect(() => validator.normalizeInput(snapshot, input)).toThrow(BadRequestException);
    });

  it("validates output and runtime major-version compatibility", () => {
    expect(() => validator.validateOutput(snapshot, { ok: "yes" })).toThrow(BadRequestException);
    expect(() => validator.assertCompatibility(snapshot, "2.0")).toThrow(BadRequestException);
    expect(() => validator.assertCompatibility(snapshot, "1.0")).not.toThrow();
  });
});
