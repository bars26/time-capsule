// app/components/SwapBox.tsx
// Reusable token-swap widget powered by the KyberSwap Aggregator (via the
// /api/swap proxy, which injects the affiliate fee to SWAP_FEE_RECIPIENT).
//
// Used both on the dedicated /swap page and embedded inline in the capsule
// create flow. Renders only the swap UI (connect prompt / form / success);
// the host provides any page chrome (headings, back links).

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import {
  parseUnits,
  formatUnits,
  erc20Abi,
  maxUint256,
  type Address,
} from "viem";
import { useLocale } from "next-intl";

import {
  SWAP_TOKENS,
  SWAP_FEE_BPS,
  isNative,
  type SwapToken,
  type QuoteResponse,
  type BuildResponse,
} from "../../lib/swap";

type Step =
  | "idle"
  | "quoting"
  | "switching"
  | "approving"
  | "building"
  | "signing"
  | "confirming"
  | "success";

type Props = {
  // Default input/output token symbols (e.g. embed defaults to buying ETH).
  defaultFrom?: string;
  defaultTo?: string;
};

export default function SwapBox({ defaultFrom, defaultTo }: Props) {
  const locale = useLocale();
  // tr is a stable primitive — safe in effect deps (a function like `t`
  // recreated each render caused an infinite quote loop previously).
  const tr = locale.startsWith("tr");
  const t = (en: string, trText: string) => (tr ? trText : en);

  const pick = (sym: string | undefined, fallback: SwapToken) =>
    SWAP_TOKENS.find((tk) => tk.symbol === sym) ?? fallback;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: base.id });
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [fromToken, setFromToken] = useState<SwapToken>(
    pick(defaultFrom, SWAP_TOKENS[1]), // USDC by default
  );
  const [toToken, setToToken] = useState<SwapToken>(
    pick(defaultTo, SWAP_TOKENS[0]), // ETH by default
  );
  const [amount, setAmount] = useState("");

  const [quote, setQuote] = useState<QuoteResponse["data"] | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const isProcessing =
    step !== "idle" && step !== "success" && step !== "quoting";

  const { data: fromBalance } = useBalance({
    address,
    token: isNative(fromToken.address)
      ? undefined
      : (fromToken.address as Address),
    chainId: base.id,
    query: { enabled: !!address },
  });

  const amountInWei = useCallback((): bigint | null => {
    try {
      if (!amount || Number(amount) <= 0) return null;
      return parseUnits(amount, fromToken.decimals);
    } catch {
      return null;
    }
  }, [amount, fromToken.decimals]);

  // ---- Quote (debounced) ----
  useEffect(() => {
    setQuote(null);
    setQuoteErr("");

    let wei: bigint | null = null;
    try {
      if (amount && Number(amount) > 0)
        wei = parseUnits(amount, fromToken.decimals);
    } catch {
      wei = null;
    }
    if (!wei || fromToken.address === toToken.address) return;

    let cancelled = false;
    setStep("quoting");
    const id = setTimeout(async () => {
      try {
        const url = `/api/swap?tokenIn=${fromToken.address}&tokenOut=${toToken.address}&amountIn=${wei!.toString()}`;
        const res = await fetch(url);
        const json: QuoteResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.data) {
          setQuoteErr(
            json.message ||
              (tr
                ? "Bu çift için rota bulunamadı"
                : "No route found for this pair"),
          );
          setQuote(null);
        } else {
          setQuote(json.data);
        }
      } catch (e) {
        if (!cancelled) setQuoteErr((e as Error).message);
      } finally {
        if (!cancelled) setStep("idle");
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, fromToken, toToken, tr]);

  const handleMax = () => {
    if (!fromBalance) return;
    if (isNative(fromToken.address)) {
      const buffered = Math.max(Number(fromBalance.formatted) - 0.00005, 0);
      setAmount(buffered > 0 ? String(buffered) : "");
    } else {
      setAmount(fromBalance.formatted);
    }
  };

  const flip = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount("");
    setQuote(null);
  };

  const amountOutDisplay = quote
    ? Number(formatUnits(BigInt(quote.routeSummary.amountOut), toToken.decimals))
    : 0;

  // ---- Swap ----
  const handleSwap = async () => {
    if (!address || !quote || !publicClient) return;
    setError("");
    const wei = amountInWei();
    if (!wei) return;

    try {
      if (chainId !== base.id) {
        setStep("switching");
        await switchChainAsync({ chainId: base.id });
      }

      const router = quote.routerAddress as Address;

      if (!isNative(fromToken.address)) {
        const allowance = (await publicClient.readContract({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, router],
        })) as bigint;

        if (allowance < wei) {
          setStep("approving");
          const approveHash = await writeContractAsync({
            address: fromToken.address as Address,
            abi: erc20Abi,
            functionName: "approve",
            args: [router, maxUint256],
            chainId: base.id,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      setStep("building");
      const buildRes = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeSummary: quote.routeSummary,
          sender: address,
          recipient: address,
        }),
      });
      const buildJson: BuildResponse = await buildRes.json();
      if (!buildRes.ok || !buildJson.data) {
        throw new Error(
          buildJson.message || t("Failed to build swap", "Swap oluşturulamadı"),
        );
      }

      setStep("signing");
      const hash = await sendTransactionAsync({
        to: buildJson.data.routerAddress,
        data: buildJson.data.data,
        value: BigInt(buildJson.data.transactionValue || "0"),
        chainId: base.id,
      });
      setTxHash(hash);

      setStep("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        setStep("success");
      } else {
        throw new Error(t("Transaction reverted", "İşlem geri alındı"));
      }
    } catch (e) {
      const msg =
        (e as { shortMessage?: string }).shortMessage ||
        (e as Error).message ||
        t("Something went wrong", "Bir şeyler ters gitti");
      setError(msg);
      setStep("idle");
    }
  };

  // ---- Render ----
  const TokenSelect = ({
    value,
    onChange,
    exclude,
  }: {
    value: SwapToken;
    onChange: (t: SwapToken) => void;
    exclude?: SwapToken;
  }) => (
    <select
      className="input"
      value={value.symbol}
      disabled={isProcessing}
      onChange={(e) => {
        const next = SWAP_TOKENS.find((tk) => tk.symbol === e.target.value);
        if (next) onChange(next);
      }}
      style={{ width: "auto", minWidth: 120, cursor: "pointer" }}
    >
      {SWAP_TOKENS.filter((tk) => tk.symbol !== exclude?.symbol).map((tk) => (
        <option key={tk.symbol} value={tk.symbol}>
          {tk.emoji} {tk.symbol}
        </option>
      ))}
    </select>
  );

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <p style={{ marginBottom: 16 }}>
          {t(
            "Connect your wallet to swap tokens on Base.",
            "Base ağında token takası için cüzdanını bağla.",
          )}
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h3 style={{ marginBottom: 8 }}>
          {t("Swap complete", "Takas tamamlandı")}
        </h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          {amount} {fromToken.symbol} → {toToken.symbol}
        </p>
        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              marginBottom: 16,
              fontSize: 12,
              color: "var(--text-tertiary)",
              wordBreak: "break-all",
            }}
          >
            {t("View on Basescan", "Basescan'de görüntüle")}
          </a>
        )}
        <button
          className="button-primary"
          onClick={() => {
            setStep("idle");
            setAmount("");
            setQuote(null);
            setTxHash(null);
          }}
        >
          {t("New swap", "Yeni takas")}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* From */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <label className="label">{t("From", "Gönder")}</label>
        <span className="muted" style={{ fontSize: 12 }}>
          {t("Balance", "Bakiye")}:{" "}
          {fromBalance
            ? Number(fromBalance.formatted).toLocaleString("en-US", {
                maximumFractionDigits: 6,
              })
            : "0"}{" "}
          {fromToken.symbol}
          <button
            type="button"
            onClick={handleMax}
            disabled={isProcessing || !fromBalance}
            style={{
              background: "none",
              border: "none",
              color: "var(--base-blue)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              marginLeft: 8,
              padding: 0,
            }}
          >
            Max
          </button>
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          disabled={isProcessing}
          onChange={(e) => setAmount(e.target.value)}
          style={{ flex: 1 }}
        />
        <TokenSelect value={fromToken} onChange={setFromToken} exclude={toToken} />
      </div>

      {/* Flip */}
      <div style={{ textAlign: "center", margin: "4px 0" }}>
        <button
          type="button"
          onClick={flip}
          disabled={isProcessing}
          className="button-secondary"
          style={{ padding: "4px 12px", fontSize: 18, lineHeight: 1 }}
          aria-label="flip"
        >
          ↓↑
        </button>
      </div>

      {/* To */}
      <label className="label">{t("To (estimated)", "Al (tahmini)")}</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          type="text"
          readOnly
          value={
            step === "quoting"
              ? t("quoting…", "hesaplanıyor…")
              : amountOutDisplay
                ? amountOutDisplay.toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  })
                : ""
          }
          placeholder="0.0"
          style={{ flex: 1 }}
        />
        <TokenSelect value={toToken} onChange={setToToken} exclude={fromToken} />
      </div>

      {/* Quote details */}
      {quote && (
        <div
          className="muted"
          style={{
            fontSize: 13,
            padding: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 16,
            lineHeight: 1.7,
          }}
        >
          <div>
            ≈ ${Number(quote.routeSummary.amountOutUsd).toFixed(2)}{" "}
            {t("received", "alınır")}
          </div>
          <div>
            {t("Network fee", "Ağ ücreti")}: ~$
            {Number(quote.routeSummary.gasUsd).toFixed(3)}
          </div>
          <div>
            {t("App fee", "Uygulama ücreti")}: {SWAP_FEE_BPS / 100}%{" "}
            {t("(goes to you)", "(sana gider)")}
          </div>
        </div>
      )}

      {quoteErr && (
        <p style={{ color: "var(--error)", fontSize: 13, marginBottom: 16 }}>
          {quoteErr}
        </p>
      )}

      <button
        type="button"
        className="button-primary"
        style={{ width: "100%" }}
        disabled={!quote || isProcessing}
        onClick={handleSwap}
      >
        {step === "switching" && t("Switching network…", "Ağ değişiyor…")}
        {step === "approving" && t("Approving…", "Onaylanıyor…")}
        {step === "building" && t("Preparing…", "Hazırlanıyor…")}
        {step === "signing" && t("Confirm in wallet…", "Cüzdanda onayla…")}
        {step === "confirming" && t("Confirming…", "Onaylanıyor…")}
        {(step === "idle" || step === "quoting") &&
          (quote
            ? t("Swap", "Takas yap")
            : t("Enter an amount", "Bir miktar gir"))}
      </button>

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
  );
}
