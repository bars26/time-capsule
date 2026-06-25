// app/components/MiniAppReady.tsx
// Signals the Farcaster / Base App Mini App host that the app has loaded, which
// dismisses the splash screen (the blue icon). Without this call the Mini App
// stays stuck on the splash forever.
//
// Safe on the regular web: it only calls ready() when actually running inside a
// Mini App host, and loads the SDK dynamically so SSR isn't affected.

"use client";

import { useEffect } from "react";

export default function MiniAppReady() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const inMiniApp = await sdk.isInMiniApp().catch(() => false);
        if (!cancelled && inMiniApp) {
          await sdk.actions.ready();
        }
      } catch {
        // Not in a Mini App host (or SDK unavailable) — no-op on the web.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
