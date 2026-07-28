import type { PrepareRetrievalRuntimeDto } from "./dto/retrieval-runtime.dto";
import {
  RetrievalFilterOperator,
  RetrievalVariableType
} from "./dto/retrieval-runtime.dto";
import { RetrievalRuntimeValidator } from "./retrieval-runtime.validator";

const base = (overrides: Partial<PrepareRetrievalRuntimeDto> = {}): PrepareRetrievalRuntimeDto => ({
  name: "Support Knowledge",
  knowledgeBaseId: "space",
  language: "en-US",
  allowedMimeTypes: ["text/plain", "application/pdf"],
  sources: [{ documentId: "document", versionId: "version" }],
  collections: [{ collectionId: "collection" }],
  filters: [{
    key: "document.language",
    operator: RetrievalFilterOperator.EQUALS,
    value: "en-US"
  }],
  variables: [{
    name: "tenant.plan",
    type: RetrievalVariableType.STRING,
    value: "enterprise"
  }],
  ...overrides
});

describe("RetrievalRuntimeValidator", () => {
  const validator = new RetrievalRuntimeValidator();

  it("accepts complete metadata-only retrieval preparation", () => {
    expect(validator.validate(base())).toMatchObject({ valid: true, diagnostics: [] });
  });

  it.each([
    [{ collections: [{ collectionId: "same" }, { collectionId: "same" }] }, "DUPLICATE_COLLECTION"],
    [{ sources: [
      { documentId: "same", versionId: "one" },
      { documentId: "same", versionId: "two" }
    ] }, "DUPLICATE_SOURCE"],
    [{ sources: [
      { documentId: "one", versionId: "same" },
      { documentId: "two", versionId: "same" }
    ] }, "DUPLICATE_SOURCE_VERSION"],
    [{ variables: [
      { name: "same", type: RetrievalVariableType.STRING, value: "a" },
      { name: "same", type: RetrievalVariableType.STRING, value: "b" }
    ] }, "DUPLICATE_VARIABLE"],
    [{ filters: [
      { key: "document.language", operator: RetrievalFilterOperator.EQUALS, value: "en" },
      { key: "document.language", operator: RetrievalFilterOperator.EQUALS, value: "fr" }
    ] }, "DUPLICATE_FILTER"],
    [{ allowedMimeTypes: ["text/plain", "TEXT/PLAIN"] }, "DUPLICATE_MIME_TYPE"]
  ])("rejects duplicate metadata %#", (overrides, code) => {
    const result = validator.validate(base(overrides));
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it("requires a source or collection scope", () => {
    const result = validator.validate(base({ sources: [], collections: [] }));
    expect(result.diagnostics[0]).toMatchObject({ code: "MISSING_RETRIEVAL_SCOPE" });
  });

  it.each([
    ["bad", RetrievalFilterOperator.EQUALS, "x", "INVALID_FILTER_KEY"],
    ["document.language", RetrievalFilterOperator.IN, "x", "INVALID_FILTER_VALUE"],
    ["document.language", RetrievalFilterOperator.NOT_IN, [], "INVALID_FILTER_VALUE"],
    ["document.language", RetrievalFilterOperator.EXISTS, "yes", "INVALID_FILTER_VALUE"]
  ])("validates filter metadata", (key, operator, value, code) => {
    const result = validator.validate(base({ filters: [{ key, operator, value }] }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it.each([
    [RetrievalVariableType.STRING, 1],
    [RetrievalVariableType.NUMBER, "1"],
    [RetrievalVariableType.BOOLEAN, "true"],
    [RetrievalVariableType.ARRAY, {}],
    [RetrievalVariableType.OBJECT, []],
    [RetrievalVariableType.NULL, false]
  ])("rejects incompatible %s variables", (type, value) => {
    const result = validator.validate(base({
      variables: [{ name: "value", type, value }]
    }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VARIABLE_TYPE_MISMATCH" })
    ]));
  });

  it("preserves repository workspace and hierarchy diagnostics", () => {
    const result = validator.validate(base(), [{
      severity: "ERROR",
      code: "INVALID_HIERARCHY",
      path: "sources",
      message: "Hierarchy mismatch"
    }]);
    expect(result).toMatchObject({ valid: false });
    expect(result.diagnostics[0]?.code).toBe("INVALID_HIERARCHY");
  });
});
