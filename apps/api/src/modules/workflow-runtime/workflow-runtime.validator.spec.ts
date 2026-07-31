import { BadRequestException } from "@nestjs/common";
import { WorkflowRuntimeValidator } from "./workflow-runtime.validator";
import type { WorkflowRuntimeSnapshot } from "./workflow-runtime.types";

const snapshot = (nodes: WorkflowRuntimeSnapshot["nodes"], edges: WorkflowRuntimeSnapshot["edges"] = []) => ({
  name: "Runtime", slug: "runtime", variables: [{ name: "score", schema: { type: "number" },
    required: true, defaultValue: 1 }], inputs: [{ name: "customer", schema: { type: "object" }, required: true }],
  outputs: [], nodes, edges, branches: []
}) as WorkflowRuntimeSnapshot;

describe("WorkflowRuntimeValidator", () => {
  const validator = new WorkflowRuntimeValidator();

  it("validates executable graphs and creates an isolated typed context", () => {
    const value = snapshot([{ id: "start", type: "START" }, { id: "delay", type: "DELAY",
      configuration: { delayMs: 5, retry: { maxAttempts: 2, delayMs: 1 } } }, { id: "end", type: "END" }],
    [{ id: "a", sourceNodeId: "start", targetNodeId: "delay" },
      { id: "b", sourceNodeId: "delay", targetNodeId: "end" }]);
    expect(() => validator.validateSnapshot(value)).not.toThrow();
    expect(validator.initialContext(value, { customer: { id: 1 } }, { trace: true }))
      .toMatchObject({ globals: { score: 1 }, input: { customer: { id: 1 } }, nodes: {}, output: {} });
  });

  it.each([
    snapshot([{ id: "tool", type: "TOOL" }]),
    snapshot([{ id: "agent", type: "AGENT" }]),
    snapshot([{ id: "delay", type: "DELAY", configuration: { delayMs: -1 } }]),
    snapshot([{ id: "sub", type: "SUBWORKFLOW", configuration: {} }]),
    snapshot([{ id: "start", type: "START" }, { id: "end", type: "END" }], [
      { id: "a", sourceNodeId: "start", targetNodeId: "end" },
      { id: "b", sourceNodeId: "end", targetNodeId: "start" }
    ])
  ])("rejects invalid executable snapshot %#", (value) => {
    expect(() => validator.validateSnapshot(value)).toThrow(BadRequestException);
  });

  it("validates required input and primitive variable types", () => {
    const value = snapshot([{ id: "start", type: "START" }]);
    expect(() => validator.validateInput(value, {})).toThrow("Required workflow input customer is missing");
    expect(() => validator.initialContext(value, { customer: {}, score: "high" }, {}))
      .toThrow("variables.score");
  });

  it("evaluates branches and resolves immutable context references", () => {
    const context = { input: { score: 9 }, globals: {}, nodes: {}, output: {}, metadata: {} };
    expect(validator.evaluate({ path: "input.score", operator: "greaterThan", value: 5 }, context)).toBe(true);
    expect(validator.resolve({ result: { from: "input.score" } }, context)).toEqual({ result: 9 });
    expect(() => validator.evaluate({ path: "input.score", operator: "execute", value: 5 }, context))
      .toThrow(BadRequestException);
  });
});
