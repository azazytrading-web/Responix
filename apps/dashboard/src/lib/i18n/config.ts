export type Locale = "en" | "ar";

export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";

export function isRTL(locale: string): boolean {
  return locale === "ar";
}
