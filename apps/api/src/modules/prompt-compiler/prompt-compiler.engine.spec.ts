import {
  CompilerVariableSource,
  CompilerVariableType
} from "./dto/prompt-compiler.dto";
import {
  PromptCompilerEngine,
  type PromptCompilerInput
} from "./prompt-compiler.engine";

const input = (overrides: Partial<PromptCompilerInput> = {}): PromptCompilerInput => ({
  promptId: "prompt",
  promptVersionId: "prompt-version",
  promptRevision: 2,
  agentVersionId: "agent-version",
  agentRevision: 3,
  workspaceId: "workspace",
  sections: {
    systemPrompt: "System for {{workspace.name}}",
    developerPrompt: "Developer metadata",
    userPrompt: "Hello {{name}}"
  },
  assistantHistory: [{ content: "Earlier answer for {{name}}" }],
  metadataBlocks: [{ type: "context", content: { customer: "{{name}}" } }],
  conditions: [],
  variables: [{
    name: "name",
    type: CompilerVariableType.STRING,
    source: CompilerVariableSource.EXECUTION_RUNTIME,
    value: "Ada"
  }],
  contextVariables: [{
    name: "workspace",
    type: CompilerVariableType.OBJECT,
    source: CompilerVariableSource.WORKSPACE,
    value: { name: "Responix" }
  }],
  definitions: [{
    name: "name",
    type: CompilerVariableType.STRING,
    required: true,
    metadata: {}
  }],
  promptMetadata: { name: "Greeting" },
  workspaceMetadata: { name: "Responix" },
  conversationMetadata: {},
  runtimeMetadata: {},
  executionMetadata: {},
  environmentMetadata: {},
  execution: { requestId: "request" },
  conversation: { id: "conversation" },
  sourceChecksum: "checksum",
  maxPromptSizeBytes: 100000,
  ...overrides
});

describe("PromptCompilerEngine", () => {
  const engine = new PromptCompilerEngine();

  it("assembles ordered prompt sections and compiles nested paths", () => {
    const result = engine.compile(input());
    expect(result.valid).toBe(true);
    expect(result.resolvedPrompt).toMatchObject({
      orderedMessages: [
        { role: "SYSTEM", content: "System for Responix" },
        { role: "DEVELOPER", content: "Developer metadata" },
        { role: "ASSISTANT", content: "Earlier answer for Ada" },
        { role: "USER", content: "Hello Ada" }
      ]
    });
    expect(result.placeholders).toEqual(["name", "workspace.name"]);
    expect(result.package).toMatchObject({
      promptVersion: { id: "prompt-version", revision: 2 },
      agentVersion: { id: "agent-version", revision: 3 },
      compilerVersion: "1.0.0",
      checksum: "checksum"
    });
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("supports escaping and excludes escaped placeholders from discovery", () => {
    const result = engine.compile(input({
      sections: {
        systemPrompt: "System",
        developerPrompt: "Developer",
        userPrompt: String.raw`\{{literal}} {{name}}`
      }
    }));
    expect(result.placeholders).toEqual(["name"]);
    expect(result.resolvedPrompt).toMatchObject({
      sections: { userPrompt: "{{literal}} Ada" }
    });
  });

  it("resolves string variable dependencies and emits a dependency map", () => {
    const result = engine.compile(input({
      sections: {
        systemPrompt: "System",
        developerPrompt: "Developer",
        userPrompt: "{{greeting}}"
      },
      definitions: [
        { name: "name", type: CompilerVariableType.STRING, required: true, metadata: {} },
        { name: "greeting", type: CompilerVariableType.STRING, required: true, metadata: {} }
      ],
      variables: [
        {
          name: "name",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: "Ada"
        },
        {
          name: "greeting",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: "Hello {{name}}"
        }
      ],
      contextVariables: []
    }));
    expect(result.valid).toBe(true);
    expect(result.dependencyMap).toEqual({ greeting: ["name"], name: [] });
    expect(result.resolvedPrompt).toMatchObject({
      sections: { userPrompt: "Hello Ada" }
    });
  });

  it("supports number, boolean, JSON, array, object, and null values", () => {
    const variables = [
      { name: "count", type: CompilerVariableType.NUMBER, value: 3 },
      { name: "enabled", type: CompilerVariableType.BOOLEAN, value: true },
      { name: "json", type: CompilerVariableType.JSON, value: { ok: true } },
      { name: "items", type: CompilerVariableType.ARRAY, value: [1, 2] },
      { name: "customer", type: CompilerVariableType.OBJECT, value: { name: "Ada" } },
      { name: "nothing", type: CompilerVariableType.NULL, value: null }
    ].map((variable) => ({
      ...variable,
      source: CompilerVariableSource.EXECUTION_METADATA
    }));
    const result = engine.compile(input({
      sections: {
        systemPrompt: "System",
        developerPrompt: "Developer",
        userPrompt: "{{count}} {{enabled}} {{json}} {{items}} {{customer.name}} {{nothing}}"
      },
      variables,
      contextVariables: [],
      assistantHistory: [],
      metadataBlocks: [],
      definitions: variables.map(({ name, type }) => ({
        name, type, required: false, metadata: {}
      }))
    }));
    expect(result.valid).toBe(true);
    expect(result.resolvedPrompt).toMatchObject({
      sections: {
        userPrompt: '3 true {"ok":true} [1,2] Ada null'
      }
    });
  });

  it("returns structured required, unknown, reserved, duplicate, and type diagnostics", () => {
    const result = engine.compile(input({
      sections: {
        systemPrompt: "System",
        developerPrompt: "Developer",
        userPrompt: "{{requiredName}}"
      },
      variables: [
        {
          name: "unused",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.ENVIRONMENT,
          value: "x"
        },
        {
          name: "unused",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.ENVIRONMENT,
          value: "y"
        },
        {
          name: "compiler.secret",
          type: CompilerVariableType.NUMBER,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: "invalid"
        }
      ],
      contextVariables: [],
      definitions: [{
        name: "requiredName",
        type: CompilerVariableType.STRING,
        required: true,
        metadata: {}
      }]
    }));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "REQUIRED_VARIABLE_MISSING",
      "UNKNOWN_VARIABLE",
      "RESERVED_VARIABLE",
      "DUPLICATE_VARIABLE",
      "VARIABLE_TYPE_MISMATCH",
      "MISSING_PLACEHOLDER"
    ]));
  });

  it("rejects empty required values, invalid object types, and circular references", () => {
    const result = engine.compile(input({
      sections: {
        systemPrompt: "System",
        developerPrompt: "Developer",
        userPrompt: "{{first}} {{details}} {{requiredName}}"
      },
      variables: [
        {
          name: "first",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: "{{second}}"
        },
        {
          name: "second",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: "{{first}}"
        },
        {
          name: "details",
          type: CompilerVariableType.OBJECT,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: []
        },
        {
          name: "requiredName",
          type: CompilerVariableType.STRING,
          source: CompilerVariableSource.STATIC_DEFAULT,
          value: " "
        }
      ],
      contextVariables: [],
      definitions: [
        { name: "first", type: CompilerVariableType.STRING, required: true, metadata: {} },
        { name: "second", type: CompilerVariableType.STRING, required: true, metadata: {} },
        { name: "details", type: CompilerVariableType.OBJECT, required: true, metadata: {} },
        { name: "requiredName", type: CompilerVariableType.STRING, required: true, metadata: {} }
      ]
    }));
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "CIRCULAR_VARIABLE_REFERENCE",
      "VARIABLE_TYPE_MISMATCH",
      "REQUIRED_VARIABLE_EMPTY"
    ]));
  });

  it("preserves condition metadata without executing it and validates references", () => {
    const result = engine.compile(input({
      conditions: [
        { variable: "name", operator: "EXISTS" },
        { variable: "missing", operator: "EQUALS" }
      ]
    }));
    expect(result.resolvedPrompt).toMatchObject({
      conditions: [
        { variable: "name", operator: "EXISTS" },
        { variable: "missing", operator: "EQUALS" }
      ]
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "CONDITION_VARIABLE_MISSING",
      "CONDITION_VALUE_MISSING"
    ]));
  });

  it("validates configured maximum prompt size and creates stable content hashes", () => {
    const first = engine.compile(input({ maxPromptSizeBytes: 10 }));
    const second = engine.compile(input({ maxPromptSizeBytes: 10 }));
    expect(first.diagnostics.map(({ code }) => code)).toContain("PROMPT_SIZE_EXCEEDED");
    expect(first.hash).toBe(second.hash);
  });
});
