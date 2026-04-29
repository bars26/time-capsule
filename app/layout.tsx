// app/layout.tsx
// V2 layout — no Google Fonts dependency. Uses platform/system font stack via
// CSS variables defined in globals.css. Eliminates network round-trip at build
// time and keeps the app working even with restricted/slow network.

import type { Metadata } from "next";
import { RootProvider } from "./rootProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time Capsule",
  description:
    "Onchain time capsules on Base. Lock a message until the date you choose.",
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
