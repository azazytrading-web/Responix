/**
 * Strict Runtime Assertions
 */

export function assert(condition: boolean, message: string): asserts condition {
  if (process.env.NODE_ENV !== "production" && !condition) {
    throw new Error(`[Assertion Failed] ${message}`);
  }
}

export function assertDefined<T>(value: T | undefined | null, name: string): T {
  if (process.env.NODE_ENV !== "production" && (value === undefined || value === null)) {
    throw new Error(`[Assertion Failed] Expected ${name} to be defined, got ${String(value)}`);
  }
  return value as T;
}

export function assertNever(value: never): never {
  throw new Error(`[Assertion Failed] Unexpected value: ${String(value)}`);
}
