import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CloneConversationRuntimeDto,
  CompareConversationSnapshotsDto,
  ConversationRuntimeListQueryDto,
  PrepareConversationRuntimeDto,
  RollbackConversationRuntimeDto,
  TransitionConversationStateDto
} from "./dto/conversation-runtime.dto";
import { ConversationRuntimeController } from "./conversation-runtime.controller";

describe("ConversationRuntimeController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it("accepts complete nested metadata without message content", async () => {
    const result = await pipe.transform({
      name: "Support Conversation",
      compatibilityVersion: "1.0.0",
      sourceConversationId: "11111111-1111-4111-8111-111111111111",
      contexts: [{ contextKey: "primary", locale: "en-US", timezone: "UTC" }],
      participants: [{ participantKey: "system", type: "SYSTEM" }],
      messages: [{
        messageIdentifier: "message-1", ordinal: 0, role: "SYSTEM",
        participantKey: "system", contentHash: "hash"
      }],
      variables: [{ name: "customer_name", type: "STRING", value: "Ada" }],
      attachments: [{
        attachmentIdentifier: "file-1", type: "FILE", mimeType: "application/pdf",
        sizeBytes: 10, checksum: "checksum"
      }],
      labels: [{ value: "priority" }],
      tags: [{ value: "support" }],
      notes: [{ noteKey: "routing", metadata: { queue: "tier-1" } }],
      settings: { memoryEnabled: false, maxHistoryMessages: 100 }
    }, { type: "body", metatype: PrepareConversationRuntimeDto }) as PrepareConversationRuntimeDto;
    expect(result).toBeInstanceOf(PrepareConversationRuntimeDto);
    expect(result.messages?.[0]?.contentHash).toBe("hash");
    expect("content" in (result.messages?.[0] ?? {})).toBe(false);
  });

  it.each([
    {},
    { name: "Runtime", compatibilityVersion: "invalid" },
    { name: "Runtime", compatibilityVersion: "1.0.0", sourceConversationId: "invalid" },
    {
      name: "Runtime", compatibilityVersion: "1.0.0",
      messages: [{ messageIdentifier: "bad id", ordinal: -1, role: "UNKNOWN" }]
    },
    { name: "Runtime", compatibilityVersion: "1.0.0", unknown: true }
  ])("rejects invalid preparation DTO %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body", metatype: PrepareConversationRuntimeDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates lifecycle and query DTOs", async () => {
    await expect(pipe.transform({ state: "ACTIVE" }, {
      type: "body", metatype: TransitionConversationStateDto
    })).resolves.toBeInstanceOf(TransitionConversationStateDto);
    await expect(pipe.transform({ versionId: "11111111-1111-4111-8111-111111111111" }, {
      type: "body", metatype: RollbackConversationRuntimeDto
    })).resolves.toBeInstanceOf(RollbackConversationRuntimeDto);
    await expect(pipe.transform({ name: "Clone" }, {
      type: "body", metatype: CloneConversationRuntimeDto
    })).resolves.toBeInstanceOf(CloneConversationRuntimeDto);
    const query = await pipe.transform({ page: "2", limit: "50", status: "PUBLISHED" }, {
      type: "query", metatype: ConversationRuntimeListQueryDto
    }) as ConversationRuntimeListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "PUBLISHED" });
    await expect(pipe.transform({
      leftId: "11111111-1111-4111-8111-111111111111",
      rightId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: CompareConversationSnapshotsDto }))
      .resolves.toBeInstanceOf(CompareConversationSnapshotsDto);
  });

  it("declares dedicated endpoint permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.prepare))
      .toEqual(["conversation.runtime.create"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.transition))
      .toEqual(["conversation.runtime.update"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.publish))
      .toEqual(["conversation.runtime.publish"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.rollback))
      .toEqual(["conversation.runtime.rollback"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.clone))
      .toEqual(["conversation.runtime.clone"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.archive))
      .toEqual(["conversation.runtime.archive"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.restore))
      .toEqual(["conversation.runtime.restore"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.softDelete))
      .toEqual(["conversation.runtime.delete"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.compare))
      .toEqual(["conversation.runtime.compare"]);
    expect(reflector.get("permissions", ConversationRuntimeController.prototype.list))
      .toEqual(["conversation.runtime.read"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
