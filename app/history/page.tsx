"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exchange } from "@prisma/client";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type TradeRow = {
  id: string;
  exchange: Exchange;
  symbol: string;
  side: "BUY" | "SELL";
  status: "OPEN" | "CLOSED" | "CANCELED";
  qty: string;
  entryPrice: string | null;
  exitPrice: string | null;
  realizedPnl: string | null;
  openedAt: string;
  closedAt: string | null;
};

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api(
  path: string,
  init?: RequestInit
): Promise<{ status: number; json: AnyResp }> {
  const token = getToken();
  const res = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let json: AnyResp = { ok: false, error: "BAD_RESPONSE", message: "Invalid JSON response" };
  try {
    json = (await res.json()) as AnyResp;
  } catch {}
  return { status: res.status, json };
}

function humanizeError(r: AnyResp): string {
  if (!r || (r as any).ok) return "";
  const code = (r as any).error || "ERROR";
  const msg = (r as any).message ? `: ${(r as any).message}` : "";
  return `${code}${msg}`;
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function HistoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AnyResp | null>(null);

  const [items, setItems] = useState<TradeRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string>("");

  const [exchange, setExchange] = useState<Exchange | "ALL">("ALL");
  const [status, setStatus] = useState<"ALL" | "OPEN" | "CLOSED" | "CANCELED">("ALL");

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("take", "20");
    if (exchange !== "ALL") qs.set("exchange", exchange);
    if (status !== "ALL") qs.set("status", status);
    return qs.toString();
  }, [exchange, status]);

  async function loadFirst() {
    setLoading(true);
    setErr("");
    try {
      const r = await api(`/api/trades?${query}`, { method: "GET" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        setItems([]);
        setNextCursor(null);
        return;
      }

      setItems((r.json as any).trades ?? []);
      setNextCursor((r.json as any).nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    setErr("");
    try {
      const r = await api(`/api/trades?${query}&cursor=${encodeURIComponent(nextCursor)}`, {
        method: "GET",
      });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      const more = ((r.json as any).trades ?? []) as TradeRow[];
      setItems((prev) => [...prev, ...more]);
      setNextCursor((r.json as any).nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>History</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => router.replace("/home")} style={btnGhost()}>
              Home
            </button>
            <button onClick={() => router.replace("/keys")} style={btnGhost()}>
              Keys
            </button>
          </div>
        </div>

        <div style={card()}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>Фильтры:</div>

            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as any)}
              style={input()}
            >
              <option value="ALL">ALL exchanges</option>
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={input()}>
              <option value="ALL">ALL status</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELED">CANCELED</option>
            </select>

            <button disabled={loading} onClick={loadFirst} style={btnGhost()}>
              {loading ? "..." : "Обновить"}
            </button>
          </div>

          {err && (
            <div style={errorBox()}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Ошибка</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{err}</pre>
            </div>
          )}
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Trades</div>

          {!items.length ? (
            <div style={{ opacity: 0.7 }}>
              Нет сделок. Для MVP добавим вручную через POST /api/trades (следующим шагом дам команду).
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>
                      {t.exchange} · {t.symbol} · {t.side} · {t.status}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{t.id}</div>
                  </div>

                  <div style={{ display: "grid", gap: 4, fontSize: 13, opacity: 0.95 }}>
                    <div>
                      qty: <b>{t.qty}</b>
                    </div>
                    <div>
                      entry: <b>{t.entryPrice ?? "—"}</b> · exit: <b>{t.exitPrice ?? "—"}</b> · pnl:{" "}
                      <b>{t.realizedPnl ?? "—"}</b>
                    </div>
                    <div style={{ opacity: 0.75 }}>
                      opened: {fmtDate(t.openedAt)} · closed: {t.closedAt ? fmtDate(t.closedAt) : "—"}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button disabled={loading || !nextCursor} onClick={loadMore} style={btnGhost()}>
                  {loading ? "..." : nextCursor ? "Load more" : "No more"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Last response</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {resp ? JSON.stringify(resp, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
  };
}

function errorBox(): React.CSSProperties {
  return {
    marginTop: 12,
    background: "rgba(255,0,0,0.08)",
    border: "1px solid rgba(255,0,0,0.25)",
    borderRadius: 12,
    padding: 10,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#000",
    color: "#fff",
    outline: "none",
    minWidth: 180,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}
