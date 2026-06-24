// lib/swap.ts
// KyberSwap Aggregator integration config for the in-app token swap.
//
// Revenue model: every swap routed through the app charges a small affiliate
// fee (SWAP_FEE_BPS) that KyberSwap sends to SWAP_FEE_RECIPIENT. The fee params
// are injected server-side in app/api/swap/route.ts so the client can't strip
// them. This is a new fee stream on top of the existing capsule mint fee.

import type { Address } from "viem";

// Native token sentinel used by KyberSwap (and most aggregators) for ETH.
export const NATIVE_TOKEN =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

// Wallet that receives the swap fee. This is your Base Account address.
// Kept here (not env) so it's obvious and reviewable; move to env if you prefer.
export const SWAP_FEE_RECIPIENT =
  "0x9f417535486848942add6CF58Ac7E841976bfD3B" as Address;

// Affiliate fee in basis points. 30 = 0.30%. Keep modest (10–50) so users
// still get competitive rates. Charged on the input token (currency_in).
export const SWAP_FEE_BPS = 30;

// Slippage tolerance for the built swap, in bps. 50 = 0.5%.
export const SWAP_SLIPPAGE_BPS = 50;

// Identifier sent to KyberSwap so they don't rate-limit us as anonymous.
export const KYBER_CLIENT_ID = "TimeCapsule";

// KyberSwap chain path segment for Base mainnet.
export const KYBER_CHAIN = "base";

export type SwapToken = {
  symbol: string;
  name: string;
  address: Address | typeof NATIVE_TOKEN;
  decimals: number;
  emoji: string;
};

// Curated Base token list for v1. Add more as needed.
export const SWAP_TOKENS: SwapToken[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: NATIVE_TOKEN,
    decimals: 18,
    emoji: "⟠",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    emoji: "💵",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    emoji: "🔷",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    decimals: 8,
    emoji: "₿",
  },
  {
    symbol: "DEGEN",
    name: "Degen",
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    decimals: 18,
    emoji: "🎩",
  },
];

export function isNative(addr: string): boolean {
  return addr.toLowerCase() === NATIVE_TOKEN.toLowerCase();
}

// ---- KyberSwap response shapes (only the fields we use) ----

export type RouteSummary = {
  tokenIn: string;
  amountIn: string;
  amountInUsd: string;
  tokenOut: string;
  amountOut: string;
  amountOutUsd: string;
  gas: string;
  gasUsd: string;
  extraFee?: {
    feeAmount: string;
    chargeFeeBy: string;
    isInBps: boolean;
    feeReceiver: string;
  };
  route: unknown[];
  routeID: string;
};

export type QuoteResponse = {
  code: number;
  message: string;
  data?: {
    routeSummary: RouteSummary;
    routerAddress: Address;
  };
};

export type BuildResponse = {
  code: number;
  message: string;
  data?: {
    amountIn: string;
    amountOut: string;
    amountOutUsd: string;
    gas: string;
    data: `0x${string}`;
    routerAddress: Address;
    transactionValue: string;
  };
};
