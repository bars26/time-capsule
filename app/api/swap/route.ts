// app/api/swap/route.ts
// Server-side proxy to the KyberSwap Aggregator API.
//
// Why a proxy instead of calling KyberSwap directly from the browser:
//  1. We inject the affiliate-fee params (feeReceiver / feeAmount) here so the
//     client can't remove them — the fee always goes to SWAP_FEE_RECIPIENT.
//  2. We attach the x-client-id header (better rate limits) without exposing it.
//  3. Avoids any CORS surprises.
//
// GET  /api/swap?tokenIn=..&tokenOut=..&amountIn=..   -> route quote
// POST /api/swap  body: { routeSummary, sender, recipient }  -> encoded calldata

import { NextResponse } from "next/server";
import {
  KYBER_CHAIN,
  KYBER_CLIENT_ID,
  SWAP_FEE_BPS,
  SWAP_FEE_RECIPIENT,
  SWAP_SLIPPAGE_BPS,
} from "../../../lib/swap";

const BASE_URL = `https://aggregator-api.kyberswap.com/${KYBER_CHAIN}/api/v1`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenIn = searchParams.get("tokenIn");
  const tokenOut = searchParams.get("tokenOut");
  const amountIn = searchParams.get("amountIn");

  if (!tokenIn || !tokenOut || !amountIn || amountIn === "0") {
    return NextResponse.json(
      { code: 4001, message: "tokenIn, tokenOut and amountIn are required" },
      { status: 400 },
    );
  }

  // Fee params injected here — not trusted from the client.
  const qs = new URLSearchParams({
    tokenIn,
    tokenOut,
    amountIn,
    feeAmount: String(SWAP_FEE_BPS),
    chargeFeeBy: "currency_in",
    isInBps: "true",
    feeReceiver: SWAP_FEE_RECIPIENT,
  });

  try {
    const r = await fetch(`${BASE_URL}/routes?${qs.toString()}`, {
      headers: { "x-client-id": KYBER_CLIENT_ID },
      // Routes are time-sensitive; never cache.
      cache: "no-store",
    });
    const json = await r.json();
    return NextResponse.json(json, { status: r.status });
  } catch (err) {
    return NextResponse.json(
      { code: 5000, message: (err as Error).message || "quote failed" },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  let body: {
    routeSummary?: unknown;
    sender?: string;
    recipient?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 4002, message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const { routeSummary, sender, recipient } = body;
  if (!routeSummary || !sender || !recipient) {
    return NextResponse.json(
      { code: 4002, message: "routeSummary, sender and recipient are required" },
      { status: 400 },
    );
  }

  try {
    const r = await fetch(`${BASE_URL}/route/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": KYBER_CLIENT_ID,
      },
      cache: "no-store",
      body: JSON.stringify({
        routeSummary,
        sender,
        recipient,
        slippageTolerance: SWAP_SLIPPAGE_BPS,
        source: KYBER_CLIENT_ID,
      }),
    });
    const json = await r.json();
    return NextResponse.json(json, { status: r.status });
  } catch (err) {
    return NextResponse.json(
      { code: 5000, message: (err as Error).message || "build failed" },
      { status: 502 },
    );
  }
}
