import type { CreateExecutionPipelineDto } from "./dto/execution-pipeline.dto";
import { PipelineAssetType, PipelineVariableType } from "./dto/execution-pipeline.dto";
import { ExecutionPipelineValidator } from "./execution-pipeline.validator";

const base = (overrides: Partial<CreateExecutionPipelineDto> = {}): CreateExecutionPipelineDto => ({
  name: "Agent Request Pipeline", compatibilityVersion: "1.0.0",
  nodes: [
    { nodeKey: "start", stage: "START", ordinal: 0 },
    { nodeKey: "agent", stage: "AGENT", ordinal: 1 }
  ],
  dependencies: [{
    dependencyKey: "start-agent", fromNodeKey: "start", toNodeKey: "agent"
  }],
  variables: [{ name: "customer_name", type: PipelineVariableType.STRING, value: "Ada" }],
  ...overrides
});

describe("ExecutionPipelineValidator", () => {
  const validator = new ExecutionPipelineValidator();
  it("accepts a valid acyclic metadata pipeline", () => {
    expect(validator.validate(base())).toEqual({ valid: true, diagnostics: [] });
  });
  it.each([
    [{ nodes: [
      { nodeKey: "same", stage: "ONE", ordinal: 0 },
      { nodeKey: "same", stage: "TWO", ordinal: 1 }
    ] }, "DUPLICATE_NODE_ID"],
    [{ nodes: [
      { nodeKey: "one", stage: "SAME", ordinal: 0 },
      { nodeKey: "two", stage: "SAME", ordinal: 1 }
    ] }, "DUPLICATE_STAGE"],
    [{ dependencies: [
      { dependencyKey: "same", fromNodeKey: "start", toNodeKey: "agent" },
      { dependencyKey: "same", fromNodeKey: "start", toNodeKey: "agent" }
    ] }, "DUPLICATE_DEPENDENCY"],
    [{ variables: [
      { name: "same", type: PipelineVariableType.STRING, value: "a" },
      { name: "SAME", type: PipelineVariableType.STRING, value: "b" }
    ] }, "DUPLICATE_VARIABLE"]
  ])("rejects duplicate pipeline metadata %#", (overrides, code) => {
    const result = validator.validate(base(overrides));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });
  it.each(["system.id", "runtime.trace", "workspace.id", "tenant.id", "execution.id", "_secret"])(
    "rejects reserved variable %s", (name) => {
      const result = validator.validate(base({
        variables: [{ name, type: PipelineVariableType.STRING, value: "x" }]
      }));
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "RESERVED_VARIABLE" })
      ]));
    }
  );
  it.each([
    [PipelineVariableType.STRING, 1], [PipelineVariableType.NUMBER, "1"],
    [PipelineVariableType.BOOLEAN, "true"], [PipelineVariableType.ARRAY, {}],
    [PipelineVariableType.OBJECT, []], [PipelineVariableType.NULL, false]
  ])("rejects incompatible %s variables", (type, value) => {
    const result = validator.validate(base({ variables: [{ name: "value", type, value }] }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VARIABLE_TYPE_MISMATCH" })
    ]));
  });
  it("rejects empty required variables", () => {
    const result = validator.validate(base({
      variables: [{ name: "required", type: PipelineVariableType.STRING, value: "", required: true }]
    }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_VARIABLE" })
    ]));
  });
  it("rejects missing dependency endpoints", () => {
    const result = validator.validate(base({
      dependencies: [{ dependencyKey: "bad", fromNodeKey: "start", toNodeKey: "missing" }]
    }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_DEPENDENCY_NODE" })
    ]));
  });
  it("rejects self dependencies", () => {
    const result = validator.validate(base({
      dependencies: [{ dependencyKey: "self", fromNodeKey: "start", toNodeKey: "start" }]
    }));
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "SELF_DEPENDENCY", "INVALID_ORDERING", "CYCLIC_DEPENDENCY"
    ]));
  });
  it("rejects reversed dependency ordering", () => {
    const result = validator.validate(base({
      dependencies: [{ dependencyKey: "reverse", fromNodeKey: "agent", toNodeKey: "start" }]
    }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_ORDERING" })
    ]));
  });
  it("rejects cycles", () => {
    const result = validator.validate(base({
      nodes: [
        { nodeKey: "a", stage: "A", ordinal: 0 },
        { nodeKey: "b", stage: "B", ordinal: 1 }
      ],
      dependencies: [
        { dependencyKey: "ab", fromNodeKey: "a", toNodeKey: "b" },
        { dependencyKey: "ba", fromNodeKey: "b", toNodeKey: "a" }
      ]
    }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CYCLIC_DEPENDENCY" })
    ]));
  });
  it("requires complete asset references", () => {
    const result = validator.validate(base({
      nodes: [{ nodeKey: "agent", stage: "AGENT", ordinal: 0,
        assetType: PipelineAssetType.AGENT_RUNTIME }]
    }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INCOMPLETE_ASSET_REFERENCE" })
    ]));
  });
  it("rejects unsupported compatibility versions", () => {
    expect(validator.validate(base({ compatibilityVersion: "2.0.0" })).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "VERSION_INCOMPATIBLE" })]));
  });
  it("rejects empty pipelines", () => {
    expect(validator.validate(base({ nodes: [], dependencies: [] })).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "EMPTY_PIPELINE" })]));
  });
  it("normalizes ordering and display values deterministically", () => {
    const normalized = validator.normalize(base({
      nodes: [
        { nodeKey: "two", stage: "TWO", ordinal: 2 },
        { nodeKey: "one", stage: "ONE", ordinal: 1 }
      ],
      labels: [{ value: " Priority " }]
    }));
    expect(normalized.nodes.map(({ nodeKey }) => nodeKey)).toEqual(["one", "two"]);
    expect(normalized.labels).toEqual([{ value: "Priority" }]);
  });
});
