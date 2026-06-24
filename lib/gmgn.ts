// lib/gmgn.ts
// GmGn greeter contract config. Fill GMGN_ADDRESS after deploying GmGn.sol to
// Base (e.g. via Remix), then set GMGN_READY = true.

import type { Address } from "viem";

// Deployed GmGn contract on Base mainnet (chainId 8453), fee = 0.00001 ETH.
export const GMGN_ADDRESS =
  "0x1d7D08a03D4c9C6375ca1363Eba384b14a1Ac88D" as Address;

// Set true now that the contract is live.
export const GMGN_READY = true;

export const GMGN_ABI = [
  { inputs: [{ internalType: "uint256", name: "initialFee", type: "uint256" }], stateMutability: "nonpayable", type: "constructor" },

  // greet(Kind kind) — Kind is an enum encoded as uint8 (0 = GM, 1 = GN)
  {
    inputs: [{ internalType: "uint8", name: "kind", type: "uint8" }],
    name: "greet",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },

  // views
  { inputs: [], name: "fee", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalGreets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "owner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "greetCount", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "statsOf",
    outputs: [
      { internalType: "uint256", name: "count", type: "uint256" },
      { internalType: "uint256", name: "currentStreak", type: "uint256" },
      { internalType: "uint256", name: "lastDay", type: "uint256" },
      { internalType: "bool", name: "greetedToday", type: "bool" },
      { internalType: "bool", name: "streakActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // admin
  { inputs: [{ internalType: "uint256", name: "newFee", type: "uint256" }], name: "setFee", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "newOwner", type: "address" }], name: "transferOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },

  // events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint8", name: "kind", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "dayIndex", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "streak", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "totalCount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "Greeted",
    type: "event",
  },
] as const;

// Kind enum values matching the contract.
export const GM = 0;
export const GN = 1;
