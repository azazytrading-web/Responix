import {
  ConversationRuntimeAttachmentType,
  ConversationRuntimeMessageRole,
  ConversationRuntimeParticipantType,
  ConversationRuntimeStateType
} from "@prisma/client";
import type { PrepareConversationRuntimeDto } from "./dto/conversation-runtime.dto";
import { ConversationVariableType } from "./dto/conversation-runtime.dto";
import { ConversationRuntimeValidator } from "./conversation-runtime.validator";

const base = (overrides: Partial<PrepareConversationRuntimeDto> = {}): PrepareConversationRuntimeDto => ({
  name: "Support Conversation",
  compatibilityVersion: "1.0.0",
  initialState: ConversationRuntimeStateType.READY,
  participants: [{
    participantKey: "customer",
    type: ConversationRuntimeParticipantType.CUSTOMER
  }],
  messages: [{
    messageIdentifier: "message-1",
    ordinal: 0,
    role: ConversationRuntimeMessageRole.USER,
    participantKey: "customer",
    contentHash: "hash"
  }],
  attachments: [{
    attachmentIdentifier: "attachment-1",
    messageIdentifier: "message-1",
    type: ConversationRuntimeAttachmentType.FILE,
    mimeType: "application/pdf",
    sizeBytes: 10,
    checksum: "checksum"
  }],
  variables: [{ name: "customer_name", type: ConversationVariableType.STRING, value: "Ada" }],
  ...overrides
});

describe("ConversationRuntimeValidator", () => {
  const validator = new ConversationRuntimeValidator();

  it("accepts normalized metadata-only state", () => {
    expect(validator.validate(base())).toEqual({ valid: true, diagnostics: [] });
  });

  it.each([
    [{ participants: [
      { participantKey: "same", type: ConversationRuntimeParticipantType.SYSTEM },
      { participantKey: "same", type: ConversationRuntimeParticipantType.EXTERNAL }
    ] }, "DUPLICATE_PARTICIPANT"],
    [{ messages: [
      { messageIdentifier: "same", ordinal: 0, role: ConversationRuntimeMessageRole.USER },
      { messageIdentifier: "same", ordinal: 1, role: ConversationRuntimeMessageRole.ASSISTANT }
    ] }, "DUPLICATE_MESSAGE_IDENTIFIER"],
    [{ messages: [
      { messageIdentifier: "one", ordinal: 0, role: ConversationRuntimeMessageRole.USER },
      { messageIdentifier: "two", ordinal: 0, role: ConversationRuntimeMessageRole.ASSISTANT }
    ] }, "DUPLICATE_MESSAGE_ORDINAL"],
    [{ variables: [
      { name: "same", type: ConversationVariableType.STRING, value: "a" },
      { name: "SAME", type: ConversationVariableType.STRING, value: "b" }
    ] }, "DUPLICATE_VARIABLE"]
  ])("rejects duplicate metadata %#", (overrides, code) => {
    const result = validator.validate(base(overrides));
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it.each(["system.value", "runtime.trace", "workspace.id", "tenant.id", "_private"])(
    "rejects reserved variable %s", (name) => {
      const result = validator.validate(base({
        variables: [{ name, type: ConversationVariableType.STRING, value: "x" }]
      }));
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "RESERVED_VARIABLE_NAME" })
      ]));
    }
  );

  it("validates participant, message, and attachment references", () => {
    const result = validator.validate(base({
      participants: [],
      messages: [{
        messageIdentifier: "message",
        ordinal: 0,
        role: ConversationRuntimeMessageRole.USER,
        participantKey: "missing"
      }],
      attachments: [{
        attachmentIdentifier: "attachment",
        messageIdentifier: "missing",
        type: ConversationRuntimeAttachmentType.IMAGE,
        mimeType: "application/pdf",
        sizeBytes: 1
      }]
    }));
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "MESSAGE_PARTICIPANT_NOT_FOUND",
      "ATTACHMENT_MESSAGE_NOT_FOUND",
      "ATTACHMENT_MIME_INCOMPATIBLE",
      "ATTACHMENT_CHECKSUM_REQUIRED"
    ]));
  });

  it.each([
    [ConversationVariableType.STRING, 1],
    [ConversationVariableType.NUMBER, "1"],
    [ConversationVariableType.BOOLEAN, "true"],
    [ConversationVariableType.ARRAY, {}],
    [ConversationVariableType.OBJECT, []],
    [ConversationVariableType.NULL, false]
  ])("rejects incompatible %s variable metadata", (type, value) => {
    const result = validator.validate(base({ variables: [{ name: "value", type, value }] }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VARIABLE_TYPE_MISMATCH" })
    ]));
  });

  it("normalizes deterministic ordering and label whitespace", () => {
    const normalized = validator.normalize(base({
      messages: [
        { messageIdentifier: "two", ordinal: 2, role: ConversationRuntimeMessageRole.USER },
        { messageIdentifier: "one", ordinal: 1, role: ConversationRuntimeMessageRole.USER }
      ],
      labels: [{ value: "  Priority  " }]
    }));
    expect(normalized.messages?.map(({ messageIdentifier }) => messageIdentifier)).toEqual(["one", "two"]);
    expect(normalized.labels?.[0]?.value).toBe("Priority");
  });

  it("enforces compatibility major version and closed-state consistency", () => {
    const result = validator.validate(base({
      compatibilityVersion: "2.0.0",
      initialState: ConversationRuntimeStateType.CLOSED,
      messages: []
    }));
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "VERSION_INCOMPATIBLE", "INVALID_INITIAL_STATE"
    ]));
  });

  it("accepts valid state transitions and rejects invalid transitions", () => {
    expect(() => validator.assertTransition(
      ConversationRuntimeStateType.READY,
      ConversationRuntimeStateType.ACTIVE
    )).not.toThrow();
    expect(() => validator.assertTransition(
      ConversationRuntimeStateType.CLOSED,
      ConversationRuntimeStateType.ACTIVE
    )).toThrow("Invalid conversation state transition");
  });
});
