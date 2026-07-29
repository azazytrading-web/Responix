import { Injectable } from "@nestjs/common";
import {
  CreateExecutionPipelineDto, PipelineVariableType
} from "./dto/execution-pipeline.dto";

export interface PipelineDiagnostic {
  severity: "ERROR" | "WARNING";
  code: string;
  path: string;
  message: string;
}
export interface PipelineValidationResult {
  valid: boolean;
  diagnostics: PipelineDiagnostic[];
}

@Injectable()
export class ExecutionPipelineValidator {
  normalize(input: CreateExecutionPipelineDto): CreateExecutionPipelineDto {
    return {
      ...input,
      name: input.name.trim(),
      nodes: [...input.nodes].sort((a, b) => a.ordinal - b.ordinal || a.nodeKey.localeCompare(b.nodeKey)),
      dependencies: [...(input.dependencies ?? [])].sort((a, b) =>
        a.dependencyKey.localeCompare(b.dependencyKey)),
      variables: [...(input.variables ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
      labels: [...(input.labels ?? [])].map(({ value }) => ({ value: value.trim() }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      tags: [...(input.tags ?? [])].map(({ value }) => ({ value: value.trim() }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      metadataItems: [...(input.metadataItems ?? [])].sort((a, b) => a.key.localeCompare(b.key))
    };
  }

  validate(input: CreateExecutionPipelineDto): PipelineValidationResult {
    const value = this.normalize(input);
    const diagnostics: PipelineDiagnostic[] = [];
    const duplicate = (values: string[], code: string, path: string) => {
      const seen = new Set<string>();
      for (const raw of values) {
        const item = raw.toLowerCase();
        if (seen.has(item)) this.error(diagnostics, code, path, `Duplicate value: ${raw}`);
        seen.add(item);
      }
    };
    duplicate(value.nodes.map(({ nodeKey }) => nodeKey), "DUPLICATE_NODE_ID", "nodes");
    duplicate(value.nodes.map(({ stage }) => stage), "DUPLICATE_STAGE", "nodes");
    duplicate((value.dependencies ?? []).map(({ dependencyKey }) => dependencyKey),
      "DUPLICATE_DEPENDENCY", "dependencies");
    duplicate((value.variables ?? []).map(({ name }) => name), "DUPLICATE_VARIABLE", "variables");
    duplicate((value.metadataItems ?? []).map(({ key }) => key), "DUPLICATE_METADATA", "metadataItems");
    const nodes = new Map(value.nodes.map((node) => [node.nodeKey, node]));
    for (const [index, node] of value.nodes.entries()) {
      if (Boolean(node.assetType) !== Boolean(node.assetId)) {
        this.error(diagnostics, "INCOMPLETE_ASSET_REFERENCE", `nodes.${index}`,
          "Asset type and asset id must be supplied together");
      }
    }
    for (const [index, dependency] of (value.dependencies ?? []).entries()) {
      if (!nodes.has(dependency.fromNodeKey) || !nodes.has(dependency.toNodeKey)) {
        this.error(diagnostics, "MISSING_DEPENDENCY_NODE", `dependencies.${index}`,
          "Dependency endpoints must reference pipeline nodes");
      }
      if (dependency.fromNodeKey === dependency.toNodeKey) {
        this.error(diagnostics, "SELF_DEPENDENCY", `dependencies.${index}`,
          "A pipeline node cannot depend on itself");
      }
      const from = nodes.get(dependency.fromNodeKey);
      const to = nodes.get(dependency.toNodeKey);
      if (from && to && from.ordinal >= to.ordinal) {
        this.error(diagnostics, "INVALID_ORDERING", `dependencies.${index}`,
          "Dependencies must point from an earlier stage to a later stage");
      }
    }
    if (this.hasCycle(value.nodes.map(({ nodeKey }) => nodeKey), value.dependencies ?? [])) {
      this.error(diagnostics, "CYCLIC_DEPENDENCY", "dependencies", "Pipeline graph must be acyclic");
    }
    for (const [index, variable] of (value.variables ?? []).entries()) {
      if (/^(system|runtime|workspace|tenant|execution)\./i.test(variable.name) ||
        variable.name.startsWith("_")) {
        this.error(diagnostics, "RESERVED_VARIABLE", `variables.${index}.name`,
          "Variable name uses a reserved namespace");
      }
      if (!this.compatible(variable.type, variable.value)) {
        this.error(diagnostics, "VARIABLE_TYPE_MISMATCH", `variables.${index}.value`,
          `Value is incompatible with ${variable.type}`);
      }
      if (variable.required && (variable.value === null || variable.value === "")) {
        this.error(diagnostics, "MISSING_VARIABLE", `variables.${index}.value`,
          "Required variable must not be empty");
      }
    }
    if (!value.nodes.length) this.error(diagnostics, "EMPTY_PIPELINE", "nodes", "Pipeline requires a node");
    if (!/^1\./.test(value.compatibilityVersion)) {
      this.error(diagnostics, "VERSION_INCOMPATIBLE", "compatibilityVersion",
        "Only compatibility major version 1 is supported");
    }
    return { valid: diagnostics.every(({ severity }) => severity !== "ERROR"), diagnostics };
  }

  private hasCycle(nodes: string[], dependencies: Array<{ fromNodeKey: string; toNodeKey: string }>) {
    const edges = new Map(nodes.map((node) => [node, [] as string[]]));
    dependencies.forEach(({ fromNodeKey, toNodeKey }) => edges.get(fromNodeKey)?.push(toNodeKey));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      if ((edges.get(node) ?? []).some(visit)) return true;
      visiting.delete(node); visited.add(node); return false;
    };
    return nodes.some(visit);
  }
  private compatible(type: PipelineVariableType, value: unknown) {
    if (type === PipelineVariableType.NULL) return value === null;
    if (type === PipelineVariableType.STRING) return typeof value === "string";
    if (type === PipelineVariableType.NUMBER) return typeof value === "number" && Number.isFinite(value);
    if (type === PipelineVariableType.BOOLEAN) return typeof value === "boolean";
    if (type === PipelineVariableType.ARRAY) return Array.isArray(value);
    if (type === PipelineVariableType.OBJECT) {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }
    return true;
  }
  private error(items: PipelineDiagnostic[], code: string, path: string, message: string) {
    items.push({ severity: "ERROR", code, path, message });
  }
}
