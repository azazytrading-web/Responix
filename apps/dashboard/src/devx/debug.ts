/**
 * Debug Mode
 */

export const DEBUG_KEY = "responix:debug";

export function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEBUG_KEY) === "true" || process.env.NODE_ENV === "development";
  } catch {
    return process.env.NODE_ENV === "development";
  }
}

export function enableDebugMode(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEBUG_KEY, "true");
}

export function disableDebugMode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEBUG_KEY);
}

export function debugLog(label: string, data: unknown): void {
  if (isDebugMode()) {
    console.log(`[DEBUG] ${label}:`, data);
  }
}
