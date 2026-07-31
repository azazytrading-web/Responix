import { BadRequestException } from "@nestjs/common";
import { MemoryReferenceKind } from "@prisma/client";
import { MemoryRuntimeValidator } from "./memory-runtime.validator";

describe("MemoryRuntimeValidator", () => {
  const validator = new MemoryRuntimeValidator();
  it("rejects reserved identifiers", () => {
    expect(() => validator.validateIdentifier("system")).toThrow(BadRequestException);
    expect(() => validator.validateIdentifier("system.private")).toThrow(BadRequestException);
  });
  it("rejects duplicate references and targets", () => {
    const targetRuntimeId = "11111111-1111-4111-8111-111111111111";
    expect(() => validator.validateReferences([
      { referenceKey: "one", targetRuntimeId, kind: MemoryReferenceKind.REFERENCE },
      { referenceKey: "one", targetRuntimeId: "22222222-2222-4222-8222-222222222222",
        kind: MemoryReferenceKind.DEPENDENCY }
    ])).toThrow("Duplicate memory reference key");
    expect(() => validator.validateReferences([
      { referenceKey: "one", targetRuntimeId, kind: MemoryReferenceKind.REFERENCE },
      { referenceKey: "two", targetRuntimeId, kind: MemoryReferenceKind.DEPENDENCY }
    ])).toThrow("Duplicate memory target");
  });
  it("validates major-version compatibility", () => {
    expect(() => validator.assertCompatibility("1.2", "1.9")).not.toThrow();
    expect(() => validator.assertCompatibility("2.0", "1.9")).toThrow(BadRequestException);
  });
  it("validates immutable snapshot integrity", () => {
    const hash = (value: unknown) => JSON.stringify(value);
    const snapshot = { content: { answer: 42 } };
    const packageHash = hash(snapshot);
    const checksum = hash({ packageHash, workspaceId: "workspace" });
    expect(() => validator.assertIntegrity(
      snapshot, packageHash, checksum, hash, "workspace"
    )).not.toThrow();
    expect(() => validator.assertIntegrity(
      snapshot, "tampered", checksum, hash, "workspace"
    )).toThrow("integrity");
  });
});
