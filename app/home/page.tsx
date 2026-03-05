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

  // --- Add Trade (MVP form)
  const [addOpen, setAddOpen] = useState(false);
  const [fExchange, setFExchange] = useState<Exchange>("BINANCE" as Exchange);
  const [fSymbol, setFSymbol] = useState("BTCUSDT");
  const [fSide, setFSide] = useState<"BUY" | "SELL">("BUY");
  const [fQty, setFQty] = useState("0.01");
  const [fEntry, setFEntry] = useState<string>("65000");
  const [fExit, setFExit] = useState<string>("");
  const [fPnl, setFPnl] = useState<string>("");
  const [addErr, setAddErr] = useState<string>("");

  // --- Delete loading per trade
  const [delLoading, setDelLoading] = useState<Record<string, boolean>>({});

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

  async function addTrade() {
    setAddErr("");
    setLoading(true);
    try {
      const body: any = {
        exchange: fExchange,
        symbol: fSymbol.trim().toUpperCase(),
        side: fSide,
        qty: fQty.trim(),
      };

      if (fEntry.trim()) body.entryPrice = fEntry.trim();
      if (fExit.trim()) body.exitPrice = fExit.trim();
      if (fPnl.trim()) body.realizedPnl = fPnl.trim();

      const r = await api("/api/trades", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setResp(r.json);

      if (!r.json.ok) {
        setAddErr(humanizeError(r.json));
        return;
      }

      setAddOpen(false);
      await loadFirst();
    } finally {
      setLoading(false);
    }
  }

  async function deleteTrade(id: string) {
    const yes = confirm("Удалить сделку? Это действие нельзя отменить.");
    if (!yes) return;

    setDelLoading((m) => ({ ...m, [id]: true }));
    setErr("");
    try {
      const r = await api(`/api/trades/${encodeURIComponent(id)}`, { method: "DELETE" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      // быстрее: удалим из state сразу
      setItems((prev) => prev.filter((x) => x.id !== id));

      // и подстрахуемся — подгрузим заново (с учётом курсора/фильтров)
      await loadFirst();
    } finally {
      setDelLoading((m) => ({ ...m, [id]: false }));
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
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 12 }}>
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

        {/* Add Trade */}
        <div style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Add trade (MVP)</div>
            <button onClick={() => setAddOpen((v) => !v)} style={btnGhost()}>
              {addOpen ? "Скрыть" : "Показать"}
            </button>
          </div>

          {addOpen && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <select
                  value={fExchange}
                  onChange={(e) => setFExchange(e.target.value as Exchange)}
                  style={input()}
                >
                  <option value="BINANCE">BINANCE</option>
                  <option value="BYBIT">BYBIT</option>
                  <option value="OKX">OKX</option>
                </select>

                <input
                  value={fSymbol}
                  onChange={(e) => setFSymbol(e.target.value)}
                  placeholder="SYMBOL (BTCUSDT)"
                  style={input()}
                />

                <select value={fSide} onChange={(e) => setFSide(e.target.value as any)} style={input()}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>

                <input value={fQty} onChange={(e) => setFQty(e.target.value)} placeholder="qty (0.01)" style={input()} />
                <input
                  value={fEntry}
                  onChange={(e) => setFEntry(e.target.value)}
                  placeholder="entryPrice (optional)"
                  style={input()}
                />
                <input
                  value={fExit}
                  onChange={(e) => setFExit(e.target.value)}
                  placeholder="exitPrice (optional)"
                  style={input()}
                />
                <input
                  value={fPnl}
                  onChange={(e) => setFPnl(e.target.value)}
                  placeholder="realizedPnl (optional)"
                  style={input()}
                />

                <button disabled={loading} onClick={addTrade} style={btnPrimary(loading)}>
                  {loading ? "..." : "Create trade"}
                </button>

                {addErr && (
                  <div style={errorBox()}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Ошибка</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{addErr}</pre>
                  </div>
                )}
              </div>

              <div style={{ opacity: 0.65, fontSize: 12, lineHeight: 1.4 }}>
                Это ручной ввод для MVP. Позже сделки будут приходить из trade_events / sync с биржи.
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={card()}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>Фильтры:</div>

            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as any)}
              style={inputSmall()}
            >
              <option value="ALL">ALL exchanges</option>
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputSmall()}>
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

        {/* Trades */}
        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Trades</div>

          {!items.length ? (
            <div style={{ opacity: 0.7 }}>Нет сделок. Нажми “Add trade (MVP)” и создай первую.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((t) => {
                const dl = !!delLoading[t.id];
                return (
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

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{t.id}</div>
                        <button
                          onClick={() => deleteTrade(t.id)}
                          disabled={loading || dl}
                          style={btnDangerSmall()}
                          title="Delete trade"
                        >
                          {dl ? "..." : "Delete"}
                        </button>
                      </div>
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
                );
              })}

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button disabled={loading || !nextCursor} onClick={loadMore} style={btnGhost()}>
                  {loading ? "..." : nextCursor ? "Load more" : "No more"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Debug */}
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
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#000",
    color: "#fff",
    outline: "none",
  };
}

function inputSmall(): React.CSSProperties {
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

function btnDangerSmall(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}
