// app/api/ipfs/upload/route.ts
// Server-side endpoint that uploads JSON payloads to Pinata IPFS.
// Keeps PINATA_JWT off the client; the client posts JSON here and gets a CID back.

import { NextResponse } from "next/server";

// Force Node.js runtime so FormData / Blob / fetch work consistently.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "PINATA_JWT not configured on server" },
      { status: 500 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const formData = new FormData();
    formData.append("file", blob, `capsule-${Date.now()}.json`);
    formData.append("network", "public");

    const response = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Pinata responded ${response.status}: ${errorBody}` },
        { status: 502 },
      );
    }

    const result = (await response.json()) as {
      data?: { cid?: string; id?: string; name?: string };
    };
    const cid = result.data?.cid;
    if (!cid) {
      return NextResponse.json(
        { error: `No CID in Pinata response: ${JSON.stringify(result)}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ cid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 },
    );
  }
}
