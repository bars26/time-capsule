// app/components/LanguageSwitcher.tsx
// Compact dropdown that lets the user switch between Turkish and English.
// Writes the NEXT_LOCALE cookie (server reads it via i18n/request.ts) and
// reloads the page so the new locale takes effect for both server and client
// components. The reload is cheap because Next.js caches the route segments.

"use client";

import { useLocale, useTranslations } from "next-intl";

const COOKIE_NAME = "NEXT_LOCALE";
type Lang = "tr" | "en";

export function LanguageSwitcher() {
  const locale = useLocale() as Lang;
  const t = useTranslations("language");

  const setLocale = (next: Lang) => {
    if (next === locale) return;
    // 1 year, root path, samesite=lax so it persists naturally.
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Force a fresh server render with the new cookie.
    window.location.reload();
  };

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Lang)}
      style={{
        background: "transparent",
        color: "var(--text-secondary, #aaa)",
        border: "1px solid var(--border, #333)",
        borderRadius: "var(--radius-sm, 6px)",
        padding: "6px 8px",
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <option value="tr">🇹🇷 {t("turkish")}</option>
      <option value="en">🇬🇧 {t("english")}</option>
    </select>
  );
}
