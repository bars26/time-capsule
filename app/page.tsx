"use client";

import { useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { parseEther } from "viem";
import { baseSepolia } from "wagmi/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TIME_CAPSULE_ADDRESS, TIME_CAPSULE_ABI } from "../lib/contract";

const wrap: CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: "60px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontSize: 15,
  marginBottom: 16,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  padding: 16,
  borderRadius: 10,
  border: "none",
  background: "#0052FF",
  color: "white",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [unlockDate, setUnlockDate] = useState("");

  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onCorrectChain = chainId === baseSepolia.id;

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message || !unlockDate) return;
    const unlockTimestamp = Math.floor(new Date(unlockDate).getTime() / 1000);
    writeContract({
      address: TIME_CAPSULE_ADDRESS,
      abi: TIME_CAPSULE_ABI,
      functionName: "createCapsule",
      args: [message, BigInt(unlockTimestamp)],
      value: parseEther("0.0001"),
      chainId: baseSepolia.id,
    });
  };

  const today = new Date().toISOString().split("T")[0];

  if (!isConnected) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>Time Capsule</h1>
        <p style={{ opacity: 0.75, marginBottom: 32 }}>
          Gelecege bir mesaj birak. Sectigin tarih gelene kadar kimse okuyamaz.
        </p>
        <ConnectButton />
      </main>
    );
  }

  if (!onCorrectChain) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>Yanlis ag</h1>
        <p style={{ opacity: 0.75, marginBottom: 24 }}>
          Cuzdanin Base Sepolia testnet aginda olmali.
        </p>
        <button
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          style={buttonStyle}
        >
          Base Sepolia agina gec
        </button>
        <div style={{ marginTop: 16 }}>
          <ConnectButton />
        </div>
      </main>
    );
  }

  if (isConfirmed) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>Kapsulun hazir</h1>
        <p style={{ marginBottom: 16 }}>
          <strong>{unlockDate}</strong> tarihinde acilacak.
        </p>
        <p style={{ fontSize: 12, opacity: 0.6, wordBreak: "break-all", marginBottom: 24 }}>
          Tx hash: {hash}
        </p>
        <button
          onClick={() => {
            setMessage("");
            setUnlockDate("");
            reset();
          }}
          style={buttonStyle}
        >
          Yeni kapsul olustur
        </button>
      </main>
    );
  }

  const errorText = error ? (error as { shortMessage?: string }).shortMessage || error.message : "";

  return (
    <main style={wrap}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 32, margin: 0 }}>Time Capsule</h1>
        <ConnectButton />
      </div>

      <p style={{ opacity: 0.75, marginBottom: 24 }}>
        Gelecege bir mesaj yaz. Sectigin tarih gelene kadar kilitli kalir.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
          Mesaj
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={1000}
          required
          disabled={isPending || isConfirming}
          placeholder="Gelecegin sana ne diyecek?"
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <label style={{ display: "block", marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
          Acilis tarihi
        </label>
        <input
          type="date"
          value={unlockDate}
          onChange={(e) => setUnlockDate(e.target.value)}
          min={today}
          required
          disabled={isPending || isConfirming}
          style={inputStyle}
        />

        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
          Ucret: 0.0001 ETH (Base Sepolia testnet, gercek para degil)
        </p>

        <button
          type="submit"
          disabled={isPending || isConfirming || !message || !unlockDate}
          style={{
            ...buttonStyle,
            opacity: isPending || isConfirming || !message || !unlockDate ? 0.6 : 1,
            cursor: isPending || isConfirming ? "wait" : "pointer",
          }}
        >
          {isPending ? "Cuzdandan onayla..." : isConfirming ? "Islem zincirde, bekle..." : "Kapsulu Kilitle"}
        </button>

        {error ? (
          <p
            style={{
              color: "#ff6b6b",
              marginTop: 16,
              fontSize: 13,
              padding: 12,
              background: "rgba(255,107,107,0.1)",
              borderRadius: 8,
            }}
          >
            {errorText}
          </p>
        ) : null}
      </form>
    </main>
  );
}
