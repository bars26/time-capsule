// app/layout.tsx
// V2 layout — no Google Fonts dependency. Uses platform/system font stack via
// CSS variables defined in globals.css. Eliminates network round-trip at build
// time and keeps the app working even with restricted/slow network.

import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { I18nProvider } from "./components/I18nProvider";
import { RootProvider } from "./rootProvider";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import MiniAppReady from "./components/MiniAppReady";
import "./globals.css";

const SITE_URL = "https://timecapsule-base.vercel.app";
const SITE_NAME = "Time Capsule";
const SITE_DESC =
  "Geleceğe bir mesaj kilitle. Kendine veya başkasına. Base ağında onchain, şifreli, kalıcı.";
// Farcaster Mini App / base.dev catalog spec requires raster images (PNG/JPG),
// not SVG. sphere.svg is kept only as the in-browser favicon (browsers handle
// SVG fine). For the manifest and social previews we use pre-rendered PNGs:
//   sphere-icon.png  → 1024x1024 square (iconUrl, splashImageUrl)
//   sphere-og.png    → 1200x630 (3:2 social preview / fc:miniapp imageUrl)
const ICON_URL = `${SITE_URL}/sphere-icon.png`;
const OG_IMAGE_URL = `${SITE_URL}/sphere-og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESC,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESC,
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: SITE_NAME }],
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
    images: [OG_IMAGE_URL],
  },
  icons: {
    icon: "/sphere.svg",
  },
  // base.dev / Farcaster Mini App metadata.
  // - base:app_id verifies domain ownership for base.dev catalog.
  // - fc:miniapp is the v2 Farcaster Mini App embed; fc:frame kept as fallback
  //   for clients still on the older spec.
  // imageUrl uses the 3:2 OG preview; splashImageUrl uses the square icon.
  other: {
    "base:app_id": "69eb7d2ae67b282fc52d2a58",
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: OG_IMAGE_URL,
      button: {
        title: "Create a capsule",
        action: {
          type: "launch_miniapp",
          name: SITE_NAME,
          url: SITE_URL,
          splashImageUrl: ICON_URL,
          splashBackgroundColor: "#000000",
        },
      },
    }),
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: OG_IMAGE_URL,
      button: {
        title: "Create a capsule",
        action: {
          type: "launch_frame",
          name: SITE_NAME,
          url: SITE_URL,
          splashImageUrl: ICON_URL,
          splashBackgroundColor: "#000000",
        },
      },
    }),
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <I18nProvider
          serverLocale={locale === "en" ? "en" : "tr"}
          serverMessages={messages}
        >
          <RootProvider>
            {/* Tells the Farcaster/Base App Mini App host we're ready (dismisses
                the splash screen). No-op on the regular web. */}
            <MiniAppReady />
            {/* Floating language switcher — visible on every page, fixed
                top-right so it doesn't fight with each page's own header. */}
            <div
              style={{
                position: "fixed",
                top: 12,
                right: 12,
                zIndex: 50,
              }}
            >
              <LanguageSwitcher />
            </div>
            {children}
          </RootProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
