import { MemoryReferenceKind, MemoryRuntimeType } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateMemoryRuntimeDto, ResolveMemoryRuntimeDto
} from "./memory-runtime.dto";

describe("Memory Runtime DTO validation", () => {
  it("accepts all runtime abstraction fields and nested references", async () => {
    const dto = plainToInstance(CreateMemoryRuntimeDto, {
      identifier: "conversation.primary", name: "Conversation memory",
      type: MemoryRuntimeType.CONVERSATION, scopeKey: "conversation:primary",
      content: { messages: [] }, compatibilityVersion: "1.0",
      references: [{
        referenceKey: "shared", targetRuntimeId: "11111111-1111-4111-8111-111111111111",
        kind: MemoryReferenceKind.REFERENCE
      }]
    });
    expect(await validate(dto)).toEqual([]);
  });
  it("rejects malformed snapshot resolution inputs", async () => {
    const dto = plainToInstance(ResolveMemoryRuntimeDto, {
      snapshotIds: ["not-a-uuid"], compatibilityVersion: "latest"
    });
    expect(await validate(dto)).not.toEqual([]);
  });
});
