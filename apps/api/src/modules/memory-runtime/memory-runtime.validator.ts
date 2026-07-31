import { BadRequestException, Injectable } from "@nestjs/common";
import type { MemoryReferenceDto } from "./dto/memory-runtime.dto";

export interface MemoryDiagnostic {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  path: string;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MemoryRuntimeValidator {
  private readonly reserved = new Set(["system", "runtime", "internal", "root", "default"]);

  validateIdentifier(identifier: string) {
    if (this.reserved.has(identifier.toLowerCase()) || identifier.startsWith("system.")) {
      throw new BadRequestException("Memory identifier is reserved");
    }
  }

  validateReferences(references: MemoryReferenceDto[] = []) {
    const keys = new Set<string>();
    const targets = new Set<string>();
    for (const [index, reference] of references.entries()) {
      if (keys.has(reference.referenceKey)) {
        throw new BadRequestException(`Duplicate memory reference key at references.${index}`);
      }
      const identity = `${reference.targetRuntimeId}:${reference.targetRevision ?? "latest"}`;
      if (targets.has(identity)) {
        throw new BadRequestException(`Duplicate memory target at references.${index}`);
      }
      keys.add(reference.referenceKey);
      targets.add(identity);
    }
  }

  assertCompatibility(expected: string, actual: string, path = "compatibilityVersion") {
    const expectedMajor = expected.split(".")[0];
    const actualMajor = actual.split(".")[0];
    if (expectedMajor !== actualMajor) {
      throw new BadRequestException({
        message: "Memory compatibility validation failed",
        diagnostics: [{ severity: "ERROR", code: "MEMORY_INCOMPATIBLE", path,
          message: `Expected compatibility ${expected}, received ${actual}` }]
      });
    }
  }

  assertIntegrity(snapshot: unknown, packageHash: string, checksum: string,
    hash: (value: unknown) => string, workspaceId: string) {
    if (hash(snapshot) !== packageHash ||
      hash({ packageHash, workspaceId }) !== checksum) {
      throw new BadRequestException("Memory snapshot integrity validation failed");
    }
  }
}
