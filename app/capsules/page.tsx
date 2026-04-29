// app/capsules/page.tsx
// Phase F polish: opened-capsule tracking via localStorage.
// Once a capsule is decrypted on /c/[id], it's marked opened and falls out of
// the "Açılmaya Hazır" tab. Cards display an "Açıldı" badge in other tabs.

"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import type { Address } from "viem";
import { TIME_CAPSULE_ADDRESS, TIME_CAPSULE_ABI } from "../../lib/contract";
import { isCapsuleOpened } from "../../lib/opened";

type Tab = "sent" | "received" | "ready";

const PAGE_SIZE = 12;

type Capsule = {
  id: bigint;
  sender: Address;
  recipient: Address;
  ipfsHash: string;
  unlockTime: bigint;
  createdAt: bigint;
  isHidden: boolean;
  title: string;
  coverEmoji: string;
};

type RawCapsule = readonly [
  Address,
  Address,
  string,
  bigint,
  bigint,
  boolean,
  string,
  string,
];

function parseCapsule(id: bigint, data: RawCapsule): Capsule {
  return {
    id,
    sender: data[0],
    recipient: data[1],
    ipfsHash: data[2],
    unlockTime: data[3],
    createdAt: data[4],
    isHidden: data[5],
    title: data[6],
    coverEmoji: data[7],
  };
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function CapsuleCard({
  capsule,
  currentAddress,
  opened,
}: {
  capsule: Capsule;
  currentAddress: Address;
  opened: boolean;
}) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isUnlocked = capsule.unlockTime <= now;
  const isHidden = capsule.isHidden;
  const isSender = capsule.sender.toLowerCase() === currentAddress.toLowerCase();
  const isSelf =
    capsule.sender.toLowerCase() === capsule.recipient.toLowerCase();

  let badgeText: string;
  let badgeCls: string;
  if (isHidden) {
    badgeText = "Geri Alındı";
    badgeCls = "badge-hidden";
  } else if (opened) {
    badgeText = "Açıldı";
    badgeCls = "badge-opened";
  } else if (isUnlocked) {
    badgeText = "Açılmaya Hazır";
    badgeCls = "badge-ready";
  } else {
    badgeText = "Kilitli";
    badgeCls = "badge-locked";
  }

  let partyLabel: string;
  if (isSelf) {
    partyLabel = "Kendine";
  } else if (isSender) {
    partyLabel = `→ ${shortAddr(capsule.recipient)}`;
  } else {
    partyLabel = `← ${shortAddr(capsule.sender)}`;
  }

  const unlockDate = new Date(Number(capsule.unlockTime) * 1000);

  return (
    <Link
      href={`/c/${capsule.id.toString()}`}
      className="surface"
      style={{
        display: "flex",
        gap: 16,
        marginBottom: 12,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 32,
          opacity: isHidden ? 0.3 : 1,
          lineHeight: 1,
        }}
      >
        {capsule.coverEmoji || (isUnlocked ? "🔓" : "🔒")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ fontSize: 15 }}>
            {capsule.title || `Kapsül #${capsule.id.toString()}`}
          </strong>
          <span className={`badge ${badgeCls}`}>{badgeText}</span>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {partyLabel} • {unlockDate.toLocaleDateString("tr-TR")}{" "}
          {unlockDate.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </Link>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 8px",
        background: "transparent",
        border: "none",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "inherit",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        borderBottom: `2px solid ${active ? "var(--base-blue)" : "transparent"}`,
        marginBottom: -1,
        transition: "color 150ms ease, border-color 150ms ease",
      }}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          style={{
            marginLeft: 6,
            padding: "2px 7px",
            fontSize: 11,
            background: "var(--surface)",
            borderRadius: "var(--radius-pill)",
            color: "var(--text-secondary)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function CapsulesPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("sent");
  const [page, setPage] = useState(0);

  // Reset to first page whenever the active tab changes.
  useEffect(() => {
    setPage(0);
  }, [tab]);

  // Re-read localStorage on mount/return-to-page so opened state stays fresh.
  const [openedTick, setOpenedTick] = useState(0);
  useEffect(() => {
    const handler = () => setOpenedTick((t) => t + 1);
    window.addEventListener("focus", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("focus", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const { data: sentIds, isLoading: sentLoading } = useReadContract({
    abi: TIME_CAPSULE_ABI,
    address: TIME_CAPSULE_ADDRESS,
    functionName: "getSentCapsuleIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: receivedIds, isLoading: receivedLoading } = useReadContract({
    abi: TIME_CAPSULE_ABI,
    address: TIME_CAPSULE_ADDRESS,
    functionName: "getReceivedCapsuleIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const allIds = useMemo(() => {
    const set = new Set<string>();
    (sentIds ?? []).forEach((id) => set.add(id.toString()));
    (receivedIds ?? []).forEach((id) => set.add(id.toString()));
    return Array.from(set).map((s) => BigInt(s));
  }, [sentIds, receivedIds]);

  const contracts = useMemo(
    () =>
      allIds.map(
        (id) =>
          ({
            abi: TIME_CAPSULE_ABI,
            address: TIME_CAPSULE_ADDRESS,
            functionName: "getCapsule",
            args: [id],
          }) as const,
      ),
    [allIds],
  );

  const { data: capsulesData, isLoading: capsulesLoading } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  });

  const capsules = useMemo<Capsule[]>(() => {
    if (!capsulesData) return [];
    return capsulesData
      .map((result, i) => {
        if (result.status !== "success") return null;
        return parseCapsule(allIds[i], result.result as RawCapsule);
      })
      .filter((c): c is Capsule => c !== null);
  }, [capsulesData, allIds]);

  // Resolve opened state for each capsule against the connected address.
  // openedTick forces this to recompute when the user returns to the page.
  const openedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!address) return map;
    for (const c of capsules) {
      map.set(c.id.toString(), isCapsuleOpened(address, c.id));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsules, address, openedTick]);

  const sentSet = useMemo(
    () => new Set((sentIds ?? []).map((id) => id.toString())),
    [sentIds],
  );

  const sentCapsules = useMemo(
    () => capsules.filter((c) => sentSet.has(c.id.toString())),
    [capsules, sentSet],
  );

  // Bana Gelenler tab includes everything where viewer is the recipient,
  // even self-capsules (sender == recipient == viewer). The contract's
  // getReceivedCapsuleIds excludes self-capsules; we filter on the frontend
  // so the user's "letters to my future self" surface here too.
  // Hidden capsules are excluded — recipients shouldn't see them; only the
  // sender keeps a record in the Gönderdiklerim tab with the "Geri Alındı" badge.
  const receivedCapsules = useMemo(
    () =>
      address
        ? capsules.filter(
            (c) =>
              c.recipient.toLowerCase() === address.toLowerCase() &&
              !c.isHidden,
          )
        : [],
    [capsules, address],
  );
  // Açılmaya Hazır = capsules the viewer can open right now.
  // Sender's outgoing capsules (where recipient != viewer) don't belong here —
  // the recipient opens them, not the sender.
  const readyCapsules = useMemo(() => {
    if (!address) return [];
    const now = BigInt(Math.floor(Date.now() / 1000));
    const lower = address.toLowerCase();
    return capsules.filter(
      (c) =>
        c.unlockTime <= now &&
        !c.isHidden &&
        c.recipient.toLowerCase() === lower &&
        !openedMap.get(c.id.toString()),
    );
  }, [capsules, address, openedMap]);

  const isLoading = sentLoading || receivedLoading || capsulesLoading;

  if (!isConnected) {
    return (
      <main className="container">
        <h2 style={{ marginBottom: 16 }}>Kapsüllerim</h2>
        <p style={{ marginBottom: 24 }}>
          Kapsüllerini görmek için cüzdanını bağla.
        </p>
        <ConnectButton />
        <div style={{ marginTop: 24 }}>
          <Link href="/" className="muted">
            ← Ana Sayfa
          </Link>
        </div>
      </main>
    );
  }

  let activeList: Capsule[];
  let emptyText: string;
  if (tab === "sent") {
    activeList = sentCapsules;
    emptyText = "Henüz kapsül göndermedin.";
  } else if (tab === "received") {
    activeList = receivedCapsules;
    emptyText = "Sana gelen kapsül yok. Belki bir gün sürpriz gelir.";
  } else {
    activeList = readyCapsules;
    emptyText = "Şu an açılabilecek kapsülün yok.";
  }

  // Sort + slice for the current page. Done inline (not via useMemo) because
  // this code runs after the early-return for !isConnected — putting a hook
  // here would change hook order between renders. The sort is cheap on
  // typical capsule counts so memoization is not worth the discipline.
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = [...activeList]
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <main className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" className="brand-link">
          <span className="capsule-logo" />
          <span className="brand-text">Time Capsule</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="button-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
            + Yeni
          </Link>
          <ConnectButton
            showBalance={false}
            accountStatus="avatar"
            chainStatus="none"
          />
        </div>
      </div>

      <h2 style={{ margin: "0 0 24px" }}>Kapsüllerim</h2>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        <TabButton
          active={tab === "sent"}
          onClick={() => setTab("sent")}
          count={sentCapsules.length}
        >
          Gönderdiklerim
        </TabButton>
        <TabButton
          active={tab === "received"}
          onClick={() => setTab("received")}
          count={receivedCapsules.length}
        >
          Bana Gelenler
        </TabButton>
        <TabButton
          active={tab === "ready"}
          onClick={() => setTab("ready")}
          count={readyCapsules.length}
        >
          Açılmaya Hazır
        </TabButton>
      </div>

      {isLoading ? (
        <p className="muted">Yükleniyor...</p>
      ) : activeList.length === 0 ? (
        <div className="surface" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted" style={{ marginBottom: 16 }}>
            {emptyText}
          </p>
          {tab === "sent" && (
            <Link href="/" className="button-primary">
              + Yeni kapsül
            </Link>
          )}
        </div>
      ) : (
        <>
          <div>
            {pageItems.map((capsule) => (
              <CapsuleCard
                key={capsule.id.toString()}
                capsule={capsule}
                currentAddress={address!}
                opened={!!openedMap.get(capsule.id.toString())}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                ← Önceki
              </button>
              <span>
                Sayfa {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={safePage >= totalPages - 1}
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
