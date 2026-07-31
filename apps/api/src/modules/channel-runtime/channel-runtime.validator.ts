import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreateChannelConnectionDto, SendChannelMessageDto, UploadChannelAttachmentDto } from "./dto/channel-runtime.dto";

const API_VERSION = /^v\d{2,3}\.\d+$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const MIME = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

@Injectable()
export class ChannelRuntimeValidator {
  connection(dto: CreateChannelConnectionDto): void {
    if (!API_VERSION.test(dto.apiVersion)) throw new BadRequestException("Invalid Meta Graph API version");
    if (dto.displayPhoneNumber && !E164.test(dto.displayPhoneNumber)) throw new BadRequestException("Invalid E.164 phone number");
    if (dto.accessToken.length < 20 || dto.verifyToken.length < 16 || dto.appSecret.length < 16) {
      throw new BadRequestException("Channel credentials do not satisfy minimum security requirements");
    }
  }
  message(dto: SendChannelMessageDto): void {
    if (dto.type === "TEXT" && !dto.text?.trim()) throw new BadRequestException("Text messages require text");
    if (dto.type !== "TEXT" && !dto.content && !dto.attachmentIds?.length) {
      throw new BadRequestException("Non-text messages require content or attachments");
    }
  }
  attachment(dto: UploadChannelAttachmentDto): void {
    if (!MIME.test(dto.mimeType)) throw new BadRequestException("Invalid attachment MIME type");
    if (dto.sizeBytes > 100 * 1024 * 1024) throw new BadRequestException("Attachment exceeds 100 MiB");
    const bytes = Buffer.from(dto.dataBase64, "base64");
    if (bytes.length !== dto.sizeBytes) throw new BadRequestException("Attachment size does not match payload");
  }
  configuration(value: Record<string, unknown>): void {
    const prohibited = /token|secret|password|credential|authorization/i;
    const walk = (current: unknown, path: string): void => { if (Array.isArray(current)) { current.forEach((item, index) => walk(item, `${path}[${index}]`)); return; }
      if (!current || typeof current !== "object") return; for (const [key, item] of Object.entries(current)) {
        if (prohibited.test(key)) throw new BadRequestException(`Secrets are prohibited in channel configuration at ${path}${key}`); walk(item, `${path}${key}.`); } };
    walk(value, "");
  }
}
