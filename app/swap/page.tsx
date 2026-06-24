// app/swap/page.tsx
// Dedicated swap page. Thin wrapper around the reusable <SwapBox/> component
// (the same widget is embedded inline in the capsule create flow).

"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useLocale } from "next-intl";
import Link from "next/link";

import SwapBox from "../components/SwapBox";

export default function SwapPage() {
  const tr = useLocale().startsWith("tr");
  const { isConnected } = useAccount();

  return (
    <main
      className="container-narrow"
      style={{ paddingTop: 32, paddingBottom: 80 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 28, margin: 0 }}>{tr ? "Takas" : "Swap"}</h2>
        {isConnected && (
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="none"
          />
        )}
      </div>

      <SwapBox defaultFrom="ETH" defaultTo="USDC" />

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <Link href="/" className="muted">
          ← {tr ? "Kapsüllere dön" : "Back to capsules"}
        </Link>
      </div>
    </main>
  );
}
