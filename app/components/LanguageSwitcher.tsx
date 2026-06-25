// app/components/LanguageSwitcher.tsx
// Compact dropdown that lets the user switch between Turkish and English.
// Uses the client-side locale switch (see I18nProvider) so it works everywhere,
// including inside the Mini App webview where cookies are unreliable. No reload.

"use client";

import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "./I18nProvider";

type Lang = "tr" | "en";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleSwitch();
  const t = useTranslations("language");

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
