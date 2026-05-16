// i18n/request.ts
// next-intl request configuration.
// Determines which locale messages to load on the server, based on a cookie
// set by the client-side language switcher. Falls back to 'tr' (the original
// app language) if no cookie is present.

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export const SUPPORTED_LOCALES = ["tr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "NEXT_LOCALE";

function isSupported(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Pick a locale based on this priority:
 *  1. Explicit cookie (user picked it in the language switcher)
 *  2. Accept-Language browser header (best-effort match)
 *  3. DEFAULT_LOCALE
 */
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupported(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  // very small parser: pick the first matching supported locale
  const browserPref = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0].toLowerCase())
    .map((tag) => tag.split("-")[0]);
  for (const tag of browserPref) {
    if (isSupported(tag)) return tag;
  }

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (
    await import(`../messages/${locale}.json`)
  ).default;

  return {
    locale,
    messages,
  };
});
