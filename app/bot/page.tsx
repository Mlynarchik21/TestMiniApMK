"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type KeyRow = {
  id: string;
  exchange: string;
  label: string | null;
};

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api(path: string, init?: RequestInit): Promise<{ status: number; json: AnyResp }> {
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

function formatNum(v: unknown, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatUsd(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function pnlColor(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "#fff";
  if (n > 0) return "#4ade80";
  if (n < 0) return "#f87171";
  return "#fff";
}

export default function BotPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [resp, setResp] = useState<AnyResp | null>(null);
  const [err, setErr] = useState("");

  const [keys, setKeys] = useState<KeyRow[]>([]);

  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);

  const [stats, setStats] = useState<any>(null);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [statsOpenPositions, setStatsOpenPositions] = useState<any[]>([]);

  const [exchange, setExchange] = useState("BINANCE");
  const [keyId, setKeyId] = useState("");
  const [maxActiveSymbols, setMaxActiveSymbols] = useState("10");
  const [budgetPerSymbol, setBudgetPerSymbol] = useState("50");
  const [maxTotalBudget, setMaxTotalBudget] = useState("");
  const [syncIntervalMin, setSyncIntervalMin] = useState("5");
  const [testSymbol, setTestSymbol] = useState("BTCUSDT");

  const filteredKeys = useMemo(
    () => keys.filter((k) => k.exchange === exchange),
    [keys, exchange]
  );

  async function loadKeys() {
    const r = await api("/api/keys", { method: "GET" });
    if (r.json.ok) {
      const rows = ((r.json as any).keys ?? []) as KeyRow[];
      setKeys(rows);
    }
    return r;
  }

  async function loadBot() {
    const r = await api("/api/bot", { method: "GET" });

    if (!r.json.ok) {
      setErr(humanizeError(r.json));
      return r;
    }

    const c = (r.json as any).config ?? null;
    const s = (r.json as any).state ?? null;
    const p = (r.json as any).positions ?? [];

    setConfig(c);
    setState(s);
    setPositions(p);

    if (c) {
      setExchange(c.exchange ?? "BINANCE");
      setKeyId(c.keyId ?? "");
      setMaxActiveSymbols(String(c.maxActiveSymbols ?? 10));
      setBudgetPerSymbol(String(c.budgetPerSymbol ?? "50"));
      setMaxTotalBudget(c.maxTotalBudget != null ? String(c.maxTotalBudget) : "");
      setSyncIntervalMin(String(c.syncIntervalMin ?? 5));
    }

    return r;
  }

  async function loadStats() {
    const r = await api("/api/bot/stats", { method: "GET" });

    if (r.json.ok) {
      setStats((r.json as any).stats ?? null);
      setRecentTrades(((r.json as any).recentTrades ?? []) as any[]);
      setStatsOpenPositions(((r.json as any).openPositions ?? []) as any[]);
    }

    return r;
  }

  async function reloadAll(showGlobalLoader = false) {
    if (showGlobalLoader) setPageLoading(true);
    setErr("");

    try {
      const [keysRes, botRes, statsRes] = await Promise.all([loadKeys(), loadBot(), loadStats()]);

      if (!botRes.json.ok) {
        setResp(botRes.json);
      } else if (!statsRes.json.ok) {
        setResp(statsRes.json);
      } else {
        setResp(botRes.json);
      }

      if (!keysRes.json.ok && !botRes.json.ok) {
        setErr(humanizeError(botRes.json));
      }
    } finally {
      if (showGlobalLoader) setPageLoading(false);
    }
  }

  async function saveConfig() {
    if (!keyId) {
      setErr("Сначала выбери API key");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const body: any = {
        exchange,
        keyId,
        maxActiveSymbols: Number(maxActiveSymbols),
        budgetPerSymbol,
        syncIntervalMin: Number(syncIntervalMin),
      };

      body.maxTotalBudget = maxTotalBudget.trim() ? maxTotalBudget.trim() : null;

      const r = await api("/api/bot", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  async function startBot() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/bot/start", { method: "POST" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  async function stopBot() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/bot/stop", { method: "POST" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  async function openTestTrade() {
    const symbol = testSymbol.trim().toUpperCase();

    if (!symbol || !symbol.endsWith("USDT")) {
      setErr("Укажи символ в формате BTCUSDT");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const r = await api(`/api/engine/test-open?symbol=${encodeURIComponent(symbol)}`, {
        method: "POST",
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  async function closeAllDeals() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/engine/test-close-all", {
        method: "POST",
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  async function purgeHistory() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/engine/test-close-all?purge=1", {
        method: "POST",
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      const purgeOk = (r.json as any)?.purge?.ok;
      if (purgeOk === false) {
        setErr(humanizeError((r.json as any).purge));
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      reloadAll(false);
    }, 15000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!keyId && filteredKeys.length > 0) {
      setKeyId(filteredKeys[0].id);
    }
  }, [filteredKeys, keyId]);

  useEffect(() => {
    if (!filteredKeys.length) {
      setKeyId("");
      return;
    }

    const existsInCurrentExchange = filteredKeys.some((k) => k.id === keyId);
    if (!existsInCurrentExchange) {
      setKeyId(filteredKeys[0].id);
    }
  }, [exchange, filteredKeys, keyId]);

  const canSave = !loading && !!keyId;

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
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Bot</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.replace("/home")} style={btnGhost()}>
              Home
            </button>
            <button onClick={() => router.replace("/history")} style={btnGhost()}>
              History
            </button>
          </div>
        </div>

        {pageLoading ? (
          <div style={card()}>
            <div style={{ opacity: 0.7 }}>Loading bot dashboard...</div>
          </div>
        ) : (
          <>
            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Bot status</div>

              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                <div>
                  <b>Config enabled:</b> {config?.enabled ? "YES" : "NO"}
                </div>
                <div>
                  <b>Run status:</b> {state?.status ?? "IDLE"}
                </div>
                <div>
                  <b>Last sync:</b> {state?.lastSyncAt ?? "—"}
                </div>
                <div>
                  <b>Last error:</b> {state?.lastError ?? "—"}
                </div>
                <div>
                  <b>Active positions:</b> {positions.length}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button disabled={loading} onClick={startBot} style={btnPrimary(loading)}>
                  {loading ? "..." : "Start bot"}
                </button>
                <button disabled={loading} onClick={stopBot} style={btnDanger()}>
                  Stop bot
                </button>
              </div>
            </div>

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Bot statistics</div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                }}
              >
                <StatCard
                  title="Total PnL"
                  value={formatUsd(stats?.totalPnl ?? 0)}
                  color={pnlColor(stats?.totalPnl)}
                />
                <StatCard
                  title="PnL Today"
                  value={formatUsd(stats?.pnlToday ?? 0)}
                  color={pnlColor(stats?.pnlToday)}
                />
                <StatCard
                  title="PnL 7d"
                  value={formatUsd(stats?.pnl7d ?? 0)}
                  color={pnlColor(stats?.pnl7d)}
                />
                <StatCard
                  title="PnL 30d"
                  value={formatUsd(stats?.pnl30d ?? 0)}
                  color={pnlColor(stats?.pnl30d)}
                />
                <StatCard title="Win rate" value={formatPct(stats?.winRate ?? 0)} />
                <StatCard title="Closed trades" value={formatNum(stats?.closedTrades ?? 0, 0)} />
                <StatCard title="Open positions" value={formatNum(stats?.openPositions ?? 0, 0)} />
                <StatCard title="Capital in work" value={formatUsd(stats?.capitalInWork ?? 0)} />
                <StatCard
                  title="Avg trade PnL"
                  value={formatUsd(stats?.avgTradePnl ?? 0)}
                  color={pnlColor(stats?.avgTradePnl)}
                />
                <StatCard
                  title="Best trade"
                  value={formatUsd(stats?.bestTradePnl ?? 0)}
                  color={pnlColor(stats?.bestTradePnl)}
                />
                <StatCard
                  title="Worst trade"
                  value={formatUsd(stats?.worstTradePnl ?? 0)}
                  color={pnlColor(stats?.worstTradePnl)}
                />
              </div>
            </div>

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Bot config</div>

              <div style={{ display: "grid", gap: 8 }}>
                <select value={exchange} onChange={(e) => setExchange(e.target.value)} style={input()}>
                  <option value="BINANCE">BINANCE</option>
                  <option value="BYBIT">BYBIT</option>
                  <option value="OKX">OKX</option>
                </select>

                <select value={keyId} onChange={(e) => setKeyId(e.target.value)} style={input()}>
                  <option value="">Select API key</option>
                  {filteredKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.exchange} {k.label ? `· ${k.label}` : `· ${k.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>

                {!filteredKeys.length && (
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    Для биржи {exchange} пока нет ключей. Сначала добавь ключ на странице Keys.
                  </div>
                )}

                <input
                  value={maxActiveSymbols}
                  onChange={(e) => setMaxActiveSymbols(e.target.value)}
                  placeholder="maxActiveSymbols (1..10)"
                  style={input()}
                />

                <input
                  value={budgetPerSymbol}
                  onChange={(e) => setBudgetPerSymbol(e.target.value)}
                  placeholder="budgetPerSymbol"
                  style={input()}
                />

                <input
                  value={maxTotalBudget}
                  onChange={(e) => setMaxTotalBudget(e.target.value)}
                  placeholder="maxTotalBudget (optional)"
                  style={input()}
                />

                <input
                  value={syncIntervalMin}
                  onChange={(e) => setSyncIntervalMin(e.target.value)}
                  placeholder="syncIntervalMin (1..60)"
                  style={input()}
                />

                <button disabled={!canSave} onClick={saveConfig} style={btnPrimary(!canSave)}>
                  {loading ? "..." : "Save config"}
                </button>
              </div>
            </div>

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Test actions</div>

              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={testSymbol}
                  onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
                  placeholder="BTCUSDT"
                  style={input()}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  <button disabled={loading} onClick={openTestTrade} style={btnPrimary(loading)}>
                    {loading ? "..." : "Open test trade"}
                  </button>

                  <button disabled={loading} onClick={closeAllDeals} style={btnGhostWide()}>
                    Close all deals
                  </button>

                  <button disabled={loading} onClick={purgeHistory} style={btnDangerWide()}>
                    Close all + clear history
                  </button>
                </div>
              </div>
            </div>

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Active positions</div>

              {!positions.length ? (
                <div style={{ opacity: 0.7 }}>Пока пусто. Trading Engine ещё не подключён.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {positions.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {p.exchange} · {p.symbol} · {p.status}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        avgPrice: {p.avgPrice} · qty: {p.qty} · tpPrice: {p.tpPrice}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        investedQuote: {p.investedQuote ?? "0"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        addsCount: {p.addsCount} · openedAt: {p.openedAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Open positions snapshot</div>

              {!statsOpenPositions.length ? (
                <div style={{ opacity: 0.7 }}>Нет открытых позиций.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {statsOpenPositions.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{p.symbol}</div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        avgPrice: {p.avgPrice} · qty: {p.qty} · tpPrice: {p.tpPrice}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        investedQuote: {p.investedQuote}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        addsCount: {p.addsCount} · openedAt: {p.openedAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Recent closed trades</div>

              {!recentTrades.length ? (
                <div style={{ opacity: 0.7 }}>Закрытых сделок пока нет.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {recentTrades.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>
                          {t.exchange} · {t.symbol}
                        </div>
                        <div style={{ fontWeight: 900, color: pnlColor(t.pnl) }}>
                          {formatUsd(t.pnl)} · {formatPct(t.pnlPercent)}
                        </div>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
                        entryValue: {t.entryValue} · exitValue: {t.exitValue}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        avgEntryPrice: {t.avgEntryPrice} · exitPrice: {t.exitPrice}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        qty: {t.qty} · addsCount: {t.addsCount} · closeReason: {t.closeReason}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        openedAt: {t.openedAt} · closedAt: {t.closedAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && (
              <div style={errorBox()}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Ошибка</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{err}</pre>
              </div>
            )}

            <div style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Last response</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {resp ? JSON.stringify(resp, null, 2) : "—"}
              </pre>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard(props: { title: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: "#000",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: props.color ?? "#fff" }}>
        {props.value}
      </div>
    </div>
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

function errorBox(): React.CSSProperties {
  return {
    background: "rgba(255,0,0,0.08)",
    border: "1px solid rgba(255,0,0,0.25)",
    borderRadius: 12,
    padding: 10,
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
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

function btnGhostWide(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnDanger(): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnDangerWide(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}