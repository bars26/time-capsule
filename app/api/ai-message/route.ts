// app/api/ai-message/route.ts
// AI-written time-capsule letter, gated by x402 payment via `withX402`.
//
// Why withX402 (route wrapper) instead of middleware:
//  - Next.js middleware runs on the Edge runtime, which can't load the x402
//    server packages (Node-only modules like @x402/extensions/bazaar). The
//    route handler runs on the Node runtime, so it works on Vercel.
//  - withX402 only SETTLES the USDC payment if the handler returns success
//    (status < 400). If the AI call fails, the user is NOT charged.
//
// Requires env: CDP_API_KEY_ID, CDP_API_KEY_SECRET (facilitator auth),
// X402_PAY_TO (USDC receiver), AI_API_KEY (and optional AI_BASE_URL, AI_MODEL).

import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";
import {
  BUILDER_CODE,
  declareBuilderCodeExtension,
} from "@x402/extensions/builder-code";

export const runtime = "nodejs";

const payTo = (process.env.X402_PAY_TO ||
  "0x9f417535486848942add6CF58Ac7E841976bfD3B") as `0x${string}`;
const BUILDER_CODE_ID = "bc_sfeb71ad";

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

// CDP facilitator (Base mainnet). Reads CDP_API_KEY_ID / CDP_API_KEY_SECRET.
const facilitatorClient = new HTTPFacilitatorClient(facilitator);
const server = new x402ResourceServer(facilitatorClient).register(
  "eip155:8453",
  new ExactEvmScheme(),
);

function clamp(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

// The actual work. Runs only after payment authorization is verified;
// payment is settled by withX402 only if this returns status < 400.
async function handler(req: NextRequest): Promise<NextResponse> {
  const key = process.env.AI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI is not configured (missing AI_API_KEY)." },
      { status: 500 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const language = body.language === "en" ? "English" : "Turkish";
  const tone = clamp(body.tone, 40) || "heartfelt";
  const recipient = clamp(body.recipient, 60) || "my future self";
  const occasion = clamp(body.occasion, 80);
  const notes = clamp(body.notes, 600);

  const system =
    `You write short, ${tone}, personal time-capsule letters meant to be ` +
    `unlocked in the future. Write ONLY the letter body in ${language}, ` +
    `roughly 80-160 words, warm and specific. No preamble, no markdown, ` +
    `no quotes around it.`;
  const user =
    `Recipient: ${recipient}\n` +
    `Occasion: ${occasion || "—"}\n` +
    `Sender's notes/keywords: ${notes || "—"}\n` +
    `Write the letter now.`;

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 400,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return NextResponse.json(
        { error: "AI request failed", detail },
        { status: 502 },
      );
    }

    const data = await res.json();
    const message: string =
      data?.choices?.[0]?.message?.content?.trim?.() ?? "";
    if (!message) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }
    return NextResponse.json({ message });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "AI request error" },
      { status: 502 },
    );
  }
}

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: "$0.05",
      network: "eip155:8453",
      payTo,
    },
    description: "AI-written time capsule letter",
    mimeType: "application/json",
    extensions: {
      [BUILDER_CODE]: declareBuilderCodeExtension(BUILDER_CODE_ID),
    },
  },
  server,
);
