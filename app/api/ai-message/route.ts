// app/api/ai-message/route.ts
// Generates a short, personal time-capsule letter. This route is gated by the
// x402 payment middleware (see middleware.ts) — it only runs after the buyer's
// USDC payment is verified, so each successful call is a paid request.
//
// Provider-agnostic: calls any OpenAI-compatible Chat Completions endpoint.
// Requires env: AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL).

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

function clamp(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

export async function POST(req: Request) {
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
      return NextResponse.json(
        { error: "Empty AI response" },
        { status: 502 },
      );
    }
    return NextResponse.json({ message });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "AI request error" },
      { status: 502 },
    );
  }
}
