import { BadRequestException, Injectable } from "@nestjs/common";
import { ConversationRuntimeStateType } from "@prisma/client";
import type { PrepareConversationRuntimeDto } from "./dto/conversation-runtime.dto";
import { ConversationVariableType } from "./dto/conversation-runtime.dto";

export interface ConversationRuntimeDiagnostic {
  severity: "ERROR" | "WARNING";
  code: string;
  path: string;
  message: string;
}

export interface ConversationValidationResult {
  valid: boolean;
  diagnostics: ConversationRuntimeDiagnostic[];
}

@Injectable()
export class ConversationRuntimeValidator {
  private readonly transitions: Record<ConversationRuntimeStateType, ConversationRuntimeStateType[]> = {
    INITIALIZED: [ConversationRuntimeStateType.READY],
    READY: [ConversationRuntimeStateType.ACTIVE, ConversationRuntimeStateType.CLOSED],
    ACTIVE: [ConversationRuntimeStateType.PAUSED, ConversationRuntimeStateType.CLOSED],
    PAUSED: [ConversationRuntimeStateType.ACTIVE, ConversationRuntimeStateType.CLOSED],
    CLOSED: []
  };

  validate(dto: PrepareConversationRuntimeDto, sourceDiagnostics: ConversationRuntimeDiagnostic[] = []) {
    const diagnostics = [...sourceDiagnostics];
    this.unique(diagnostics, dto.contexts?.map(({ contextKey }) => contextKey) ?? [],
      "DUPLICATE_CONTEXT", "contexts");
    this.unique(diagnostics, dto.participants?.map(({ participantKey }) => participantKey) ?? [],
      "DUPLICATE_PARTICIPANT", "participants");
    this.unique(diagnostics, dto.messages?.map(({ messageIdentifier }) => messageIdentifier) ?? [],
      "DUPLICATE_MESSAGE_IDENTIFIER", "messages");
    this.unique(diagnostics, dto.messages?.map(({ ordinal }) => String(ordinal)) ?? [],
      "DUPLICATE_MESSAGE_ORDINAL", "messages.ordinal");
    this.unique(diagnostics, dto.attachments?.map(({ attachmentIdentifier }) => attachmentIdentifier) ?? [],
      "DUPLICATE_ATTACHMENT", "attachments");
    this.unique(diagnostics, dto.variables?.map(({ name }) => name.toLowerCase()) ?? [],
      "DUPLICATE_VARIABLE", "variables");
    this.unique(diagnostics, dto.labels?.map(({ value }) => value.trim().toLowerCase()) ?? [],
      "DUPLICATE_LABEL", "labels");
    this.unique(diagnostics, dto.tags?.map(({ value }) => value.trim().toLowerCase()) ?? [],
      "DUPLICATE_TAG", "tags");
    this.unique(diagnostics, dto.notes?.map(({ noteKey }) => noteKey) ?? [],
      "DUPLICATE_NOTE", "notes");

    const participantKeys = new Set(dto.participants?.map(({ participantKey }) => participantKey));
    dto.messages?.forEach((message, index) => {
      if (message.participantKey && !participantKeys.has(message.participantKey)) {
        diagnostics.push(this.error("MESSAGE_PARTICIPANT_NOT_FOUND", `messages.${index}.participantKey`,
          "Message participant must exist in the package"));
      }
    });
    const messageIds = new Set(dto.messages?.map(({ messageIdentifier }) => messageIdentifier));
    dto.attachments?.forEach((attachment, index) => {
      if (attachment.messageIdentifier && !messageIds.has(attachment.messageIdentifier)) {
        diagnostics.push(this.error("ATTACHMENT_MESSAGE_NOT_FOUND", `attachments.${index}.messageIdentifier`,
          "Attachment message identifier must exist in the package"));
      }
      if (!this.attachmentCompatible(attachment.type, attachment.mimeType)) {
        diagnostics.push(this.error("ATTACHMENT_MIME_INCOMPATIBLE", `attachments.${index}.mimeType`,
          "Attachment MIME type is incompatible with its metadata type"));
      }
      if (attachment.sizeBytes !== undefined && attachment.sizeBytes > 0 && !attachment.checksum) {
        diagnostics.push(this.error("ATTACHMENT_CHECKSUM_REQUIRED", `attachments.${index}.checksum`,
          "Non-empty attachment metadata requires a checksum"));
      }
    });
    dto.variables?.forEach((variable, index) => {
      if (/^(system|runtime|execution|workspace|tenant|provider|agent)(?:\.|$)/i.test(variable.name) ||
        variable.name.startsWith("_")) {
        diagnostics.push(this.error("RESERVED_VARIABLE_NAME", `variables.${index}.name`,
          "Variable name uses a reserved runtime namespace"));
      }
      if (!this.variableCompatible(variable.type, variable.value)) {
        diagnostics.push(this.error("VARIABLE_TYPE_MISMATCH", `variables.${index}.value`,
          `Value is incompatible with ${variable.type}`));
      }
    });
    if (!/^1\.\d+\.\d+$/.test(dto.compatibilityVersion)) {
      diagnostics.push(this.error("VERSION_INCOMPATIBLE", "compatibilityVersion",
        "Conversation Runtime supports compatibility major version 1"));
    }
    const initial = dto.initialState ?? ConversationRuntimeStateType.READY;
    if (initial === ConversationRuntimeStateType.CLOSED && (dto.messages?.length ?? 0) === 0) {
      diagnostics.push(this.error("INVALID_INITIAL_STATE", "initialState",
        "A closed conversation package must include message metadata"));
    }
    return {
      valid: !diagnostics.some(({ severity }) => severity === "ERROR"),
      diagnostics
    } satisfies ConversationValidationResult;
  }

  normalize(dto: PrepareConversationRuntimeDto): PrepareConversationRuntimeDto {
    return {
      ...dto,
      name: dto.name.trim(),
      contexts: [...(dto.contexts ?? [])].sort((a, b) => a.contextKey.localeCompare(b.contextKey)),
      variables: [...(dto.variables ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
      participants: [...(dto.participants ?? [])]
        .sort((a, b) => a.participantKey.localeCompare(b.participantKey)),
      messages: [...(dto.messages ?? [])].sort((a, b) => a.ordinal - b.ordinal),
      attachments: [...(dto.attachments ?? [])]
        .sort((a, b) => a.attachmentIdentifier.localeCompare(b.attachmentIdentifier)),
      labels: (dto.labels ?? []).map((item) => ({ ...item, value: item.value.trim() }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      tags: (dto.tags ?? []).map((item) => ({ ...item, value: item.value.trim() }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      notes: [...(dto.notes ?? [])].sort((a, b) => a.noteKey.localeCompare(b.noteKey))
    };
  }

  assertTransition(current: ConversationRuntimeStateType, target: ConversationRuntimeStateType) {
    if (!this.transitions[current].includes(target)) {
      throw new BadRequestException(`Invalid conversation state transition: ${current} -> ${target}`);
    }
  }

  private attachmentCompatible(type: string, mimeType: string) {
    const prefix: Record<string, string | null> = {
      IMAGE: "image/", AUDIO: "audio/", VIDEO: "video/", FILE: null, OTHER: null
    };
    return prefix[type] === null || mimeType.toLowerCase().startsWith(prefix[type] ?? "");
  }

  private variableCompatible(type: ConversationVariableType, value: unknown): boolean {
    if (type === ConversationVariableType.NULL) return value === null;
    if (type === ConversationVariableType.STRING) return typeof value === "string";
    if (type === ConversationVariableType.NUMBER) return typeof value === "number" && Number.isFinite(value);
    if (type === ConversationVariableType.BOOLEAN) return typeof value === "boolean";
    if (type === ConversationVariableType.ARRAY) return Array.isArray(value);
    if (type === ConversationVariableType.OBJECT) {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }
    return this.jsonCompatible(value);
  }

  private jsonCompatible(value: unknown): boolean {
    if (value === null || ["string", "boolean"].includes(typeof value)) return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item) => this.jsonCompatible(item));
    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).every((item) => this.jsonCompatible(item));
    }
    return false;
  }

  private unique(
    diagnostics: ConversationRuntimeDiagnostic[],
    values: string[],
    code: string,
    path: string
  ) {
    if (new Set(values).size !== values.length) diagnostics.push(this.error(code, path, "Values must be unique"));
  }

  private error(code: string, path: string, message: string): ConversationRuntimeDiagnostic {
    return { severity: "ERROR", code, path, message };
  }
}
