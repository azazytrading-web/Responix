import { BadRequestException } from "@nestjs/common";
import { RetrievalExecutionMode } from "@prisma/client";
import { RetrievalExecutionValidator } from "./retrieval-execution.validator";

describe("RetrievalExecutionValidator", () => {
  const validator = new RetrievalExecutionValidator();
  it("normalizes Unicode, case, and whitespace deterministically", () => {
    expect(validator.normalizeQuery("  HéLLO\n  WORLD  ")).toBe("héllo world");
  });
  it("rejects an empty normalized query", () => {
    expect(() => validator.normalizeQuery(" \n ")).toThrow(BadRequestException);
  });
  it("rejects duplicate filter identities", () => {
    expect(() => validator.validate({ retrievalRuntimeSnapshotId: crypto.randomUUID(), query: "q",
      filters: [{ key: "document.language", operator: "EQUALS", value: "en" },
        { key: "document.language", operator: "EQUALS", value: "fr" }] })).toThrow(BadRequestException);
  });
  it("enforces semantic provider compatibility when capabilities are supplied", () => {
    expect(() => validator.validate({ retrievalRuntimeSnapshotId: crypto.randomUUID(), query: "q",
      mode: RetrievalExecutionMode.SEMANTIC, providerCapabilities: ["text"] })).toThrow(BadRequestException);
  });
  it("accepts matching major compatibility versions", () => {
    expect(() => validator.assertCompatibility("1.7", "1.0")).not.toThrow();
    expect(() => validator.assertCompatibility("2.0", "1.0")).toThrow(BadRequestException);
  });
});
