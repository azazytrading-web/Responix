import { BadRequestException, Injectable } from "@nestjs/common";
import type { WorkflowExecutionContext, WorkflowRuntimeSnapshot } from "./workflow-runtime.types";

@Injectable()
export class WorkflowRuntimeValidator {
  validateSnapshot(snapshot: WorkflowRuntimeSnapshot) {
    if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges) || !Array.isArray(snapshot.inputs) ||
      !Array.isArray(snapshot.outputs) || !Array.isArray(snapshot.variables) || !Array.isArray(snapshot.branches)) {
      throw new BadRequestException("Workflow snapshot structure is invalid");
    }
    const supported = new Set(["START", "END", "AGENT", "CONDITION", "DECISION", "PARALLEL",
      "MERGE", "DELAY", "APPROVAL", "VARIABLE", "SUBFLOW", "SUBWORKFLOW"]);
    for (const node of snapshot.nodes) {
      if (!supported.has(node.type)) {
        throw new BadRequestException(`Workflow node ${node.id} type ${node.type} is not executable`);
      }
      const config = node.configuration ?? {};
      if (node.type === "AGENT" && !this.record(config.execution)) {
        throw new BadRequestException(`AGENT node ${node.id} requires execution configuration`);
      }
      if ((node.type === "SUBFLOW" || node.type === "SUBWORKFLOW") &&
        typeof config.workflowVersionId !== "string") {
        throw new BadRequestException(`SUBWORKFLOW node ${node.id} requires workflowVersionId`);
      }
      if (node.type === "DELAY") {
        const delayMs = config.delayMs;
        if (!Number.isInteger(delayMs) || Number(delayMs) < 0 || Number(delayMs) > 3_600_000) {
          throw new BadRequestException(`DELAY node ${node.id} has invalid delayMs`);
        }
      }
      if (config.timeoutMs !== undefined && (!Number.isInteger(config.timeoutMs) ||
        Number(config.timeoutMs) < 1 || Number(config.timeoutMs) > 3_600_000)) {
        throw new BadRequestException(`Workflow node ${node.id} has invalid timeoutMs`);
      }
      this.retry(config.retry, node.id);
    }
    this.assertAcyclic(snapshot);
  }

  validateInput(snapshot: WorkflowRuntimeSnapshot, input: Record<string, unknown>) {
    for (const definition of snapshot.inputs) {
      const value = input[definition.name];
      if (value === undefined && definition.required) {
        throw new BadRequestException(`Required workflow input ${definition.name} is missing`);
      }
      if (value !== undefined) this.assertType(value, definition.schema, `input.${definition.name}`);
    }
  }

  initialContext(snapshot: WorkflowRuntimeSnapshot, input: Record<string, unknown>, metadata: Record<string, unknown>) {
    const globals: Record<string, unknown> = {};
    for (const variable of snapshot.variables) {
      const value = input[variable.name] ?? variable.defaultValue;
      if (value === undefined && variable.required) {
        throw new BadRequestException(`Required workflow variable ${variable.name} is missing`);
      }
      if (value !== undefined) {
        this.assertType(value, variable.schema, `variables.${variable.name}`);
        globals[variable.name] = value;
      }
    }
    return { input: { ...input }, globals, nodes: {}, output: {}, metadata: { ...metadata } };
  }

  evaluate(expression: Record<string, unknown>, context: WorkflowExecutionContext): boolean {
    const path = expression.path;
    const operator = expression.operator;
    if (typeof path !== "string" || typeof operator !== "string") {
      throw new BadRequestException("Condition expression requires path and operator");
    }
    const actual = this.path(context, path); const expected = expression.value;
    switch (operator) {
      case "equals": return actual === expected;
      case "notEquals": return actual !== expected;
      case "exists": return (actual !== undefined) === (expected !== false);
      case "in": return Array.isArray(expected) && expected.includes(actual);
      case "contains": return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
      case "greaterThan": return typeof actual === "number" && typeof expected === "number" && actual > expected;
      case "lessThan": return typeof actual === "number" && typeof expected === "number" && actual < expected;
      default: throw new BadRequestException(`Unsupported condition operator ${operator}`);
    }
  }

  resolve(value: unknown, context: WorkflowExecutionContext): unknown {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const source = value as Record<string, unknown>;
      if (typeof source.from === "string" && Object.keys(source).length === 1) return this.path(context, source.from);
      return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, this.resolve(item, context)]));
    }
    if (Array.isArray(value)) return value.map((item) => this.resolve(item, context));
    return value;
  }

  private assertAcyclic(snapshot: WorkflowRuntimeSnapshot) {
    const adjacency = new Map<string, string[]>();
    for (const edge of snapshot.edges) adjacency.set(edge.sourceNodeId,
      [...(adjacency.get(edge.sourceNodeId) ?? []), edge.targetNodeId]);
    for (const branch of snapshot.branches) adjacency.set(branch.nodeId,
      [...(adjacency.get(branch.nodeId) ?? []), branch.targetNodeId]);
    const state = new Map<string, number>();
    const visit = (id: string) => { state.set(id, 1); for (const target of adjacency.get(id) ?? []) {
      if (state.get(target) === 1) throw new BadRequestException("Executable workflow graph must be acyclic");
      if (!state.has(target)) visit(target);
    } state.set(id, 2); };
    snapshot.nodes.forEach((node) => { if (!state.has(node.id)) visit(node.id); });
  }

  private retry(value: unknown, nodeId: string) {
    if (value === undefined) return;
    const retry = this.record(value);
    if (!retry) throw new BadRequestException(`Workflow node ${nodeId} has an invalid retry policy`);
    const maxAttempts = retry.maxAttempts ?? 1;
    const delayMs = retry.delayMs ?? 0; const multiplier = retry.backoffMultiplier ?? 1;
    if (!Number.isInteger(maxAttempts) || Number(maxAttempts) < 1 || Number(maxAttempts) > 10 ||
      !Number.isInteger(delayMs) || Number(delayMs) < 0 || Number(delayMs) > 300_000 ||
      typeof multiplier !== "number" || multiplier < 1 || multiplier > 10) {
      throw new BadRequestException(`Workflow node ${nodeId} has an invalid retry policy`);
    }
  }

  private assertType(value: unknown, schema: Record<string, unknown>, path: string) {
    const type = schema.type;
    if (type === undefined) return;
    const valid = type === "null" ? value === null : type === "array" ? Array.isArray(value) :
      type === "object" ? this.record(value) !== undefined && !Array.isArray(value) && value !== null :
      type === "integer" ? Number.isInteger(value) : type === "number" ? typeof value === "number" && Number.isFinite(value) :
      type === "string" ? typeof value === "string" : type === "boolean" ? typeof value === "boolean" : false;
    if (!valid) throw new BadRequestException(`Workflow value ${path} does not match type ${JSON.stringify(type)}`);
  }
  private path(value: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((current, key) => this.record(current)?.[key], value);
  }
  private record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  }
}
