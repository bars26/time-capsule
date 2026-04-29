// lib/ipfs.ts
// Client-side helpers for IPFS upload and fetch.
// Upload goes through our own /api/ipfs/upload route so the PINATA_JWT stays
// on the server and never reaches the browser. Fetch uses Pinata's public
// gateway (no auth required for public uploads).

const GATEWAY = "https://gateway.pinata.cloud/ipfs";

/**
 * Upload an arbitrary JSON-serializable payload to IPFS.
 * Returns the resulting CID (IPFS content identifier).
 */
export async function uploadToIPFS(payload: unknown): Promise<string> {
  const response = await fetch("/api/ipfs/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IPFS upload failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { cid?: string; error?: string };
  if (!data.cid) {
    throw new Error(
      `IPFS upload returned no CID: ${data.error ?? "unknown error"}`,
    );
  }
  return data.cid;
}

/**
 * Fetch a JSON object from IPFS via the public gateway.
 * The CID must point to JSON content uploaded as "public" (default for our route).
 */
export async function fetchFromIPFS<T>(cid: string): Promise<T> {
  const response = await fetch(`${GATEWAY}/${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS fetch failed (${response.status}) for CID ${cid}`);
  }
  return (await response.json()) as T;
}
