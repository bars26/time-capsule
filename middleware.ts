// middleware.ts
// x402 payment gate for paid API routes. Any request to a matched route without
// a valid payment gets HTTP 402 + payment instructions; once the buyer pays
// (USDC on Base, verified by the CDP facilitator) the request reaches the route.
//
// The Builder Code extension tags each payment so the activity is attributed to
// this app on base.dev (same code used for capsule/GM-GN txs: bc_sfeb71ad).
//
// Requires env: CDP_API_KEY_ID, CDP_API_KEY_SECRET (CDP facilitator auth),
// and optionally X402_PAY_TO (USDC receiving wallet).

import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";
import {
  BUILDER_CODE,
  declareBuilderCodeExtension,
} from "@x402/extensions/builder-code";

// USDC receiving wallet (defaults to the app's Base Account / smart wallet,
// same address that receives swap fees). Override with X402_PAY_TO if desired.
const payTo = (process.env.X402_PAY_TO ||
  "0x9f417535486848942add6CF58Ac7E841976bfD3B") as `0x${string}`;

// Base Builder Code for onchain attribution (matches lib/contract.ts).
const BUILDER_CODE_ID = "bc_sfeb71ad";

// CDP facilitator (Base mainnet). Reads CDP_API_KEY_ID / CDP_API_KEY_SECRET.
const facilitatorClient = new HTTPFacilitatorClient(facilitator);

const server = new x402ResourceServer(facilitatorClient).register(
  "eip155:8453", // Base mainnet
  new ExactEvmScheme(),
);

export const middleware = paymentProxy(
  {
    "/api/ai-message": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.05", // flat price per AI message
          network: "eip155:8453",
          payTo,
        },
      ],
      description: "AI-written time capsule letter",
      mimeType: "application/json",
      extensions: {
        [BUILDER_CODE]: declareBuilderCodeExtension(BUILDER_CODE_ID),
      },
    },
  },
  server,
);

export const config = {
  // Only gate the paid endpoint; everything else is untouched.
  matcher: ["/api/ai-message"],
};
