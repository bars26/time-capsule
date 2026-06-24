// app/gm/page.tsx
// Daily onchain GM / GN greeter. Each tap is a cheap Base transaction that
// updates the user's streak and (optionally) pays a small fee to the contract
// owner. The Builder Code suffix attributes the activity to the app.

"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { formatEther } from "viem";
import { useLocale } from "next-intl";
import Link from "next/link";

import { BUILDER_CODE_SUFFIX } from "../../lib/contract";
import {
  GMGN_ADDRESS,
  GMGN_ABI,
  GMGN_READY,
  GM,
  GN,
} from "../../lib/gmgn";

export default function GmPage() {
  const tr = useLocale().startsWith("tr");
  const t = (en: string, trText: string) => (tr ? trText : en);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [pending, setPending] = useState<null | "GM" | "GN">(null);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const enabled = GMGN_READY && isConnected;

  const { data: fee } = useReadContract({
    address: GMGN_ADDRESS,
    abi: GMGN_ABI,
    functionName: "fee",
    chainId: base.id,
    query: { enabled: GMGN_READY },
  });

  const { data: total } = useReadContract({
    address: GMGN_ADDRESS,
    abi: GMGN_ABI,
    functionName: "totalGreets",
    chainId: base.id,
    query: { enabled: GMGN_READY },
  });

  const { data: stats, refetch: refetchStats } = useReadContract({
    address: GMGN_ADDRESS,
    abi: GMGN_ABI,
    functionName: "statsOf",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: enabled && !!address },
  });

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  // Refetch stats once the greeting confirms.
  useEffect(() => {
    if (confirmed && pending) {
      setPending(null);
      refetchStats();
    }
  }, [confirmed, pending, refetchStats]);

  const count = stats ? Number(stats[0]) : 0;
  const streak = stats ? Number(stats[1]) : 0;
  const greetedToday = stats ? Boolean(stats[3]) : false;
  const streakActive = stats ? Boolean(stats[4]) : false;
  const shownStreak = streakActive ? streak : 0;

  const greet = async (kind: typeof GM | typeof GN, label: "GM" | "GN") => {
    if (!enabled) return;
    setError("");
    setPending(label);
    setTxHash(null);
    try {
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }
      const hash = await writeContractAsync({
        address: GMGN_ADDRESS,
        abi: GMGN_ABI,
        functionName: "greet",
        args: [kind],
        value: (fee as bigint) ?? BigInt(0),
        chainId: base.id,
        dataSuffix: BUILDER_CODE_SUFFIX,
      });
      setTxHash(hash);
    } catch (e) {
      const msg =
        (e as { shortMessage?: string }).shortMessage ||
        (e as Error).message ||
        t("Something went wrong", "Bir şeyler ters gitti");
      setError(msg);
      setPending(null);
    }
  };

  return (
    <main
      className="container-narrow"
      style={{ paddingTop: 32, paddingBottom: 80 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 28, margin: 0 }}>GM / GN ☀️🌙</h2>
        {isConnected && (
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="none"
          />
        )}
      </div>

      {!GMGN_READY ? (
        <div
          className="muted"
          style={{
            textAlign: "center",
            padding: "40px 16px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            lineHeight: 1.6,
          }}
        >
          {t(
            "Coming soon — the GM/GN contract isn't deployed yet.",
            "Yakında — GM/GN kontratı henüz deploy edilmedi.",
          )}
        </div>
      ) : !isConnected ? (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <p style={{ marginBottom: 24 }}>
            {t(
              "Connect your wallet to say GM/GN onchain.",
              "Onchain GM/GN demek için cüzdanını bağla.",
            )}
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Stat label={t("Streak", "Seri")} value={`${shownStreak}🔥`} />
            <Stat label={t("Your GMs", "Senin")} value={String(count)} />
            <Stat
              label={t("Total", "Toplam")}
              value={total != null ? String(Number(total)) : "—"}
            />
          </div>

          {greetedToday && (
            <p
              className="muted"
              style={{ textAlign: "center", marginBottom: 16, fontSize: 13 }}
            >
              {t(
                "You've already greeted today — come back tomorrow to grow your streak.",
                "Bugün zaten selam verdin — serini büyütmek için yarın tekrar gel.",
              )}
            </p>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              className="button-primary"
              style={{ flex: 1, fontSize: 18, padding: "16px 0" }}
              disabled={pending !== null}
              onClick={() => greet(GM, "GM")}
            >
              {pending === "GM"
                ? t("Saying GM…", "GM deniyor…")
                : "☀️ GM"}
            </button>
            <button
              type="button"
              className="button-secondary"
              style={{ flex: 1, fontSize: 18, padding: "16px 0" }}
              disabled={pending !== null}
              onClick={() => greet(GN, "GN")}
            >
              {pending === "GN"
                ? t("Saying GN…", "GN deniyor…")
                : "🌙 GN"}
            </button>
          </div>

          <p
            className="dim"
            style={{ textAlign: "center", marginTop: 16, fontSize: 12 }}
          >
            {fee != null && (fee as bigint) > BigInt(0)
              ? t(
                  `Fee: ${formatEther(fee as bigint)} ETH per greeting`,
                  `Ücret: selam başına ${formatEther(fee as bigint)} ETH`,
                )
              : t("Free — you only pay gas", "Ücretsiz — sadece gas ödersin")}
          </p>

          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                marginTop: 12,
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-tertiary)",
                wordBreak: "break-all",
              }}
            >
              {t("View on Basescan", "Basescan'de görüntüle")}
            </a>
          )}

          {error && (
            <p
              style={{
                color: "var(--error)",
                marginTop: 16,
                fontSize: 13,
                padding: 12,
                background: "var(--error-soft)",
                borderRadius: "var(--radius-sm)",
                wordBreak: "break-word",
              }}
            >
              {error}
            </p>
          )}
        </>
      )}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <Link href="/" className="muted">
          ← {t("Back to capsules", "Kapsüllere dön")}
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "14px 10px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
