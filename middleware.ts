// middleware.ts
// Intentionally a no-op. x402 payment gating moved to the route handler
// (app/api/ai-message/route.ts via withX402) because Next.js middleware runs on
// the Edge runtime, which can't load the Node-only x402 server packages.
// Kept as an empty matcher so nothing runs here. Safe to delete entirely.

import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  // Empty matcher → this middleware never runs.
  matcher: [] as string[],
};
