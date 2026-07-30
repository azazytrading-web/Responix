import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { CompilerVariableType } from "../prompt-compiler/dto/prompt-compiler.dto";
import type { RenderPromptExecutionDto } from "./dto/prompt-execution.dto";

type JsonRecord = Record<string, unknown>;
export type PromptExecutionDiagnostic = {
  severity: "ERROR" | "WARNING"; code: string; path: string; message: string;
};
export type PromptExecutionSource = {
  id: string; workspaceId: string; hash: string; checksum: string;
  compilerVersion: string; compiledPackage: unknown; resolvedPrompt: unknown;
  variableMap: unknown; variableMetadata: unknown; placeholders: string[];
};
export type PromptExecutionResult = {
  valid: boolean; diagnostics: PromptExecutionDiagnostic[];
  messages: Array<{ role: "system" | "user" | "assistant"; content: string; metadata?: JsonRecord }>;
  resolvedVariables: JsonRecord; payload: JsonRecord; promptHash: string;
  payloadHash: string; checksum: string;
};

@Injectable()
export class PromptExecutionEngine {
  static readonly VERSION = "1.0.0";
  private readonly reserved = ["$", "__", "compiler.", "prompt.", "system.", "runtime."];

  render(source: PromptExecutionSource, dto: RenderPromptExecutionDto): PromptExecutionResult {
    const diagnostics: PromptExecutionDiagnostic[] = [];
    this.verifySource(source, diagnostics);
    const packageValue = this.record(source.compiledPackage);
    const prompt = this.record(source.resolvedPrompt);
    const defaults = this.record(source.variableMap);
    const metadata = this.metadata(source.variableMetadata);
    const resolvedVariables: JsonRecord = { ...defaults };
    const supplied = new Set<string>();
    for (const [index, variable] of (dto.variables ?? []).entries()) {
      if (supplied.has(variable.name)) {
        diagnostics.push(this.error("DUPLICATE_VARIABLE", `variables.${index}`,
          `Runtime variable ${variable.name} is duplicated`));
        continue;
      }
      supplied.add(variable.name);
      if (this.reserved.some((prefix) => variable.name.startsWith(prefix))) {
        diagnostics.push(this.error("RESERVED_VARIABLE", `variables.${index}.name`,
          `Runtime variable ${variable.name} uses a reserved namespace`));
      }
      const definition = metadata.get(variable.name);
      if (!definition && !source.placeholders.includes(variable.name)) {
        diagnostics.push(this.error("UNKNOWN_VARIABLE", `variables.${index}.name`,
          `Runtime variable ${variable.name} is not declared by the compiled package`));
      }
      const expected = definition?.type ?? variable.type;
      if (expected !== variable.type || !this.matches(variable.value, expected)) {
        diagnostics.push(this.error("VARIABLE_TYPE_MISMATCH", `variables.${index}.value`,
          `Runtime variable ${variable.name} is incompatible with ${expected}`));
      } else {
        resolvedVariables[variable.name] = variable.value;
      }
    }
    for (const [name, definition] of metadata) {
      const value = this.path(resolvedVariables, name);
      if (definition.required && this.empty(value)) {
        diagnostics.push(this.error("REQUIRED_VARIABLE_MISSING", `variables.${name}`,
          `Required runtime variable ${name} is missing or empty`));
      }
      if (value !== undefined && !this.matches(value, definition.type)) {
        diagnostics.push(this.error("VARIABLE_TYPE_MISMATCH", `variables.${name}`,
          `Resolved variable ${name} is incompatible with ${definition.type}`));
      }
    }
    for (const placeholder of source.placeholders) {
      if (this.path(resolvedVariables, placeholder) === undefined) {
        diagnostics.push(this.error("PLACEHOLDER_UNRESOLVED", `placeholders.${placeholder}`,
          `Placeholder {{${placeholder}}} has no runtime value`));
      }
    }
    const conditions = Array.isArray(packageValue.conditions)
      ? packageValue.conditions.filter((item): item is JsonRecord => this.isRecord(item)) : [];
    const excluded = new Set<string>();
    for (const [index, condition] of conditions.entries()) {
      const variable = typeof condition.variable === "string" ? condition.variable : "";
      const passed = this.condition(this.path(resolvedVariables, variable), condition);
      if (!passed && typeof condition.target === "string") excluded.add(condition.target.toUpperCase());
      if (!variable) diagnostics.push(this.error(
        "CONDITION_INVALID", `conditions.${index}`, "Condition variable is invalid"
      ));
    }
    const ordered = Array.isArray(prompt.orderedMessages)
      ? prompt.orderedMessages.filter((item): item is JsonRecord => this.isRecord(item)) : [];
    const rendered = ordered
      .filter((message) => typeof message.role === "string" &&
        !excluded.has(message.role.toUpperCase()))
      .map((message, index) => this.message(message, index, resolvedVariables, diagnostics));
    const lastUser = rendered.findIndex(({ role }) => role === "user");
    const insertion = lastUser < 0 ? rendered.length : lastUser;
    const context = (dto.conversationMessages ?? []).map((message) => ({
      role: message.role, content: this.renderValue(message.content, resolvedVariables),
      ...(message.metadata ? { metadata: message.metadata } : {})
    }));
    const history = (dto.assistantHistory ?? []).map((message) => ({
      role: "assistant" as const, content: this.renderValue(message.content, resolvedVariables),
      ...(message.metadata ? { metadata: message.metadata } : {})
    }));
    const messages = [
      ...rendered.slice(0, insertion), ...context, ...history, ...rendered.slice(insertion)
    ].filter(({ content }) => content.trim().length > 0);
    if (!messages.some(({ role }) => role === "user")) {
      diagnostics.push(this.error("USER_MESSAGE_MISSING", "messages",
        "Rendered prompt requires at least one user message"));
    }
    const payloadCore = {
      rendererVersion: PromptExecutionEngine.VERSION,
      compiledPrompt: {
        id: source.id, hash: source.hash, checksum: source.checksum,
        compilerVersion: source.compilerVersion
      },
      messages, resolvedVariables,
      contextMetadata: {
        ...(this.record(packageValue.conversation)),
        ...(dto.runtimeMetadata ?? {})
      },
      references: {
        agentRuntimeSnapshotId: dto.agentRuntimeSnapshotId ?? null,
        conversationRuntimeSnapshotId: dto.conversationRuntimeSnapshotId ?? null,
        providerRuntimeSnapshotId: dto.providerRuntimeSnapshotId ?? null,
        executionPipelineSnapshotId: dto.executionPipelineSnapshotId ?? null,
        executionRequestId: dto.executionRequestId ?? null,
        executionRunId: dto.executionRunId ?? null
      }
    };
    const payloadHash = this.hash(payloadCore);
    const checksum = this.hash({ payloadHash, promptHash: source.hash });
    return {
      valid: !diagnostics.some(({ severity }) => severity === "ERROR"),
      diagnostics: this.unique(diagnostics), messages, resolvedVariables,
      payload: { ...payloadCore, payloadHash, checksum },
      promptHash: source.hash, payloadHash, checksum
    };
  }

  private verifySource(source: PromptExecutionSource, diagnostics: PromptExecutionDiagnostic[]) {
    const packageValue = this.record(source.compiledPackage);
    const core = { ...packageValue };
    delete core.hash; delete core.checksum; delete core.compiledAt;
    if (packageValue.hash !== source.hash || this.hash(core) !== source.hash) {
      diagnostics.push(this.error("PROMPT_HASH_INVALID", "compiledPrompt.hash",
        "Compiled prompt package hash verification failed"));
    }
    if (packageValue.checksum !== source.checksum) {
      diagnostics.push(this.error("PROMPT_CHECKSUM_INVALID", "compiledPrompt.checksum",
        "Compiled prompt package checksum verification failed"));
    }
    if (source.compilerVersion.split(".")[0] !== PromptExecutionEngine.VERSION.split(".")[0]) {
      diagnostics.push(this.error("COMPILER_VERSION_INCOMPATIBLE", "compilerVersion",
        "Compiled prompt major version is incompatible with the renderer"));
    }
  }
  private message(
    value: JsonRecord, index: number, variables: JsonRecord,
    diagnostics: PromptExecutionDiagnostic[]
  ): { role: "system" | "user" | "assistant"; content: string } {
    const roleValue = typeof value.role === "string" ? value.role.toLowerCase() : "";
    const role: "system" | "user" | "assistant" = roleValue === "assistant" ? "assistant" :
      roleValue === "user" ? "user" : "system";
    if (!["system", "developer", "user", "assistant"].includes(roleValue)) {
      diagnostics.push(this.error("MESSAGE_ROLE_INVALID", `messages.${index}.role`,
        "Compiled prompt message role is invalid"));
    }
    const content = typeof value.content === "string"
      ? this.renderValue(value.content, variables) : "";
    return { role, content };
  }
  private metadata(value: unknown) {
    const result = new Map<string, { type: CompilerVariableType; required: boolean }>();
    if (!Array.isArray(value)) return result;
    for (const item of value) {
      if (!this.isRecord(item) || typeof item.name !== "string") continue;
      if (Object.values(CompilerVariableType).includes(item.type as CompilerVariableType)) {
        result.set(item.name, {
          type: item.type as CompilerVariableType, required: item.required === true
        });
      }
    }
    return result;
  }
  private condition(value: unknown, condition: JsonRecord) {
    if (condition.operator === "EXISTS") return value !== undefined && value !== null;
    if (condition.operator === "EQUALS") return this.stable(value) === this.stable(condition.value);
    if (condition.operator === "NOT_EQUALS") return this.stable(value) !== this.stable(condition.value);
    return false;
  }
  private renderValue(template: string, variables: JsonRecord) {
    return template.replace(/\\?\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*\}\}/g,
      (match: string, path: string) => {
        if (match.startsWith("\\")) return match.slice(1);
        const value = this.path(variables, path);
        if (value === undefined) return match;
        if (value === null) return "null";
        if (typeof value === "object") return JSON.stringify(value);
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") {
          return value.toString();
        }
        return match;
      });
  }
  private path(values: JsonRecord, path: string): unknown {
    if (Object.prototype.hasOwnProperty.call(values, path)) return values[path];
    let current: unknown = values;
    for (const part of path.split(".")) {
      if (!this.isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
  private matches(value: unknown, type: CompilerVariableType) {
    if (type === CompilerVariableType.NULL) return value === null;
    if (type === CompilerVariableType.STRING) return typeof value === "string";
    if (type === CompilerVariableType.NUMBER) return typeof value === "number" && Number.isFinite(value);
    if (type === CompilerVariableType.BOOLEAN) return typeof value === "boolean";
    if (type === CompilerVariableType.ARRAY) return Array.isArray(value);
    if (type === CompilerVariableType.OBJECT) return this.isRecord(value);
    return true;
  }
  private empty(value: unknown) {
    return value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);
  }
  private unique(items: PromptExecutionDiagnostic[]) {
    return [...new Map(items.map((item) =>
      [`${item.severity}:${item.code}:${item.path}:${item.message}`, item])).values()];
  }
  private error(code: string, path: string, message: string): PromptExecutionDiagnostic {
    return { severity: "ERROR", code, path, message };
  }
  private record(value: unknown): JsonRecord { return this.isRecord(value) ? value : {}; }
  private isRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  private hash(value: unknown) {
    return createHash("sha256").update(this.stable(value)).digest("hex");
  }
  private stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stable(item)).join(",")}]`;
    if (this.isRecord(value)) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stable(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
  }
}
