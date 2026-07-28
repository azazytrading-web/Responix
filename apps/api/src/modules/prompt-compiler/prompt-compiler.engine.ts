import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  CompilerVariableSource,
  CompilerVariableType,
  type CompilerVariableDto,
  type PromptConditionDto
} from "./dto/prompt-compiler.dto";

type JsonRecord = Record<string, unknown>;

export type CompilerDiagnostic = {
  severity: "ERROR" | "WARNING";
  code: string;
  path: string;
  message: string;
};

export type PromptVariableDefinition = {
  name: string;
  type: CompilerVariableType;
  required: boolean;
  defaultValue?: unknown;
  metadata: JsonRecord;
};

export type PromptCompilerInput = {
  promptId: string;
  promptVersionId: string;
  promptRevision: number;
  agentVersionId: string | null;
  agentRevision: number | null;
  workspaceId: string;
  sections: {
    systemPrompt?: string;
    developerPrompt?: string;
    userPrompt?: string;
  };
  assistantHistory: Array<{ content: string; metadata?: JsonRecord }>;
  metadataBlocks: Array<{ type: string; content: unknown; metadata?: JsonRecord }>;
  conditions: PromptConditionDto[];
  variables: CompilerVariableDto[];
  contextVariables: CompilerVariableDto[];
  definitions: PromptVariableDefinition[];
  promptMetadata: JsonRecord;
  workspaceMetadata: JsonRecord;
  conversationMetadata: JsonRecord;
  runtimeMetadata: JsonRecord;
  executionMetadata: JsonRecord;
  environmentMetadata: JsonRecord;
  execution: JsonRecord;
  conversation: JsonRecord;
  sourceChecksum: string;
  maxPromptSizeBytes: number;
  sourceDiagnostics?: CompilerDiagnostic[];
};

export type PromptCompilerResult = {
  valid: boolean;
  diagnostics: CompilerDiagnostic[];
  package: JsonRecord;
  resolvedPrompt: JsonRecord;
  variableMap: JsonRecord;
  variableMetadata: JsonRecord[];
  dependencyMap: Record<string, string[]>;
  placeholders: string[];
  hash: string;
  checksum: string;
  sizeBytes: number;
  compilerVersion: string;
  compiledAt: string;
};

@Injectable()
export class PromptCompilerEngine {
  static readonly VERSION = "1.0.0";
  private readonly reservedPrefixes = ["$", "__", "compiler.", "prompt."];

  compile(input: PromptCompilerInput): PromptCompilerResult {
    const diagnostics = [...(input.sourceDiagnostics ?? [])];
    const templates = this.templateValues(input);
    const placeholders = [...new Set(
      templates.flatMap((value) => this.discoverInValue(value))
    )].sort();
    const expected = new Set([
      ...placeholders,
      ...input.conditions.map(({ variable }) => variable),
      ...input.definitions.map(({ name }) => name)
    ]);
    const variables = this.prepareVariables(input, expected, diagnostics);
    const dependencyMap = this.dependencies(variables, diagnostics);
    const resolvedValues = this.resolveVariables(variables, dependencyMap, diagnostics);

    for (const placeholder of placeholders) {
      if (!this.hasPath(resolvedValues, placeholder)) {
        diagnostics.push(this.error(
          "MISSING_PLACEHOLDER",
          `placeholders.${placeholder}`,
          `No resolved variable is available for {{${placeholder}}}`
        ));
      }
    }
    for (const condition of input.conditions) {
      if (!this.hasPath(resolvedValues, condition.variable)) {
        diagnostics.push(this.error(
          "CONDITION_VARIABLE_MISSING",
          `conditions.${condition.variable}`,
          "Condition metadata references an unresolved variable"
        ));
      }
      if (condition.operator !== "EXISTS" && condition.value === undefined) {
        diagnostics.push(this.error(
          "CONDITION_VALUE_MISSING",
          `conditions.${condition.variable}`,
          `${condition.operator} condition requires a comparison value`
        ));
      }
    }

    const render = (value: unknown) =>
      this.compileValue(value, (path) => this.pathValue(resolvedValues, path));
    const systemPrompt = input.sections.systemPrompt === undefined
      ? undefined
      : render(input.sections.systemPrompt) as string;
    const developerPrompt = input.sections.developerPrompt === undefined
      ? undefined
      : render(input.sections.developerPrompt) as string;
    const userPrompt = input.sections.userPrompt === undefined
      ? undefined
      : render(input.sections.userPrompt) as string;
    if (!userPrompt?.trim()) {
      diagnostics.push(this.error(
        "USER_PROMPT_MISSING",
        "sections.userPrompt",
        "A non-empty user prompt section is required"
      ));
    }
    if (!systemPrompt?.trim()) {
      diagnostics.push(this.warning(
        "SYSTEM_PROMPT_MISSING",
        "sections.systemPrompt",
        "System prompt section is not configured"
      ));
    }
    if (!developerPrompt?.trim()) {
      diagnostics.push(this.warning(
        "DEVELOPER_PROMPT_MISSING",
        "sections.developerPrompt",
        "Developer prompt section is not configured"
      ));
    }

    const assistantHistory = input.assistantHistory.map((message, index) => ({
      sequence: index,
      role: "ASSISTANT",
      content: render(message.content),
      metadata: render(message.metadata ?? {})
    }));
    const orderedMessages = [
      ...(systemPrompt === undefined ? [] : [{ sequence: 0, role: "SYSTEM", content: systemPrompt }]),
      ...(developerPrompt === undefined ? [] : [{ sequence: 1, role: "DEVELOPER", content: developerPrompt }]),
      ...assistantHistory.map((message, index) => ({ ...message, sequence: index + 2 })),
      ...(userPrompt === undefined
        ? []
        : [{ sequence: assistantHistory.length + 2, role: "USER", content: userPrompt }])
    ];
    const resolvedPrompt = {
      orderedMessages,
      sections: {
        systemPrompt: systemPrompt ?? null,
        developerPrompt: developerPrompt ?? null,
        userPrompt: userPrompt ?? null,
        assistantHistory
      },
      metadataBlocks: input.metadataBlocks.map((block) => ({
        type: block.type,
        content: render(block.content),
        metadata: render(block.metadata ?? {})
      })),
      conditions: input.conditions
    };
    const sizeBytes = Buffer.byteLength(JSON.stringify(resolvedPrompt), "utf8");
    if (sizeBytes > input.maxPromptSizeBytes) {
      diagnostics.push(this.error(
        "PROMPT_SIZE_EXCEEDED",
        "resolvedPrompt",
        `Compiled prompt size ${sizeBytes} exceeds configured maximum ${input.maxPromptSizeBytes}`
      ));
    }

    const variableMetadata = [...variables.values()]
      .map((variable) => ({
        name: variable.name,
        type: variable.type,
        source: variable.source,
        required: variable.required,
        dependencies: dependencyMap[variable.name] ?? [],
        metadata: variable.metadata
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const compiledAt = new Date().toISOString();
    const packageCore = {
      resolvedPrompt,
      variableMap: resolvedValues,
      variableMetadata,
      promptMetadata: input.promptMetadata,
      promptVersion: {
        promptId: input.promptId,
        id: input.promptVersionId,
        revision: input.promptRevision
      },
      agentVersion: input.agentVersionId
        ? { id: input.agentVersionId, revision: input.agentRevision }
        : null,
      workspace: {
        id: input.workspaceId,
        metadata: input.workspaceMetadata
      },
      execution: {
        ...input.execution,
        metadata: input.executionMetadata
      },
      conversation: {
        ...input.conversation,
        metadata: input.conversationMetadata
      },
      runtimeMetadata: input.runtimeMetadata,
      environmentMetadata: input.environmentMetadata,
      dependencyMap,
      placeholders,
      conditions: input.conditions,
      compilerVersion: PromptCompilerEngine.VERSION
    };
    const hash = this.hash(packageCore);
    const compiledPackage = {
      ...packageCore,
      hash,
      checksum: input.sourceChecksum,
      compiledAt
    };
    return {
      valid: !diagnostics.some(({ severity }) => severity === "ERROR"),
      diagnostics: this.uniqueDiagnostics(diagnostics),
      package: compiledPackage,
      resolvedPrompt,
      variableMap: resolvedValues,
      variableMetadata,
      dependencyMap,
      placeholders,
      hash,
      checksum: input.sourceChecksum,
      sizeBytes,
      compilerVersion: PromptCompilerEngine.VERSION,
      compiledAt
    };
  }

  definition(value: unknown): PromptVariableDefinition | null {
    if (!this.isRecord(value) || typeof value.name !== "string") return null;
    const type = this.variableType(value.type);
    return {
      name: value.name,
      type,
      required: value.required === true,
      ...(Object.prototype.hasOwnProperty.call(value, "defaultValue")
        ? { defaultValue: value.defaultValue }
        : Object.prototype.hasOwnProperty.call(value, "default")
          ? { defaultValue: value.default }
          : {}),
      metadata: this.isRecord(value.metadata) ? value.metadata : {}
    };
  }

  discover(template: string): string[] {
    const found: string[] = [];
    const pattern = /\\?\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*\}\}/g;
    for (const match of template.matchAll(pattern)) {
      if (!match[0].startsWith("\\")) found.push(match[1]!);
    }
    return [...new Set(found)].sort();
  }

  private prepareVariables(
    input: PromptCompilerInput,
    expected: Set<string>,
    diagnostics: CompilerDiagnostic[]
  ) {
    const values = new Map<string, {
      name: string;
      type: CompilerVariableType;
      source: CompilerVariableSource;
      value: unknown;
      required: boolean;
      metadata: JsonRecord;
    }>();
    const definitions = new Map<string, PromptVariableDefinition>();
    for (const definition of input.definitions) {
      if (definitions.has(definition.name)) {
        diagnostics.push(this.error(
          "DUPLICATE_VARIABLE_DEFINITION",
          `variables.${definition.name}`,
          "Prompt variable definitions must be unique"
        ));
      } else {
        definitions.set(definition.name, definition);
      }
    }

    const explicitNames = new Set<string>();
    for (const variable of input.variables) {
      if (explicitNames.has(variable.name)) {
        diagnostics.push(this.error(
          "DUPLICATE_VARIABLE",
          `variables.${variable.name}`,
          "Variable names must be unique across compiler inputs"
        ));
      }
      explicitNames.add(variable.name);
      if (this.reservedPrefixes.some((prefix) => variable.name.startsWith(prefix))) {
        diagnostics.push(this.error(
          "RESERVED_VARIABLE",
          `variables.${variable.name}`,
          "Variable name is reserved by the compiler"
        ));
      }
      if (!this.expectedVariable(variable.name, expected)) {
        diagnostics.push(this.error(
          "UNKNOWN_VARIABLE",
          `variables.${variable.name}`,
          "Variable is not declared by prompt metadata or placeholders"
        ));
      }
      const definition = definitions.get(variable.name);
      this.addVariable(values, {
        ...variable,
        required: definition?.required ?? false,
        metadata: definition?.metadata ?? {}
      }, diagnostics);
    }

    for (const variable of input.contextVariables) {
      if (this.expectedVariable(variable.name, expected)) {
        const definition = definitions.get(variable.name);
        this.addVariable(values, {
          ...variable,
          required: definition?.required ?? false,
          metadata: definition?.metadata ?? {}
        }, diagnostics);
      }
    }
    for (const definition of definitions.values()) {
      const existing = values.get(definition.name);
      if (!existing && definition.defaultValue !== undefined) {
        this.addVariable(values, {
          name: definition.name,
          type: definition.type,
          source: CompilerVariableSource.PROMPT_DEFAULT,
          value: definition.defaultValue,
          required: definition.required,
          metadata: definition.metadata
        }, diagnostics);
      } else if (!existing && definition.required) {
        diagnostics.push(this.error(
          "REQUIRED_VARIABLE_MISSING",
          `variables.${definition.name}`,
          "Required prompt variable is missing"
        ));
      }
    }
    for (const variable of values.values()) {
      if (!this.matchesType(variable.value, variable.type)) {
        diagnostics.push(this.error(
          "VARIABLE_TYPE_MISMATCH",
          `variables.${variable.name}`,
          `Value is incompatible with declared type ${variable.type}`
        ));
      }
      if (variable.required && this.empty(variable.value)) {
        diagnostics.push(this.error(
          "REQUIRED_VARIABLE_EMPTY",
          `variables.${variable.name}`,
          "Required variable cannot be empty"
        ));
      }
    }
    return values;
  }

  private addVariable(
    values: Map<string, {
      name: string;
      type: CompilerVariableType;
      source: CompilerVariableSource;
      value: unknown;
      required: boolean;
      metadata: JsonRecord;
    }>,
    variable: {
      name: string;
      type: CompilerVariableType;
      source: CompilerVariableSource;
      value: unknown;
      required: boolean;
      metadata: JsonRecord;
    },
    diagnostics: CompilerDiagnostic[]
  ) {
    if (values.has(variable.name)) {
      diagnostics.push(this.error(
        "DUPLICATE_VARIABLE",
        `variables.${variable.name}`,
        "Variable is provided by more than one source"
      ));
      return;
    }
    values.set(variable.name, variable);
  }

  private dependencies(
    variables: Map<string, { value: unknown }>,
    diagnostics: CompilerDiagnostic[]
  ): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const [name, variable] of variables) {
      map[name] = typeof variable.value === "string"
        ? this.discover(variable.value).filter((dependency) =>
            variables.has(dependency) || variables.has(dependency.split(".")[0]!))
        : [];
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (name: string, path: string[]) => {
      if (visiting.has(name)) {
        diagnostics.push(this.error(
          "CIRCULAR_VARIABLE_REFERENCE",
          `variables.${name}`,
          `Circular variable dependency detected: ${[...path, name].join(" -> ")}`
        ));
        return;
      }
      if (visited.has(name)) return;
      visiting.add(name);
      for (const dependencyPath of map[name] ?? []) {
        const dependency = variables.has(dependencyPath)
          ? dependencyPath
          : dependencyPath.split(".")[0]!;
        visit(dependency, [...path, name]);
      }
      visiting.delete(name);
      visited.add(name);
    };
    for (const name of variables.keys()) visit(name, []);
    return map;
  }

  private resolveVariables(
    variables: Map<string, { value: unknown }>,
    dependencyMap: Record<string, string[]>,
    diagnostics: CompilerDiagnostic[]
  ): JsonRecord {
    const resolved: JsonRecord = {};
    const resolving = new Set<string>();
    const resolve = (name: string): unknown => {
      if (Object.prototype.hasOwnProperty.call(resolved, name)) return resolved[name];
      const variable = variables.get(name);
      if (!variable) return undefined;
      if (resolving.has(name)) return undefined;
      resolving.add(name);
      let value = variable.value;
      if (typeof value === "string" && (dependencyMap[name]?.length ?? 0) > 0) {
        value = this.render(value, (path) => {
          const direct = variables.has(path) ? resolve(path) : undefined;
          if (direct !== undefined) return direct;
          const [root, ...parts] = path.split(".");
          return this.nested(resolve(root!), parts);
        });
      }
      resolving.delete(name);
      resolved[name] = value;
      return value;
    };
    if (!diagnostics.some(({ code }) => code === "CIRCULAR_VARIABLE_REFERENCE")) {
      for (const name of variables.keys()) resolve(name);
    } else {
      for (const [name, variable] of variables) resolved[name] = variable.value;
    }
    return resolved;
  }

  private compileValue(
    value: unknown,
    lookup: (path: string) => unknown
  ): unknown {
    if (typeof value === "string") return this.render(value, lookup);
    if (Array.isArray(value)) return value.map((item) => this.compileValue(item, lookup));
    if (this.isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.compileValue(item, lookup)])
      );
    }
    return value;
  }

  private render(template: string, lookup: (path: string) => unknown): string {
    return template.replace(
      /\\?\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*\}\}/g,
      (match: string, path: string) => {
        if (match.startsWith("\\")) return match.slice(1);
        const value = lookup(path);
        if (value === undefined) return match;
        if (value === null) return "null";
        if (typeof value === "object") return JSON.stringify(value);
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return `${value}`;
        return match;
      }
    );
  }

  private pathValue(values: JsonRecord, path: string): unknown {
    if (Object.prototype.hasOwnProperty.call(values, path)) return values[path];
    const [root, ...parts] = path.split(".");
    return this.nested(values[root!], parts);
  }

  private nested(value: unknown, parts: string[]): unknown {
    let current = value;
    for (const part of parts) {
      if (!this.isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  private hasPath(values: JsonRecord, path: string): boolean {
    return this.pathValue(values, path) !== undefined;
  }

  private expectedVariable(name: string, expected: Set<string>): boolean {
    return expected.has(name) ||
      [...expected].some((path) => path.startsWith(`${name}.`) || name.startsWith(`${path}.`));
  }

  private templateValues(input: PromptCompilerInput): unknown[] {
    return [
      input.sections.systemPrompt,
      input.sections.developerPrompt,
      input.sections.userPrompt,
      input.assistantHistory,
      input.metadataBlocks
    ];
  }

  private discoverInValue(value: unknown): string[] {
    if (typeof value === "string") return this.discover(value);
    if (Array.isArray(value)) return value.flatMap((item) => this.discoverInValue(item));
    if (this.isRecord(value)) {
      return Object.values(value).flatMap((item) => this.discoverInValue(item));
    }
    return [];
  }

  private variableType(value: unknown): CompilerVariableType {
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    if (normalized === "INTEGER" || normalized === "FLOAT") return CompilerVariableType.NUMBER;
    if (Object.values(CompilerVariableType).includes(normalized as CompilerVariableType)) {
      return normalized as CompilerVariableType;
    }
    return CompilerVariableType.JSON;
  }

  private matchesType(value: unknown, type: CompilerVariableType): boolean {
    if (type === CompilerVariableType.NULL) return value === null;
    if (type === CompilerVariableType.STRING) return typeof value === "string";
    if (type === CompilerVariableType.NUMBER) return typeof value === "number" && Number.isFinite(value);
    if (type === CompilerVariableType.BOOLEAN) return typeof value === "boolean";
    if (type === CompilerVariableType.ARRAY) return Array.isArray(value);
    if (type === CompilerVariableType.OBJECT) return this.isRecord(value);
    return this.jsonCompatible(value);
  }

  private jsonCompatible(value: unknown): boolean {
    if (value === null || ["string", "boolean"].includes(typeof value)) return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item) => this.jsonCompatible(item));
    if (this.isRecord(value)) return Object.values(value).every((item) => this.jsonCompatible(item));
    return false;
  }

  private empty(value: unknown): boolean {
    return value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0);
  }

  private hash(value: unknown): string {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (this.isRecord(value)) {
      return `{${Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private uniqueDiagnostics(diagnostics: CompilerDiagnostic[]): CompilerDiagnostic[] {
    const seen = new Set<string>();
    return diagnostics.filter((diagnostic) => {
      const key = `${diagnostic.severity}:${diagnostic.code}:${diagnostic.path}:${diagnostic.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private error(code: string, path: string, message: string): CompilerDiagnostic {
    return { severity: "ERROR", code, path, message };
  }

  private warning(code: string, path: string, message: string): CompilerDiagnostic {
    return { severity: "WARNING", code, path, message };
  }
}
