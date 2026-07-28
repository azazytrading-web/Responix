import { Injectable } from "@nestjs/common";
import {
  RuntimeVariableSource,
  RuntimeVariableType,
  type RuntimeVariableDto
} from "./dto/agent-runtime.dto";

export type RuntimeValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type RuntimeVariableDefinition = {
  name: string;
  type: RuntimeVariableType;
  required: boolean;
  defaultValue?: unknown;
};

export type NormalizedRuntimeVariable = {
  name: string;
  type: RuntimeVariableType;
  source: RuntimeVariableSource;
  value: unknown;
};

@Injectable()
export class AgentRuntimeValidator {
  readonly reservedPrefixes = [
    "agent.",
    "conversation.",
    "execution.",
    "runtime.",
    "workspace."
  ];

  normalizeVariables(input: {
    supplied: RuntimeVariableDto[];
    defaults: RuntimeVariableDto[];
    definitions: RuntimeVariableDefinition[];
    builtIns: RuntimeVariableDto[];
  }): { variables: NormalizedRuntimeVariable[]; issues: RuntimeValidationIssue[] } {
    const issues: RuntimeValidationIssue[] = [];
    const suppliedNames = new Set<string>();
    for (const variable of input.supplied) {
      if (suppliedNames.has(variable.name)) {
        issues.push(this.issue("DUPLICATE_VARIABLE", `variables.${variable.name}`, "Runtime variable names must be unique"));
      }
      suppliedNames.add(variable.name);
      if (this.reservedPrefixes.some((prefix) => variable.name.startsWith(prefix))) {
        issues.push(this.issue("RESERVED_VARIABLE", `variables.${variable.name}`, "Runtime variable name is reserved"));
      }
    }

    const definitionNames = new Set<string>();
    for (const definition of input.definitions) {
      if (definitionNames.has(definition.name)) {
        issues.push(this.issue("DUPLICATE_DEFINITION", `definitions.${definition.name}`, "Prompt variable definitions must be unique"));
      }
      definitionNames.add(definition.name);
    }

    const merged = [...input.defaults, ...input.supplied];
    const values = new Map<string, RuntimeVariableDto>();
    for (const variable of merged) {
      if (values.has(variable.name)) {
        issues.push(this.issue("DUPLICATE_VARIABLE", `variables.${variable.name}`, "Resolved runtime variable names must be unique"));
      } else {
        values.set(variable.name, variable);
      }
    }

    for (const definition of input.definitions) {
      const variable = values.get(definition.name);
      if (!variable && definition.defaultValue !== undefined) {
        values.set(definition.name, {
          name: definition.name,
          type: definition.type,
          source: RuntimeVariableSource.AGENT,
          value: definition.defaultValue
        });
      } else if (!variable && definition.required) {
        issues.push(this.issue("REQUIRED_VARIABLE_MISSING", `variables.${definition.name}`, "Required runtime variable is missing"));
      }
      const resolved = values.get(definition.name);
      if (resolved && definition.type !== RuntimeVariableType.ANY && resolved.type !== definition.type) {
        issues.push(this.issue("VARIABLE_TYPE_MISMATCH", `variables.${definition.name}`, `Expected ${definition.type} but received ${resolved.type}`));
      }
    }

    const all = [...values.values(), ...input.builtIns];
    for (const variable of all) {
      if (!this.matchesType(variable.value, variable.type)) {
        issues.push(this.issue("VARIABLE_VALUE_INVALID", `variables.${variable.name}`, `Value is not compatible with ${variable.type}`));
      }
    }
    return {
      variables: all.sort((a, b) => a.name.localeCompare(b.name)),
      issues
    };
  }

  definition(value: unknown): RuntimeVariableDefinition | null {
    if (!this.isRecord(value) || typeof value.name !== "string") return null;
    const type = Object.values(RuntimeVariableType).includes(value.type as RuntimeVariableType)
      ? value.type as RuntimeVariableType
      : RuntimeVariableType.ANY;
    return {
      name: value.name,
      type,
      required: value.required === true,
      ...(Object.prototype.hasOwnProperty.call(value, "defaultValue")
        ? { defaultValue: value.defaultValue }
        : Object.prototype.hasOwnProperty.call(value, "default")
          ? { defaultValue: value.default }
          : {})
    };
  }

  variable(value: unknown, source: RuntimeVariableSource): RuntimeVariableDto | null {
    const definition = this.definition(value);
    if (!definition || !this.isRecord(value)) return null;
    const raw = Object.prototype.hasOwnProperty.call(value, "value")
      ? value.value
      : definition.defaultValue;
    if (raw === undefined) return null;
    return { name: definition.name, type: definition.type, source, value: raw };
  }

  isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private matchesType(value: unknown, type: RuntimeVariableType): boolean {
    if (type === RuntimeVariableType.ANY) return true;
    if (type === RuntimeVariableType.STRING) return typeof value === "string";
    if (type === RuntimeVariableType.NUMBER) return typeof value === "number" && Number.isFinite(value);
    if (type === RuntimeVariableType.INTEGER) return typeof value === "number" && Number.isInteger(value);
    if (type === RuntimeVariableType.BOOLEAN) return typeof value === "boolean";
    if (type === RuntimeVariableType.ARRAY) return Array.isArray(value);
    return this.isRecord(value);
  }

  private issue(code: string, path: string, message: string): RuntimeValidationIssue {
    return { code, path, message };
  }
}
