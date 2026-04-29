// app/test/page.tsx
// V2 POC: encryption + IPFS round-trip self-test.
// Visit /test in dev to verify the encryption + Pinata pipeline before wiring
// it into the real capsule-creation UI.

"use client";

import { useState } from "react";
import {
  encryptMessage,
  decryptMessage,
  type EncryptedPayload,
} from "../../lib/encryption";
import { uploadToIPFS, fetchFromIPFS } from "../../lib/ipfs";

export default function POCTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const log = (msg: string) =>
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${msg}`]);

  const runPOC = async () => {
    setRunning(true);
    setLogs([]);

    try {
      const message = "Merhaba V2! Geleceğe bir test mesajı.";
      log(`Original message: "${message}"`);

      log("Step 1: Encrypting with AES-256-GCM...");
      const encrypted = await encryptMessage(message);
      log(`  ciphertext: ${encrypted.ciphertext.slice(0, 40)}...`);
      log(`  key: ${encrypted.key.slice(0, 40)}...`);
      log(`  iv: ${encrypted.iv.slice(0, 24)}...`);

      log("Step 2: Uploading encrypted blob to IPFS via Pinata...");
      const cid = await uploadToIPFS(encrypted);
      log(`  CID: ${cid}`);
      log(`  Gateway URL: https://gateway.pinata.cloud/ipfs/${cid}`);

      log("Step 3: Fetching back from public gateway...");
      const fetched = await fetchFromIPFS<EncryptedPayload>(cid);
      const matches =
        fetched.ciphertext === encrypted.ciphertext &&
        fetched.key === encrypted.key &&
        fetched.iv === encrypted.iv;
      log(`  All fields match: ${matches}`);

      log("Step 4: Decrypting...");
      const decrypted = await decryptMessage(fetched);
      log(`  Decrypted: "${decrypted}"`);

      log("");
      if (decrypted === message) {
        log("POC PASSED — round-trip successful");
      } else {
        log("POC FAILED — decrypted text does not match original");
      }
    } catch (err) {
      log("");
      log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    setRunning(false);
  };

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>V2 POC Test</h1>
      <p style={{ opacity: 0.7, marginBottom: 24, fontSize: 15 }}>
        Encrypt → IPFS upload → IPFS fetch → Decrypt round-trip kontrolü.
      </p>

      <button
        onClick={runPOC}
        disabled={running}
        style={{
          padding: "12px 24px",
          background: "#0052FF",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: running ? "wait" : "pointer",
          marginBottom: 24,
          opacity: running ? 0.6 : 1,
        }}
      >
        {running ? "Running..." : "Run POC"}
      </button>

      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: 16,
          borderRadius: 8,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          fontSize: 12,
          lineHeight: 1.7,
          minHeight: 120,
          whiteSpace: "pre-wrap",
        }}
      >
        {logs.length === 0 ? (
          <span style={{ opacity: 0.4 }}>
            &ldquo;Run POC&rdquo; butonuna bas...
          </span>
        ) : (
          logs.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </main>
  );
}
