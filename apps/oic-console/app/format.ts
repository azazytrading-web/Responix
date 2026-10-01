import type { Locale } from "./i18n";
import type { Row } from "./types";

export function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "—";
}

export function getString(row: Row, key: string): string {
  return safeText(row[key]);
}

export function pretty(value: unknown): string {
  return typeof value === "string" ? value.replaceAll("_", " ") : safeText(value);
}

export function dateValue(value: unknown, locale: Locale): string {
  if (!value) return "—";
  const text = safeText(value);
  const date = new Date(text);
  return Number.isNaN(date.valueOf())
    ? text
    : new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC"
      }).format(date) + " UTC";
}

export function entryText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
