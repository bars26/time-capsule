// app/components/I18nProvider.tsx
// Client-side locale provider so language switching works everywhere —
// including inside the Farcaster / Base App Mini App webview, where cookies are
// unreliable (third-party / partitioned). The chosen locale is kept in
// localStorage and messages are swapped on the client (no reload, no cookie
// dependency). A cookie is still set as a best-effort so SSR can match.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

type Lang = "tr" | "en";
const STORAGE_KEY = "NEXT_LOCALE";

type Ctx = { locale: Lang; setLocale: (l: Lang) => void };
const DEFAULT_CTX: Ctx = { locale: "tr", setLocale: () => {} };
const LocaleCtx = createContext<Ctx>(DEFAULT_CTX);

export function useLocaleSwitch(): Ctx {
  return useContext(LocaleCtx);
}

export function I18nProvider({
  serverLocale,
  serverMessages,
  children,
}: {
  serverLocale: Lang;
  serverMessages: AbstractIntlMessages;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Lang>(serverLocale);
  const [messages, setMessages] = useState<AbstractIntlMessages>(serverMessages);

  const apply = useCallback(
    async (l: Lang) => {
      if (l === serverLocale) {
        setMessages(serverMessages);
      } else {
        const mod = await import(`../../messages/${l}.json`);
        setMessages(mod.default as AbstractIntlMessages);
      }
      setLocaleState(l);
    },
    [serverLocale, serverMessages],
  );

  // On first mount, honor a stored preference that differs from the server.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if ((stored === "tr" || stored === "en") && stored !== serverLocale) {
        apply(stored);
      }
    } catch {
      // localStorage unavailable — stay on the server locale.
    }
  }, [apply, serverLocale]);

  const setLocale = useCallback(
    (l: Lang) => {
      try {
        localStorage.setItem(STORAGE_KEY, l);
      } catch {}
      // Best-effort cookie for SSR alignment (works on the regular web).
      try {
        document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; samesite=none; secure`;
      } catch {}
      apply(l);
    },
    [apply],
  );

  return (
    <LocaleCtx.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleCtx.Provider>
  );
}
