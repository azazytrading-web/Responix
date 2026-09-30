import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_VERSION = 1;
const CIPHER = "aes-256-gcm";
const AAD_VERSION = "oic-provider-credential-v1";

export type EncryptedProviderCredential = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: number;
};

function encryptionKey(): Buffer {
  const value = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  if (!value) throw new Error("Provider credential encryption is not configured");
  const isHex = /^[a-f0-9]{64}$/i.test(value);
  if (!isHex && !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error("Provider credential encryption configuration is invalid");
  const key = isHex ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Provider credential encryption configuration is invalid");
  return key;
}

function associatedData(connectionId: string, version: number): Buffer {
  return Buffer.from(`${AAD_VERSION}:${connectionId}:${version}:${KEY_VERSION}`, "utf8");
}

export function encryptProviderCredential(secret: string, connectionId: string, version: number): EncryptedProviderCredential {
  if (typeof secret !== "string" || secret.trim().length === 0 || secret.length > 4096) throw new Error("Provider credential is invalid");
  const nonce = randomBytes(12);
  const cipher = createCipheriv(CIPHER, encryptionKey(), nonce);
  cipher.setAAD(associatedData(connectionId, version));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("hex"), authTag: cipher.getAuthTag().toString("hex"), keyVersion: KEY_VERSION };
}

export function decryptProviderCredential(encrypted: EncryptedProviderCredential, connectionId: string, version: number): string {
  if (encrypted.keyVersion !== KEY_VERSION || !/^[a-f0-9]{24}$/.test(encrypted.nonce) || !/^[a-f0-9]{32}$/.test(encrypted.authTag)) {
    throw new Error("Provider credential envelope is invalid");
  }
  const decipher = createDecipheriv(CIPHER, encryptionKey(), Buffer.from(encrypted.nonce, "hex"));
  decipher.setAAD(associatedData(connectionId, version));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
