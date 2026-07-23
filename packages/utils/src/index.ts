export function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assertDefined<TValue>(
  value: TValue | null | undefined,
  message: string
): asserts value is TValue {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

export function toIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
