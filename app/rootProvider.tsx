"use client";

import { ReactNode } from "react";
import { WagmiProvider, http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rabbyWallet,
  okxWallet,
  walletConnectWallet,
  rainbowWallet,
  trustWallet,
  phantomWallet,
} from "@rainbow-me/rainbowkit/wallets";
import "@rainbow-me/rainbowkit/styles.css";
// Farcaster / Base App Mini App embedded-wallet connector. Available inside a
// Mini App host so users connect their in-app wallet (no external wallet).
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

// Explicit wallet list. Base ecosystem prioritizes Coinbase Wallet (includes
// Base Smart Wallet flow). MetaMask kept for compatibility but its mobile app
// is unstable — Rabby and OKX are listed alongside as reliable alternatives.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Önerilen",
      wallets: [coinbaseWallet, rabbyWallet, okxWallet, metaMaskWallet],
    },
    {
      groupName: "Diğer",
      wallets: [walletConnectWallet, rainbowWallet, trustWallet, phantomWallet],
    },
  ],
  {
    appName: "Time Capsule",
    // Get a free WalletConnect project ID from https://cloud.reown.com
    // and put it in .env as NEXT_PUBLIC_WC_PROJECT_ID
    // Without it, browser extensions still work but mobile QR connect won't.
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "PLACEHOLDER",
  },
);

const config = createConfig({
  // Mini App connector first so it's available inside Base App / Farcaster;
  // RainbowKit's external wallets follow for the regular web.
  connectors: [farcasterMiniApp(), ...connectors],
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#0052FF",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
