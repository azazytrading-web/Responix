import {
  RuntimeVariableSource,
  RuntimeVariableType
} from "./dto/agent-runtime.dto";
import { AgentRuntimeValidator } from "./agent-runtime.validator";

describe("AgentRuntimeValidator", () => {
  const validator = new AgentRuntimeValidator();

  it("normalizes typed variables and deterministic workspace built-ins", () => {
    const result = validator.normalizeVariables({
      supplied: [{
        name: "customerName",
        type: RuntimeVariableType.STRING,
        source: RuntimeVariableSource.EXECUTION_REQUEST,
        value: "Ada"
      }],
      defaults: [],
      definitions: [{
        name: "customerName",
        type: RuntimeVariableType.STRING,
        required: true
      }],
      builtIns: [{
        name: "workspace.id",
        type: RuntimeVariableType.STRING,
        source: RuntimeVariableSource.WORKSPACE,
        value: "workspace"
      }]
    });
    expect(result.issues).toEqual([]);
    expect(result.variables.map(({ name }) => name)).toEqual(["customerName", "workspace.id"]);
  });

  it("rejects duplicate and reserved supplied names", () => {
    const result = validator.normalizeVariables({
      supplied: [
        { name: "runtime.secret", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.ENVIRONMENT, value: "x" },
        { name: "runtime.secret", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.ENVIRONMENT, value: "y" }
      ],
      defaults: [],
      definitions: [],
      builtIns: []
    });
    expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "DUPLICATE_VARIABLE",
      "RESERVED_VARIABLE"
    ]));
  });

  it("rejects missing required values and incompatible value types", () => {
    const result = validator.normalizeVariables({
      supplied: [{
        name: "attempts",
        type: RuntimeVariableType.INTEGER,
        source: RuntimeVariableSource.EXECUTION,
        value: "three"
      }],
      defaults: [],
      definitions: [
        { name: "attempts", type: RuntimeVariableType.INTEGER, required: true },
        { name: "requiredName", type: RuntimeVariableType.STRING, required: true }
      ],
      builtIns: []
    });
    expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "VARIABLE_VALUE_INVALID",
      "REQUIRED_VARIABLE_MISSING"
    ]));
  });

  it("extracts variable definitions and defaults from metadata", () => {
    expect(validator.definition({
      name: "region",
      type: "STRING",
      required: true,
      default: "eu"
    })).toEqual({
      name: "region",
      type: "STRING",
      required: true,
      defaultValue: "eu"
    });
    expect(validator.definition({ type: "STRING" })).toBeNull();
  });
});

