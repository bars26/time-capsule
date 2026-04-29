// app/c/[id]/page.tsx
// Phase F polish: mark capsule as opened in localStorage on successful decrypt
// so it falls out of the "Açılmaya Hazır" tab on the list page.

"use client";

import { useEffect, useState, use } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import type { Address } from "viem";
import { TIME_CAPSULE_ADDRESS, TIME_CAPSULE_ABI } from "../../../lib/contract";
import { fetchFromIPFS } from "../../../lib/ipfs";
import {
  decryptMessage,
  type EncryptedPayload,
} from "../../../lib/encryption";
import { markCapsuleOpened, isCapsuleOpened } from "../../../lib/opened";

const HOUR = 60 * 60;

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}dk ${s}sn`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}sa ${m}dk`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}g ${h}sa`;
}

type Params = Promise<{ id: string }>;

export default function CapsuleDetailPage({ params }: { params: Params }) {
  const { id } = use(params);
  const { address, isConnected } = useAccount();

  let capsuleId: bigint | null;
  try {
    capsuleId = BigInt(id);
  } catch {
    capsuleId = null;
  }

  const { data, isLoading, refetch } = useReadContract({
    abi: TIME_CAPSULE_ABI,
    address: TIME_CAPSULE_ADDRESS,
    functionName: "getCapsule",
    args: capsuleId !== null ? [capsuleId] : undefined,
    query: { enabled: capsuleId !== null },
  });

  // Live countdown
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, []);

  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // If we already opened this capsule before, restore the opened state on mount
  // — but we don't restore the plaintext (that requires re-fetching IPFS).
  // We just show the "Aç" button as usual; the localStorage flag is mainly for
  // the list page's "Açılmaya Hazır" filter.
  const [previouslyOpened, setPreviouslyOpened] = useState(false);
  useEffect(() => {
    if (address && capsuleId !== null) {
      setPreviouslyOpened(isCapsuleOpened(address, capsuleId));
    }
  }, [address, capsuleId]);

  const {
    writeContract: hideWrite,
    data: hideHash,
    isPending: hideIsPending,
    error: hideError,
  } = useWriteContract();
  const { isLoading: hideConfirming, isSuccess: hideConfirmed } =
    useWaitForTransactionReceipt({ hash: hideHash });

  useEffect(() => {
    if (hideConfirmed) refetch();
  }, [hideConfirmed, refetch]);

  // Stale decrypted cleanup. MUST stay before any early return so this hook
  // is called on every render — keeps hook order stable across loading,
  // not-found, and data-present states (Rules of Hooks).
  useEffect(() => {
    if (!data || !address) return;
    const [s, r, , ut, , h] = data as readonly [
      Address,
      Address,
      string,
      bigint,
      bigint,
      boolean,
      string,
      string,
    ];
    const meLower = address.toLowerCase();
    const isS = meLower === s.toLowerCase();
    const isR = meLower === r.toLowerCase();
    const isUnl = Number(ut) <= Math.floor(Date.now() / 1000);
    const canView = (isS && !isR) || (isR && isUnl && !h);
    if (!canView && decrypted !== null) {
      setDecrypted(null);
    }
  }, [data, address, decrypted, now]);

  if (capsuleId === null) {
    return (
      <main className="container-narrow">
        <h2>Geçersiz kapsül ID</h2>
        <Link href="/capsules" className="button-secondary">
          ← Tüm kapsüller
        </Link>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="container-narrow">
        <p className="muted">Yükleniyor...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container-narrow">
        <h2 style={{ marginBottom: 16 }}>Kapsül bulunamadı</h2>
        <p className="muted" style={{ marginBottom: 24 }}>
          ID #{id} için bir kapsül yok.
        </p>
        <Link href="/capsules" className="button-secondary">
          ← Tüm kapsüller
        </Link>
      </main>
    );
  }

  const [
    sender,
    recipient,
    ipfsHash,
    unlockTime,
    createdAt,
    isHidden,
    title,
    coverEmoji,
  ] = data as readonly [
    Address,
    Address,
    string,
    bigint,
    bigint,
    boolean,
    string,
    string,
  ];

  const unlockSeconds = Number(unlockTime);
  const createdSeconds = Number(createdAt);
  const secondsToUnlock = unlockSeconds - now;
  const isUnlocked = secondsToUnlock <= 0;
  const isSender = !!address && address.toLowerCase() === sender.toLowerCase();
  const isRecipient =
    !!address && address.toLowerCase() === recipient.toLowerCase();
  const isSelf = sender.toLowerCase() === recipient.toLowerCase();
  const canHide =
    isSender && !isHidden && now - createdSeconds <= HOUR;
  const hideRemainingSeconds = HOUR - (now - createdSeconds);

  const handleDecrypt = async () => {
    setDecrypting(true);
    setDecryptError(null);
    try {
      const payload = await fetchFromIPFS<EncryptedPayload>(ipfsHash);
      const text = await decryptMessage(payload);
      setDecrypted(text);
      // Only mark opened when the viewer is actually the recipient. A sender
      // peeking at their own message shouldn't change recipient-side state.
      if (isRecipient && address && capsuleId !== null) {
        markCapsuleOpened(address, capsuleId);
        setPreviouslyOpened(true);
      }
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : String(err));
    }
    setDecrypting(false);
  };

  const handleHide = () => {
    if (capsuleId === null) return;
    hideWrite({
      abi: TIME_CAPSULE_ABI,
      address: TIME_CAPSULE_ADDRESS,
      functionName: "hideCapsule",
      args: [capsuleId],
    });
  };

  const unlockDate = new Date(unlockSeconds * 1000);
  const createdDate = new Date(createdSeconds * 1000);

  return (
    <main className="container-narrow" style={{ paddingTop: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 12,
        }}
      >
        <Link href="/" className="brand-link">
          <span className="capsule-logo" />
          <span className="brand-text">Time Capsule</span>
        </Link>
        {isConnected && (
          <ConnectButton
            showBalance={false}
            accountStatus="avatar"
            chainStatus="none"
          />
        )}
      </div>
      <Link
        href="/capsules"
        className="muted"
        style={{ fontSize: 14, display: "inline-block", marginBottom: 24 }}
      >
        ← Tüm kapsüller
      </Link>

      <div
        className="surface"
        style={{ textAlign: "center", padding: 32, marginBottom: 16 }}
      >
        <div
          style={{
            fontSize: 56,
            marginBottom: 16,
            opacity: isHidden ? 0.3 : 1,
            lineHeight: 1,
          }}
        >
          {coverEmoji || (isUnlocked ? "🔓" : "🔒")}
        </div>

        <h2 style={{ marginBottom: 12 }}>{title || `Kapsül #${id}`}</h2>

        {isHidden && (
          <span className="badge badge-hidden" style={{ marginBottom: 16 }}>
            Geri Alındı
          </span>
        )}

        {!isHidden && previouslyOpened && !decrypted && (
          <span className="badge badge-opened" style={{ marginBottom: 16 }}>
            Daha önce açıldı
          </span>
        )}

        {/* Locked: countdown for everyone */}
        {!isHidden && !isUnlocked && (
          <>
            <p className="muted" style={{ marginBottom: 4, fontSize: 14 }}>
              {unlockDate.toLocaleString("tr-TR")}
            </p>
            <p
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--base-blue-light)",
                marginTop: 16,
                marginBottom: 16,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatDuration(secondsToUnlock)}
            </p>
          </>
        )}

        {/* Unlocked: show open-date label */}
        {!isHidden && isUnlocked && !decrypted && (
          <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>
            {unlockDate.toLocaleString("tr-TR")} tarihinde açıldı
          </p>
        )}

        {/* Decrypt UI.
            Rule:
              - Pure sender (isSender && !isRecipient): can always peek — they
                wrote a gift to someone else and may want to remember the text.
              - Recipient (including self-capsules where sender == recipient):
                must wait for unlock and respect isHidden. This preserves the
                "kendime gelecekten sürpriz" intent.
              - Anyone else: no access. */}
        {!decrypted && (() => {
          if (!isConnected) {
            return (
              <>
                <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
                  Açmak için cüzdanını bağla
                </p>
                <ConnectButton />
              </>
            );
          }

          // Pure sender peeking at a gift to someone else.
          if (isSender && !isRecipient) {
            return (
              <>
                <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  {isHidden
                    ? "Bu kapsülü geri aldın. Yine de içeriğini görebilirsin."
                    : "Sen yazdın, içeriği istediğin zaman görebilirsin."}
                </p>
                <button
                  type="button"
                  onClick={handleDecrypt}
                  disabled={decrypting}
                  className="button-primary"
                >
                  {decrypting ? "Açılıyor..." : "İçeriği Gör"}
                </button>
              </>
            );
          }

          // Recipient (or self-recipient) — only when unlocked and not hidden.
          if (isRecipient && isUnlocked && !isHidden) {
            return (
              <button
                type="button"
                onClick={handleDecrypt}
                disabled={decrypting}
                className="button-primary"
              >
                {decrypting
                  ? "Açılıyor..."
                  : previouslyOpened
                    ? "Tekrar Aç"
                    : "Aç"}
              </button>
            );
          }

          // Self-capsule still locked — gentle hint that the wait is intentional.
          if (isRecipient && isSender && !isUnlocked) {
            return (
              <p className="muted" style={{ fontSize: 13 }}>
                Bunu kendi gelecek hâline yazdın. Kilit zamanı gelince
                buradan açabilirsin.
              </p>
            );
          }

          // Stranger or recipient still waiting (gift case).
          return (
            <p className="muted" style={{ fontSize: 14 }}>
              Bu kapsül {shortAddr(recipient)} için kilitlendi
            </p>
          );
        })()}

        {decrypted && (
          <div
            style={{
              marginTop: 16,
              padding: 20,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              textAlign: "left",
            }}
          >
            <p
              style={{
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                fontSize: 15,
              }}
            >
              {decrypted}
            </p>
          </div>
        )}

        {decryptError && (
          <p
            style={{
              color: "var(--error)",
              fontSize: 13,
              marginTop: 12,
              padding: 12,
              background: "var(--error-soft)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {decryptError}
          </p>
        )}
      </div>

      <div className="surface" style={{ fontSize: 13, marginBottom: 16 }}>
        <AddressField label="Gönderen" addr={sender} isYou={isSender} />
        <AddressField label="Alıcı" addr={recipient} isYou={isRecipient} />
        <Field label="Oluşturma" value={createdDate.toLocaleString("tr-TR")} />
      </div>

      {/* Reply: when recipient (not sender) just opened a gift, offer to
          reply by jumping to / with the original sender prefilled. */}
      {decrypted && isRecipient && !isSender && (
        <div className="surface" style={{ marginBottom: 16 }}>
          <p
            className="muted"
            style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}
          >
            Bu kapsülü {shortAddr(sender)} sana yazdı. İstersen bir cevap kapsülü
            gönder — gelecekte açılır.
          </p>
          <Link
            href={`/?to=${sender}`}
            className="button-primary"
            style={{ display: "inline-flex", textDecoration: "none" }}
          >
            Yanıtla
          </Link>
        </div>
      )}

      {canHide && !hideConfirmed && (
        <div className="surface" style={{ marginBottom: 16 }}>
          <p
            className="muted"
            style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}
          >
            Sender olarak ilk 1 saat içinde geri alabilirsin. Geri alma
            penceresinde kalan: <strong>{formatDuration(hideRemainingSeconds)}</strong>
          </p>
          <button
            type="button"
            onClick={handleHide}
            disabled={hideIsPending || hideConfirming}
            className="button-secondary"
            style={{ width: "100%" }}
          >
            {hideIsPending
              ? "Cüzdan onayı bekleniyor..."
              : hideConfirming
                ? "İşlem zincirde..."
                : "Geri Al"}
          </button>
          {hideError && (
            <p
              style={{
                color: "var(--error)",
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {(hideError as { shortMessage?: string }).shortMessage ||
                hideError.message}
            </p>
          )}
        </div>
      )}

      {decrypted && (
        <div className="surface" style={{ marginBottom: 16 }}>
          <p className="label" style={{ marginBottom: 12 }}>
            Paylaş
          </p>
          <ShareButtons title={title} coverEmoji={coverEmoji} id={id} />
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="muted">{label}</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

function AddressField({
  label,
  addr,
  isYou,
}: {
  label: string;
  addr: string;
  isYou: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        gap: 12,
      }}
    >
      <span className="muted">{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{ fontFamily: "var(--font-mono)" }}
          title={isYou ? addr : undefined}
        >
          {isYou ? "Sen" : shortAddr(addr)}
        </span>
        <button
          type="button"
          onClick={copy}
          className={`copy-btn ${copied ? "copied" : ""}`}
          title="Adresi kopyala"
          aria-label="Adresi kopyala"
        >
          {copied ? "✓" : "⧉"}
        </button>
      </div>
    </div>
  );
}

function ShareButtons({
  title,
  coverEmoji,
  id,
}: {
  title: string;
  coverEmoji: string;
  id: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/c/${id}`);
  }, [id]);

  const text = `${coverEmoji ? coverEmoji + " " : ""}${title || `Kapsül #${id}`} — Time Capsule'da bir kapsül açıldı`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const fcUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a
        href={xUrl}
        target="_blank"
        rel="noreferrer"
        className="button-secondary"
        style={{ flex: 1, minWidth: 100, textDecoration: "none" }}
      >
        X
      </a>
      <a
        href={fcUrl}
        target="_blank"
        rel="noreferrer"
        className="button-secondary"
        style={{ flex: 1, minWidth: 100, textDecoration: "none" }}
      >
        Farcaster
      </a>
      <button
        type="button"
        onClick={copy}
        className="button-secondary"
        style={{ flex: 1, minWidth: 100 }}
      >
        {copied ? "Kopyalandı" : "Linki Kopyala"}
      </button>
    </div>
  );
}
