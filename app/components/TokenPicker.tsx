// app/components/TokenPicker.tsx
// Searchable token selector. Replaces the plain <select> so users can filter
// the (growing) token list by symbol, name, or address.

"use client";

import { useEffect, useRef, useState } from "react";
import { SWAP_TOKENS, type SwapToken } from "../../lib/swap";

type Props = {
  value: SwapToken;
  onChange: (t: SwapToken) => void;
  exclude?: SwapToken;
  disabled?: boolean;
  searchPlaceholder?: string;
};

export default function TokenPicker({
  value,
  onChange,
  exclude,
  disabled,
  searchPlaceholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const list = SWAP_TOKENS.filter((tk) => tk.symbol !== exclude?.symbol).filter(
    (tk) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return (
        tk.symbol.toLowerCase().includes(s) ||
        tk.name.toLowerCase().includes(s) ||
        String(tk.address).toLowerCase().includes(s)
      );
    },
  );

  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        className="input"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          justifyContent: "space-between",
          minWidth: 120,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span>
          {value.emoji} {value.symbol}
        </span>
        <span className="dim" style={{ fontSize: 10 }}>
          ▼
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
            width: 260,
            maxHeight: 300,
            overflowY: "auto",
            // Opaque background — the theme's --surface is nearly transparent,
            // which let underlying buttons bleed through the dropdown.
            background: "#15161b",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
          }}
        >
          <input
            autoFocus
            className="input"
            placeholder={searchPlaceholder || "Ara…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: "100%",
              background: "#15161b",
              borderRadius: 0,
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
            }}
          />
          {list.length === 0 && (
            <div className="dim" style={{ padding: 12, fontSize: 13 }}>
              —
            </div>
          )}
          {list.map((tk) => (
            <button
              key={tk.symbol}
              type="button"
              onClick={() => {
                onChange(tk);
                setOpen(false);
                setQ("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                background:
                  tk.symbol === value.symbol
                    ? "var(--base-blue-soft)"
                    : "transparent",
                border: "none",
                padding: "10px 12px",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ fontSize: 18 }}>{tk.emoji}</span>
              <span>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tk.symbol}</div>
                <div className="dim" style={{ fontSize: 11 }}>
                  {tk.name}
                </div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
