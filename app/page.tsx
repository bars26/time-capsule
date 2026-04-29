// app/page.tsx
// V2 create flow with Phase F polish:
//  - Re-check chain at submit time + auto-switch via switchChainAsync.
//  - datetime-local: max attribute caps year so users can't type 202666.
//  - Show tx hash + Basescan link as soon as it arrives (during confirming),
//    not just on success — so a stuck tx is never invisible.
//  - "Taking longer than usual" hint after 30s on confirming.

"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { baseSepolia, base } from "wagmi/chains";
import {
  parseEther,
  isAddress,
  createPublicClient,
  http,
  type Address,
} from "viem";
import { normalize } from "viem/ens";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { TIME_CAPSULE_ADDRESS, TIME_CAPSULE_ABI } from "../lib/contract";
import { encryptMessage } from "../lib/encryption";
import { uploadToIPFS } from "../lib/ipfs";

const COVER_EMOJIS = ["💌", "📜", "🎁", "🎂", "🌹", "🎓", "⏳", "🌙", "✨", "🎉"];
const FEE_ETH = "0.0001";
const MAX_TITLE = 50;
const MAX_MESSAGE = 1000;
const STUCK_TX_THRESHOLD_MS = 30_000;

type Step =
  | "idle"
  | "encrypting"
  | "uploading"
  | "switching"
  | "signing"
  | "confirming"
  | "success";

const baseMainnetClient = createPublicClient({
  chain: base,
  transport: http(),
});

async function resolveRecipient(input: string): Promise<Address> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Alıcı adresini gir");

  if (trimmed.startsWith("0x")) {
    if (!isAddress(trimmed)) throw new Error("Geçersiz cüzdan adresi");
    return trimmed as Address;
  }

  if (trimmed.includes(".base")) {
    const candidates = trimmed.endsWith(".eth")
      ? [trimmed]
      : [`${trimmed}.eth`, trimmed];
    for (const candidate of candidates) {
      try {
        const resolved = await baseMainnetClient.getEnsAddress({
          name: normalize(candidate),
        });
        if (resolved) return resolved;
      } catch {
        // try next candidate
      }
    }
    throw new Error(`${trimmed} çözülemedi. 0x ile başlayan adres dene.`);
  }

  throw new Error("Adres 0x ile başlamalı veya .base ile bitmeli");
}

function getMinDateTimeLocal(): string {
  // 15 minutes ahead, to leave a safe buffer over the contract's 5-min minimum.
  // Without this buffer, IPFS upload + wallet signing + chain confirmation
  // can push the actual unlock time below the contract's 5-min threshold,
  // causing UnlockTimeTooSoon revert.
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function getMaxDateTimeLocal(): string {
  const max = new Date();
  max.setFullYear(max.getFullYear() + 100);
  const tzOffsetMs = max.getTimezoneOffset() * 60_000;
  return new Date(max.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

// Outer component wraps the form in a Suspense boundary so useSearchParams
// (used for the ?to= reply pre-fill) doesn't error during static prerender.
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="container-narrow" style={{ paddingTop: 80 }}>
          <p className="muted">Yükleniyor...</p>
        </main>
      }
    >
      <Home />
    </Suspense>
  );
}

function Home() {
  // Read chain from BOTH sources because some wallet connectors leave one
  // stale after a manual chain change in the wallet UI. If either source
  // says we're on Base Sepolia, treat the form as on the correct chain;
  // submit-time switchChainAsync handles any remaining mismatch.
  const { address, isConnected, chain: accountChain } = useAccount();
  const chainId = useChainId();
  const detectedChainId = accountChain?.id ?? chainId;
  const { switchChain, switchChainAsync } = useSwitchChain();
  const onCorrectChain = detectedChainId === baseSepolia.id;

  // Reply flow: when arriving via /?to=0x... pre-fill the recipient.
  const searchParams = useSearchParams();
  const replyTo = searchParams?.get("to") ?? "";

  // Form state
  const [recipientMode, setRecipientMode] = useState<"self" | "other">("self");
  const [recipientInput, setRecipientInput] = useState("");
  const [coverEmoji, setCoverEmoji] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [unlockDateTime, setUnlockDateTime] = useState("");

  // If arrived via reply link, prefill recipient once.
  useEffect(() => {
    if (replyTo) {
      setRecipientMode("other");
      setRecipientInput(replyTo);
    }
  }, [replyTo]);

  // Submission state
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [confirmingSince, setConfirmingSince] = useState<number | null>(null);
  const [stuckHint, setStuckHint] = useState(false);

  const {
    writeContract,
    data: hash,
    isPending: isWalletPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const {
    isSuccess: isReceiptFetched,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  // hash arrives → move to confirming
  useEffect(() => {
    if (hash && step === "signing") {
      setStep("confirming");
      setConfirmingSince(Date.now());
    }
  }, [hash, step]);

  // Receipt arrived. Distinguish on-chain success vs revert. Reverted txs
  // also produce a receipt — we must NOT treat them as success.
  useEffect(() => {
    if (!isReceiptFetched || !receipt || step !== "confirming") return;
    if (receipt.status === "success") {
      setStep("success");
      setStuckHint(false);
      setConfirmingSince(null);
    } else if (receipt.status === "reverted") {
      setError(
        "İşlem zincirde reddedildi. En sık sebep: açılış zamanı yeterince ileride değil. " +
          "En az 15 dakika sonrasını seç ve tekrar dene.",
      );
      setStep("idle");
      setStuckHint(false);
      setConfirmingSince(null);
    }
  }, [isReceiptFetched, receipt, step]);

  // After 30s of confirming, surface a "taking longer than usual" hint.
  useEffect(() => {
    if (step !== "confirming" || !confirmingSince) return;
    const timeout = setTimeout(() => setStuckHint(true), STUCK_TX_THRESHOLD_MS);
    return () => clearTimeout(timeout);
  }, [step, confirmingSince]);

  // Surface wallet rejection / write errors.
  useEffect(() => {
    if (writeError) {
      const msg =
        (writeError as { shortMessage?: string }).shortMessage ||
        writeError.message ||
        "Cüzdan onayı reddedildi";
      setError(msg);
      setStep("idle");
    }
  }, [writeError]);

  const reset = () => {
    setRecipientMode("self");
    setRecipientInput("");
    setCoverEmoji("");
    setTitle("");
    setMessage("");
    setUnlockDateTime("");
    setStep("idle");
    setError("");
    setConfirmingSince(null);
    setStuckHint(false);
    resetWrite();
  };

  const isProcessing = step !== "idle" && step !== "success";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setError("");

    if (!message.trim()) {
      setError("Mesaj boş olamaz");
      return;
    }
    if (!unlockDateTime) {
      setError("Açılış tarihi seç");
      return;
    }
    if (title.length > MAX_TITLE) {
      setError(`Başlık ${MAX_TITLE} karakteri geçemez`);
      return;
    }

    // Always call switchChainAsync — it's a no-op when already on the chain
    // and otherwise pops the wallet's switch dialog. Bypasses any stale
    // chainId state in either useChainId or useAccount().chain.
    try {
      setStep("switching");
      await switchChainAsync({ chainId: baseSepolia.id });
    } catch {
      setError(
        "Base Sepolia ağına geçmen lazım. Cüzdan onayını reddettin veya ağ değiştirilemedi.",
      );
      setStep("idle");
      return;
    }

    let recipientAddr: Address;
    if (recipientMode === "self") {
      recipientAddr = address;
    } else {
      try {
        recipientAddr = await resolveRecipient(recipientInput);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Alıcı çözülemedi");
        setStep("idle");
        return;
      }
    }

    try {
      setStep("encrypting");
      const encrypted = await encryptMessage(message);

      setStep("uploading");
      const cid = await uploadToIPFS(encrypted);

      const unlockTimestamp = Math.floor(
        new Date(unlockDateTime).getTime() / 1000,
      );

      setStep("signing");
      writeContract({
        address: TIME_CAPSULE_ADDRESS,
        abi: TIME_CAPSULE_ABI,
        functionName: "createCapsule",
        args: [recipientAddr, cid, BigInt(unlockTimestamp), title, coverEmoji],
        value: parseEther(FEE_ETH),
        chainId: baseSepolia.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      setStep("idle");
    }
  };

  // ---------- Render branches ----------

  if (!isConnected) {
    return (
      <main
        className="container-narrow"
        style={{ paddingTop: 80, textAlign: "center" }}
      >
        <div className="capsule-hero-wrap" aria-hidden="true">
          <div className="capsule-hero" />
        </div>
        <h1 style={{ marginBottom: 16 }}>Time Capsule</h1>
        <p
          style={{
            marginBottom: 32,
            fontSize: 17,
            lineHeight: 1.55,
            maxWidth: 420,
            marginInline: "auto",
          }}
        >
          Geleceğe bir mesaj kilitle. Kendine veya başkasına. Base ağında
          onchain, şifreli, kalıcı.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ConnectButton />
        </div>
        <p className="dim" style={{ marginTop: 16, fontSize: 13 }}>
          Başlamak için cüzdanını bağla. Ücret: {FEE_ETH} ETH (Base Sepolia
          testnet).
        </p>
      </main>
    );
  }

  if (!onCorrectChain && step === "idle") {
    return (
      <main className="container-narrow" style={{ paddingTop: 80 }}>
        <h2 style={{ marginBottom: 16 }}>Yanlış ağ</h2>
        <p style={{ marginBottom: 24 }}>
          Bu uygulama Base Sepolia testnet&apos;inde çalışıyor.
        </p>
        <button
          type="button"
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          className="button-primary"
        >
          Base Sepolia&apos;ya geç
        </button>
        <div style={{ marginTop: 16 }}>
          <ConnectButton />
        </div>
      </main>
    );
  }

  if (step === "success") {
    return (
      <main
        className="container-narrow"
        style={{ paddingTop: 80, textAlign: "center" }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{coverEmoji || "🔒"}</div>
        <h2 style={{ marginBottom: 12 }}>Kapsül kilitlendi</h2>
        <p style={{ marginBottom: 4 }}>
          <strong>{new Date(unlockDateTime).toLocaleString("tr-TR")}</strong>
        </p>
        <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
          tarihinde açılacak
        </p>
        {hash && (
          <a
            href={`https://sepolia.basescan.org/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              wordBreak: "break-all",
              display: "block",
              marginBottom: 24,
              color: "var(--text-tertiary)",
            }}
          >
            View on Basescan ↗
          </a>
        )}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button type="button" onClick={reset} className="button-primary">
            Yeni kapsül
          </button>
          <Link href="/capsules" className="button-secondary">
            Kapsüllerim
          </Link>
        </div>
      </main>
    );
  }

  // ---------- Form ----------

  return (
    <main className="container-narrow" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 28, margin: 0 }}>Yeni kapsül</h2>
        <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
      </div>

      <form onSubmit={handleSubmit}>
        <label className="label">Kime?</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setRecipientMode("self")}
            className={recipientMode === "self" ? "button-primary" : "button-secondary"}
            style={{ flex: 1 }}
            disabled={isProcessing}
          >
            Kendime
          </button>
          <button
            type="button"
            onClick={() => setRecipientMode("other")}
            className={recipientMode === "other" ? "button-primary" : "button-secondary"}
            style={{ flex: 1 }}
            disabled={isProcessing}
          >
            Başkasına
          </button>
        </div>

        {recipientMode === "other" && (
          <input
            type="text"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            placeholder="0xABC...123 veya alice.base"
            className="input"
            disabled={isProcessing}
            style={{ marginBottom: 16 }}
          />
        )}

        <label className="label">Kapak (opsiyonel)</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {COVER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setCoverEmoji(coverEmoji === emoji ? "" : emoji)}
              disabled={isProcessing}
              style={{
                width: 40,
                height: 40,
                fontSize: 20,
                background:
                  coverEmoji === emoji ? "var(--base-blue-soft)" : "var(--surface)",
                border: `1px solid ${
                  coverEmoji === emoji ? "var(--base-blue)" : "var(--border)"
                }`,
                borderRadius: "var(--radius-sm)",
                cursor: isProcessing ? "not-allowed" : "pointer",
                transition: "all 150ms ease",
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        <label className="label">
          Başlık (opsiyonel)
          <span className="dim" style={{ float: "right", fontSize: 11 }}>
            {title.length}/{MAX_TITLE}
          </span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          maxLength={MAX_TITLE}
          placeholder="Doğum günün kutlu olsun"
          className="input"
          disabled={isProcessing}
          style={{ marginBottom: 16 }}
        />

        <label className="label">
          Mesaj
          <span className="dim" style={{ float: "right", fontSize: 11 }}>
            {message.length}/{MAX_MESSAGE}
          </span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          maxLength={MAX_MESSAGE}
          placeholder="Geleceğin sana ne diyecek?"
          className="textarea"
          disabled={isProcessing}
          rows={5}
          style={{ marginBottom: 16 }}
          required
        />

        <label className="label">Açılış tarihi ve saati</label>
        <input
          type="datetime-local"
          value={unlockDateTime}
          onChange={(e) => setUnlockDateTime(e.target.value)}
          min={getMinDateTimeLocal()}
          max={getMaxDateTimeLocal()}
          className="input"
          disabled={isProcessing}
          style={{ marginBottom: 4 }}
          required
        />
        <p className="dim" style={{ fontSize: 12, marginBottom: 24 }}>
          Sağdaki takvim ikonuna tıklayarak seçebilir, elle de yazabilirsin.
          Açılış zamanı en az 15 dakika sonrası olmalı.
        </p>

        <p className="dim" style={{ fontSize: 13, marginBottom: 16 }}>
          Ücret: {FEE_ETH} ETH (Base Sepolia testnet)
        </p>

        <button
          type="submit"
          disabled={isProcessing || !message.trim() || !unlockDateTime}
          className="button-primary"
          style={{ width: "100%" }}
        >
          {step === "switching" && "Ağ değiştiriliyor..."}
          {step === "encrypting" && "Şifreleniyor..."}
          {step === "uploading" && "IPFS'e yükleniyor..."}
          {step === "signing" && "Cüzdan onayı bekleniyor..."}
          {step === "confirming" && "İşlem zincirde..."}
          {step === "idle" && "Kilitle"}
          {isWalletPending && step === "idle" && "Bekleniyor..."}
        </button>

        {/* Tx hash visible during confirming so a stuck tx is never invisible. */}
        {hash && step === "confirming" && (
          <a
            href={`https://sepolia.basescan.org/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 12,
              color: "var(--text-tertiary)",
              wordBreak: "break-all",
            }}
          >
            Basescan&apos;de gör ↗
          </a>
        )}

        {stuckHint && step === "confirming" && (
          <p
            className="muted"
            style={{
              marginTop: 12,
              fontSize: 13,
              padding: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              lineHeight: 1.5,
            }}
          >
            İşlem 30 saniyeden uzun sürdü. Yukarıdaki Basescan linkinden durumu
            kontrol edebilirsin. Cüzdandan henüz onaylamadıysan onayla, ya da
            uzun sürerse Base Sepolia ağı yoğun olabilir.
          </p>
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
            }}
          >
            {error}
          </p>
        )}
      </form>

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <Link href="/capsules" className="muted">
          Kapsüllerim →
        </Link>
      </div>
    </main>
  );
}
