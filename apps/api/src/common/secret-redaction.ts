export const REDACTED_VALUE = "[REDACTED]";

const protectedFieldNames = new Set(
  [
    "authorization",
    "cookie",
    "set-cookie",
    "password",
    "passwordHash",
    "refreshToken",
    "refreshTokenHash",
    "accessToken",
    "bearerToken",
    "jwt",
    "apiKey",
    "secret",
    "encryptedSecret",
    "encryptionKey",
    "privateKey",
    "clientSecret",
    "invitationToken",
    "invitationTokenHash",
    "verificationToken",
    "verificationCode",
    "mfaSecret",
    "backupCodes",
    "sessionId",
    "databaseUrl",
    "connectionString"
  ].map(normalizeFieldName)
);

const secretAssignmentPattern =
  /\b(authorization|cookie|set-cookie|password|passwordHash|refreshToken|refreshTokenHash|accessToken|bearerToken|jwt|apiKey|secret|encryptedSecret|encryptionKey|privateKey|clientSecret|invitationToken|invitationTokenHash|verificationToken|verificationCode|mfaSecret|backupCodes|sessionId|databaseUrl|connectionString)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi;

function normalizeFieldName(field: string): string {
  return field.replace(/[-_.\s]/g, "").toLowerCase();
}

export function isProtectedField(field: string): boolean {
  return protectedFieldNames.has(normalizeFieldName(field));
}

export function redactSecretText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED_VALUE}`)
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      REDACTED_VALUE
    )
    .replace(
      /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^@\s/]+@/gi,
      "$1://[REDACTED]@"
    )
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      REDACTED_VALUE
    )
    .replace(secretAssignmentPattern, (_match, field: string, separator: string) => {
      return `${field}${separator}${REDACTED_VALUE}`;
    });
}

export function redactSecrets(value: unknown): unknown {
  return redactValue(value, new WeakMap<object, unknown>());
}

export function redactLogArguments(arguments_: readonly unknown[]): unknown[] {
  return arguments_.map((argument) => redactSecrets(argument));
}

function redactValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (typeof value === "string") return redactSecretText(value);
  if (typeof value !== "object" || value === null) return value;
  if (value instanceof Date || value instanceof RegExp || Buffer.isBuffer(value)) return value;

  const existing = seen.get(value);
  if (existing) return existing;

  if (value instanceof Error) {
    const redactedError: Record<string, unknown> = {
      type: value.name,
      message: redactSecretText(value.message),
      ...(value.stack ? { stack: redactSecretText(value.stack) } : {})
    };
    seen.set(value, redactedError);
    for (const [key, nested] of Object.entries(value)) {
      redactedError[key] = isProtectedField(key)
        ? REDACTED_VALUE
        : redactValue(nested, seen);
    }
    return redactedError;
  }

  if (Array.isArray(value)) {
    const redactedArray: unknown[] = [];
    seen.set(value, redactedArray);
    for (const item of value) redactedArray.push(redactValue(item, seen));
    return redactedArray;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return value;

  const redactedObject: Record<string, unknown> = {};
  seen.set(value, redactedObject);
  for (const [key, nested] of Object.entries(value)) {
    redactedObject[key] = isProtectedField(key)
      ? REDACTED_VALUE
      : redactValue(nested, seen);
  }
  return redactedObject;
}
