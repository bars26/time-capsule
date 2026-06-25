// app/components/AiMessageButton.tsx
// "Write with AI" button. Calls the x402-gated /api/ai-message endpoint using
// the connected wallet to pay $0.05 USDC (gasless EIP-3009 authorization — the
// user signs a typed-data message, no on-chain gas). The generated letter is
// returned and handed back via onResult().

"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toAccount } from "viem/accounts";
import { useLocale } from "next-intl";

// x402 client SDK
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

type Ctx = {
  tone?: string;
  recipient?: string;
  occasion?: string;
  notes?: string;
};

export default function AiMessageButton({
  getContext,
  onResult,
  disabled,
}: {
  getContext: () => Ctx;
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const tr = useLocale().startsWith("tr");
  const t = (en: string, trText: string) => (tr ? trText : en);

  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!walletClient) {
      setError(t("Connect your wallet first.", "Önce cüzdanını bağla."));
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Adapt the connected wallet into a viem account that signs via the
      // wallet (typed-data signing is what EIP-3009 / x402 needs).
      const account = toAccount({
        address: walletClient.account.address,
        async signMessage({ message }) {
          return walletClient.signMessage({
            account: walletClient.account,
            message,
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async signTypedData(typedData: any) {
          return walletClient.signTypedData({
            account: walletClient.account,
            ...typedData,
          });
        },
        async signTransaction() {
          throw new Error("signTransaction not supported for x402 payments");
        },
      });

      const client = new x402Client();
      registerExactEvmScheme(client, { signer: account });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const ctx = getContext();
      const res = await fetchWithPayment("/api/ai-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ctx, language: tr ? "tr" : "en" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t("AI request failed", "İstek başarısız"));
      }
      if (data?.message) onResult(String(data.message));
    } catch (e) {
      const msg =
        (e as { shortMessage?: string })?.shortMessage ||
        (e as Error)?.message ||
        t("Something went wrong", "Bir şeyler ters gitti");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={run}
        disabled={disabled || loading || !isConnected}
        className="button-secondary"
        style={{ width: "100%", display: "flex", justifyContent: "center", gap: 8 }}
      >
        {loading
          ? t("Writing… (confirm payment)", "Yazılıyor… (ödemeyi onayla)")
          : t("✨ Write with AI · $0.05", "✨ AI ile yaz · $0.05")}
      </button>
      <p className="dim" style={{ fontSize: 11, marginTop: 6, textAlign: "center" }}>
        {t(
          "Pays $0.05 USDC (gasless). Replaces the message field.",
          "$0.05 USDC öder (gassız). Mesaj alanını doldurur.",
        )}
      </p>
      {error && (
        <p
          style={{
            color: "var(--error)",
            fontSize: 12,
            marginTop: 6,
            wordBreak: "break-word",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
