// app/layout.tsx
// V2 layout — no Google Fonts dependency. Uses platform/system font stack via
// CSS variables defined in globals.css. Eliminates network round-trip at build
// time and keeps the app working even with restricted/slow network.

import type { Metadata } from "next";
import { RootProvider } from "./rootProvider";
import "./globals.css";

const SITE_URL = "https://time-capsule-nu-tan.vercel.app";
const SITE_NAME = "Time Capsule";
const SITE_DESC =
  "Geleceğe bir mesaj kilitle. Kendine veya başkasına. Base ağında onchain, şifreli, kalıcı.";
const ICON_URL = `${SITE_URL}/sphere.svg`;

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
    images: [{ url: ICON_URL, width: 1200, height: 630, alt: SITE_NAME }],
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
    images: [ICON_URL],
  },
  icons: {
    icon: "/sphere.svg",
  },
  // base.dev / Farcaster Mini App metadata.
  // - base:app_id verifies domain ownership for base.dev catalog.
  // - fc:miniapp is the v2 Farcaster Mini App embed; fc:frame kept as fallback
  //   for clients still on the older spec.
  other: {
    "base:app_id": "69eb7d2ae67b282fc52d2a58",
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: ICON_URL,
      button: {
        title: "Kapsül oluştur",
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
      imageUrl: ICON_URL,
      button: {
        title: "Kapsül oluştur",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
