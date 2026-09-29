/** Creates the stable uniqueness key for a workspace Custom Provider display name. */
export function normalizeCustomProviderName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function requireNormalizedCustomProviderName(value: string): string {
  const normalized = normalizeCustomProviderName(value);
  if (!normalized) throw new Error("Custom provider name must not be empty");
  return normalized;
}
