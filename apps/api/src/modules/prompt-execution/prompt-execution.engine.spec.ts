import { createHash } from "node:crypto";
import { CompilerVariableType } from "../prompt-compiler/dto/prompt-compiler.dto";
import type { RenderPromptExecutionDto } from "./dto/prompt-execution.dto";
import {
  PromptExecutionEngine, type PromptExecutionSource
} from "./prompt-execution.engine";

type RecordValue = Record<string, unknown>;
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as RecordValue).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const source = (overrides: Partial<PromptExecutionSource> = {}): PromptExecutionSource => {
  const resolvedPrompt = {
    orderedMessages: [
      { sequence: 0, role: "SYSTEM", content: "You assist {{customer.name}}" },
      { sequence: 1, role: "DEVELOPER", content: "Locale {{locale}}" },
      { sequence: 2, role: "USER", content: "Question for {{customer.name}}" }
    ]
  };
  const core = {
    resolvedPrompt,
    variableMap: { customer: { name: "Default" }, locale: "en" },
    variableMetadata: [
      { name: "customer", type: "OBJECT", required: true },
      { name: "locale", type: "STRING", required: true }
    ],
    placeholders: ["customer.name", "locale"],
    conditions: [],
    compilerVersion: "1.0.0",
    conversation: { id: "conversation" }
  };
  const packageHash = hash(core);
  return {
    id: "compiled", workspaceId: "workspace", hash: packageHash, checksum: "checksum",
    compilerVersion: "1.0.0",
    compiledPackage: { ...core, hash: packageHash, checksum: "checksum", compiledAt: "now" },
    resolvedPrompt, variableMap: core.variableMap,
    variableMetadata: core.variableMetadata, placeholders: core.placeholders,
    ...overrides
  };
};
const dto = (overrides: Partial<RenderPromptExecutionDto> = {}): RenderPromptExecutionDto => ({
  compiledPromptId: "11111111-1111-4111-8111-111111111111", ...overrides
});

describe("PromptExecutionEngine", () => {
  const engine = new PromptExecutionEngine();
  it("renders an immutable ordered provider-ready message payload", () => {
    const result = engine.render(source(), dto());
    expect(result.valid).toBe(true);
    expect(result.messages).toEqual([
      { role: "system", content: "You assist Default" },
      { role: "system", content: "Locale en" },
      { role: "user", content: "Question for Default" }
    ]);
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
  it("applies runtime overrides with nested placeholder replacement", () => {
    const result = engine.render(source(), dto({ variables: [{
      name: "customer", type: CompilerVariableType.OBJECT, value: { name: "Ada" }
    }] }));
    expect(result.messages[0]?.content).toBe("You assist Ada");
  });
  it.each([
    [CompilerVariableType.STRING, 1], [CompilerVariableType.NUMBER, "1"],
    [CompilerVariableType.BOOLEAN, "true"], [CompilerVariableType.ARRAY, {}],
    [CompilerVariableType.OBJECT, []], [CompilerVariableType.NULL, false]
  ])("rejects incompatible runtime %s variables", (type, value) => {
    const result = engine.render(source({
      variableMetadata: [{ name: "value", type, required: true }],
      variableMap: { value }
    }), dto({ variables: [{ name: "value", type, value }] }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VARIABLE_TYPE_MISMATCH" })
    ]));
  });
  it("rejects duplicate runtime variables", () => {
    const variable = {
      name: "locale", type: CompilerVariableType.STRING, value: "en"
    };
    expect(engine.render(source(), dto({ variables: [variable, variable] })).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "DUPLICATE_VARIABLE" })]));
  });
  it.each(["$value", "__value", "compiler.value", "prompt.value", "system.value", "runtime.value"])(
    "rejects reserved runtime variable %s", (name) => {
      const result = engine.render(source(), dto({ variables: [{
        name, type: CompilerVariableType.STRING, value: "x"
      }] }));
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "RESERVED_VARIABLE" })
      ]));
    }
  );
  it("rejects unknown variables", () => {
    const result = engine.render(source(), dto({ variables: [{
      name: "unknown", type: CompilerVariableType.STRING, value: "x"
    }] }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNKNOWN_VARIABLE" })
    ]));
  });
  it("enforces required variables after defaults and overrides", () => {
    const result = engine.render(source({
      variableMap: { locale: "en" }
    }), dto());
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "REQUIRED_VARIABLE_MISSING" })
    ]));
  });
  it("detects unresolved placeholders", () => {
    const result = engine.render(source({
      placeholders: ["missing"],
      variableMetadata: [], variableMap: {}
    }), dto());
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PLACEHOLDER_UNRESOLVED" })
    ]));
  });
  it("evaluates conditional section exclusion", () => {
    const current = source();
    const packageValue = current.compiledPackage as RecordValue;
    const core: RecordValue = { ...packageValue, conditions: [{
      variable: "locale", operator: "EQUALS", value: "fr", target: "SYSTEM"
    }] };
    delete core.hash; delete core.checksum; delete core.compiledAt;
    const packageHash = hash(core);
    const result = engine.render({
      ...current, hash: packageHash,
      compiledPackage: { ...core, hash: packageHash, checksum: "checksum", compiledAt: "now" }
    }, dto());
    expect(result.messages.some(({ content }) => content === "You assist Default")).toBe(false);
  });
  it("injects conversation context and assistant history before the final user prompt", () => {
    const result = engine.render(source(), dto({
      conversationMessages: [{ role: "user", content: "Earlier question" }],
      assistantHistory: [{ content: "Earlier answer" }]
    }));
    expect(result.messages.map(({ content }) => content)).toEqual([
      "You assist Default", "Locale en", "Earlier question", "Earlier answer",
      "Question for Default"
    ]);
  });
  it("verifies prompt hashes and checksums", () => {
    const result = engine.render(source({ hash: "tampered", checksum: "other" }), dto());
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "PROMPT_HASH_INVALID", "PROMPT_CHECKSUM_INVALID"
    ]));
  });
  it("rejects incompatible compiler major versions", () => {
    expect(engine.render(source({ compilerVersion: "2.0.0" }), dto()).diagnostics)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "COMPILER_VERSION_INCOMPATIBLE" })
      ]));
  });
  it("requires a user message in the final payload", () => {
    const prompt = { orderedMessages: [{ role: "SYSTEM", content: "Only system" }] };
    const current = source({ resolvedPrompt: prompt });
    expect(engine.render(current, dto()).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "USER_MESSAGE_MISSING" })
    ]));
  });
  it("keeps escaped placeholders literal", () => {
    const current = source();
    const prompt = {
      orderedMessages: [{ role: "USER", content: "\\{{locale}} and {{locale}}" }]
    };
    const result = engine.render({ ...current, resolvedPrompt: prompt }, dto());
    expect(result.messages[0]?.content).toBe("{{locale}} and en");
  });
});
