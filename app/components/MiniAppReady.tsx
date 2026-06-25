// app/components/MiniAppReady.tsx
// Signals the Farcaster / Base App Mini App host that the app has loaded, which
// dismisses the splash screen (the blue icon). Without this call the Mini App
// stays stuck on the splash forever.
//
// Safe on the regular web: it only calls ready() when actually running inside a
// Mini App host, and loads the SDK dynamically so SSR isn't affected.

"use client";

import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";

export default function MiniAppReady() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const inMiniApp = await sdk.isInMiniApp().catch(() => false);
        if (cancelled || !inMiniApp) return;

        // Dismiss the splash screen.
        await sdk.actions.ready();

        // Auto-connect to the in-app (Farcaster/Base App) wallet so the user
        // doesn't have to pick an external wallet inside the Mini App.
        if (!isConnected) {
          const fc = connectors.find((c) => c.id === "farcaster");
          if (fc) connect({ connector: fc });
        }
      } catch {
        // Not in a Mini App host (or SDK unavailable) — no-op on the web.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, connect, connectors]);

  return null;
}
