import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

function scrypt(password: string, salt: string, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, length, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key)));
}
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type IssuedCredential = { token: string; selector: string; verifier: string };

export async function issueCredential(): Promise<IssuedCredential> {
  const selector = randomBytes(16).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(secret, salt, 32);
  return { token: `oic_v1.${selector}.${secret}`, selector, verifier: `scrypt$1$${salt}$${hash.toString("hex")}` };
}

export async function verifyCredential(secret: string, encoded: string): Promise<boolean> {
  const [algorithm, version, salt, digest] = encoded.split("$");
  if (algorithm !== "scrypt" || version !== "1" || !salt || !digest || !/^[a-f0-9]{64}$/.test(digest)) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = await scrypt(secret, salt, expected.length);
  return timingSafeEqual(actual, expected);
}