import { getRequestConfig } from "next-intl/server";
import { locales, defaultLocale, type Locale } from "./src/lib/i18n/config";

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  const resolvedLocale = locales.includes(locale as Locale) ? locale : defaultLocale;
  const mod = await import(`./src/lib/i18n/messages/${resolvedLocale}.json`);
  const messages = mod.default;
  return {
    messages,
    locale: resolvedLocale,
    timeZone: "UTC",
    now: new Date(),
  };
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
