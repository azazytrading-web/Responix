import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = 1;

type EncryptedCredentialPayload = {
  version: number;
  iv: string;
  authTag: string;
  ciphertext: string;
};

@Injectable()
export class ProviderCredentialCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const payload: EncryptedCredentialPayload = {
      version: ENCRYPTION_VERSION,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64")
    };
    return JSON.stringify(payload);
  }

  decrypt(encryptedSecret: string): string {
    const payload = this.parsePayload(encryptedSecret);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  }

  fingerprint(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  private get encryptionKey(): Buffer {
    const key = Buffer.from(this.config.getOrThrow<string>("ai.credentialEncryptionKey"), "base64");
    if (key.length !== 32) throw new Error("AI credential encryption key must decode to 32 bytes");
    return key;
  }

  private parsePayload(encryptedSecret: string): EncryptedCredentialPayload {
    let payload: EncryptedCredentialPayload;
    try {
      payload = JSON.parse(encryptedSecret) as EncryptedCredentialPayload;
    } catch {
      throw new Error("Invalid encrypted provider credential payload");
    }
    if (
      payload.version !== ENCRYPTION_VERSION ||
      !payload.iv ||
      !payload.authTag ||
      !payload.ciphertext
    ) {
      throw new Error("Unsupported encrypted provider credential payload");
    }
    return payload;
  }
}
