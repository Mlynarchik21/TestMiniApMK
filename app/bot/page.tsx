"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type KeyRow = {
  id: string;
  exchange: string;
  label: string | null;
};

type StatsRangePreset = "1D" | "1W" | "1M" | "CUSTOM";

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

  let json: AnyResp = {
    ok: false,
    error: "BAD_RESPONSE",
    message: "Invalid JSON response",
  };

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

const UI = {
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.09)",
  borderHard: "rgba(255,255,255,0.16)",
  text: "#f3f3f3",
  textMain: "rgba(255,255,255,0.96)",
  textSoft: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.42)",
  green: "#64d97b",
  red: "#ff6a6a",
  blue: "#8eb2ff",
  brand: "#2979ff",
  yellow: "#f3d709",
  purple: "#9b8cff",
};

function reveal(index: number, mounted: boolean): CSSProperties {
  return mounted
    ? {
        opacity: 1,
        animationName: "fadeUp",
        animationDuration: "560ms",
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        animationFillMode: "both",
        animationDelay: `${index * 60}ms`,
        willChange: "transform, opacity",
      }
    : {
        opacity: 0,
        transform: "translate3d(0, 14px, 0)",
      };
}

function formatNum(v: unknown, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatUsd(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function pnlColor(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return UI.textMain;
  if (n > 0) return UI.green;
  if (n < 0) return UI.red;
  return UI.textMain;
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getGmtPlus3DayKey(dateLike: unknown) {
  const d = safeDate(dateLike);
  if (!d) return "";
  const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function isTodayGmtPlus3(dateLike: unknown) {
  const current = getGmtPlus3DayKey(new Date().toISOString());
  return getGmtPlus3DayKey(dateLike) === current;
}

function getRangeDates(
  preset: StatsRangePreset,
  customFrom: string,
  customTo: string
) {
  const now = new Date();

  if (preset === "CUSTOM") {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    const to = customTo ? new Date(`${customTo}T23:59:59.999`) : null;
    return { from, to };
  }

  const to = now;
  const from = new Date(now);

  if (preset === "1D") {
    from.setDate(now.getDate() - 1);
  } else if (preset === "1W") {
    from.setDate(now.getDate() - 7);
  } else {
    from.setMonth(now.getMonth() - 1);
  }

  return { from, to };
}

function inRange(dateLike: unknown, from: Date | null, to: Date | null) {
  const d = safeDate(dateLike);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function getCloseReasonLabel(reason: unknown) {
  const value = String(reason || "").toUpperCase();

  if (!value) return "—";
  if (value === "MANUAL") return "Ручное закрытие";
  if (value === "TP") return "По таргету";
  if (value === "TARGET") return "По таргету";
  if (value === "STRATEGY") return "По стратегии";

  return String(reason);
}

function getPositionDisplayTime(p: any) {
  const openedAt = p?.openedAt;
  const updatedAt = p?.updatedAt;
  const addsCount = Number(p?.addsCount ?? 0);

  if (addsCount > 0 && updatedAt) {
    return {
      label: "Изменена",
      value: formatTime(updatedAt),
      openedAt: formatTime(openedAt),
      updatedAt: formatTime(updatedAt),
    };
  }

  return {
    label: "Открыта",
    value: formatTime(openedAt),
    openedAt: formatTime(openedAt),
    updatedAt: updatedAt ? formatTime(updatedAt) : "—",
  };
}

function sumCapitalInWork(rows: any[]) {
  return rows.reduce((sum, p) => {
    const v = Number(p?.investedQuote ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function countOpenedToday(rows: any[]) {
  return rows.filter((p) => isTodayGmtPlus3(p?.openedAt)).length;
}

function deriveStatsFromTrades(trades: any[]) {
  const closedTrades = trades.length;
  const pnlList = trades.map((t) => Number(t?.pnl ?? 0)).filter(Number.isFinite);
  const wins = pnlList.filter((n) => n > 0);
  const losses = pnlList.filter((n) => n < 0);

  const totalPnl = pnlList.reduce((a, b) => a + b, 0);
  const winRate = closedTrades ? (wins.length / closedTrades) * 100 : 0;
  const avgTradePnl = closedTrades ? totalPnl / closedTrades : 0;
  const bestTradePnl = pnlList.length ? Math.max(...pnlList) : 0;
  const worstTradePnl = pnlList.length ? Math.min(...pnlList) : 0;
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? 999 : 0;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0)) / losses.length : 0;

  let totalVolume = 0;
  for (const t of trades) {
    const entryValue = Number(t?.entryValue ?? 0);
    const exitValue = Number(t?.exitValue ?? 0);
    if (Number.isFinite(entryValue)) totalVolume += entryValue;
    if (Number.isFinite(exitValue)) totalVolume += exitValue;
  }

  return {
    closedTrades,
    totalPnl,
    winRate,
    avgTradePnl,
    bestTradePnl,
    worstTradePnl,
    grossProfit,
    grossLossAbs,
    profitFactor,
    avgWin,
    avgLoss,
    totalVolume,
    wins: wins.length,
    losses: losses.length,
  };
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M9 2h6v2h2.5A2.5 2.5 0 0 1 20 6.5v9A3.5 3.5 0 0 1 16.5 19h-9A3.5 3.5 0 0 1 4 15.5v-9A2.5 2.5 0 0 1 6.5 4H9V2Zm-1 7a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 8 9Zm8 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 16 9Zm-8.5 5h9a2.5 2.5 0 0 1-9 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function BotPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [resp, setResp] = useState<AnyResp | null>(null);
  const [err, setErr] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 5px)"
  );

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

  const [statsPreset, setStatsPreset] = useState<StatsRangePreset>("1W");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [expandedOpenId, setExpandedOpenId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

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
    setStatusCode(r.status);

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
      const [keysRes, botRes, statsRes] = await Promise.all([
        loadKeys(),
        loadBot(),
        loadStats(),
      ]);

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
      setStatusCode(r.status);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll(true);

    const tg = (window as any)?.Telegram?.WebApp;

    const updateLayout = () => {
      if (tg?.isFullscreen) {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 78px)");
      } else {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 5px)");
      }
    };

    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#000000");
      tg?.setBackgroundColor?.("#000000");

      updateLayout();

      if (tg?.onEvent) {
        tg.onEvent("fullscreen_changed", updateLayout);
      }
    } catch {}

    const id = requestAnimationFrame(() => setMounted(true));

    return () => {
      cancelAnimationFrame(id);

      try {
        if (tg?.offEvent) {
          tg.offEvent("fullscreen_changed", updateLayout);
        }
      } catch {}
    };
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

  const liveOpenPositions = statsOpenPositions.length ? statsOpenPositions : positions;
  const openPositionsCount = liveOpenPositions.length;
  const openedToday = countOpenedToday(liveOpenPositions);
  const capitalInWork = sumCapitalInWork(liveOpenPositions);
  const pnlToday = Number(stats?.pnlToday ?? 0);

  const range = getRangeDates(statsPreset, customFrom, customTo);
  const filteredTradeHistory = recentTrades.filter((t) =>
    inRange(t?.closedAt ?? t?.openedAt, range.from, range.to)
  );
  const derived = deriveStatsFromTrades(filteredTradeHistory);

  const shortOpenList = liveOpenPositions
    .slice()
    .sort((a, b) => {
      const ad = safeDate(a?.updatedAt ?? a?.openedAt)?.getTime() ?? 0;
      const bd = safeDate(b?.updatedAt ?? b?.openedAt)?.getTime() ?? 0;
      return bd - ad;
    })
    .slice(0, 3);

  const shortHistoryList = recentTrades
    .slice()
    .sort((a, b) => {
      const ad = safeDate(a?.closedAt ?? a?.openedAt)?.getTime() ?? 0;
      const bd = safeDate(b?.closedAt ?? b?.openedAt)?.getTime() ?? 0;
      return bd - ad;
    })
    .slice(0, 3);

  const canSave = !loading && !!keyId;

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #000;
          overflow-x: hidden;
        }

        select,
        input,
        button,
        textarea {
          font: inherit;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>

      <main style={{ ...styles.page, paddingTop: pagePaddingTop }}>
        <div style={styles.container}>
          <section style={{ ...styles.topCtaWrap, ...reveal(0, mounted) }}>
            <button
              type="button"
              style={styles.topCtaButton}
              onClick={() => router.replace("/keys")}
            >
              <span style={styles.topCtaIcon}>
                <BotIcon />
              </span>
              <span>Подключить API биржи</span>
            </button>
          </section>

          <section style={{ ...styles.botHero, ...reveal(1, mounted) }}>
            <div style={styles.botTopRow}>
              <div>
                <div style={styles.botEyebrow}>BOT CONTROL</div>
                <div style={styles.botTitle}>Управление ботом</div>
              </div>
              <div style={styles.lastSyncChip}>
                Sync: {formatDateTime(state?.lastSyncAt)}
              </div>
            </div>

            <div style={styles.botMetricsGrid}>
              <MetricBox
                label="Открытые позиции"
                value={String(openPositionsCount)}
                sub="Сейчас в рынке"
                valueColor={UI.textMain}
                glowColor="rgba(255,255,255,0.10)"
              />
              <MetricBox
                label="Открыто сегодня"
                value={String(openedToday)}
                sub="Считаем по GMT+3"
                valueColor={UI.yellow}
                glowColor="rgba(243,215,9,0.14)"
              />
              <MetricBox
                label="Используется маржи"
                value={formatUsd(capitalInWork)}
                sub="Сумма в открытых позициях"
                valueColor={UI.blue}
                glowColor="rgba(41,121,255,0.18)"
              />
              <MetricBox
                label="PnL за день"
                value={formatUsd(pnlToday)}
                sub="Текущий день GMT+3"
                valueColor={pnlColor(pnlToday)}
                glowColor={
                  pnlToday >= 0
                    ? "rgba(100,217,123,0.18)"
                    : "rgba(255,106,106,0.18)"
                }
              />
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionMainTitle}>Статистика</div>
                <div style={styles.sectionSubTitle}>
                  Гибкая аналитика по выбранному диапазону
                </div>
              </div>
            </div>

            <div style={styles.rangeBar}>
              {(["1D", "1W", "1M", "CUSTOM"] as StatsRangePreset[]).map((preset) => {
                const active = statsPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    style={{
                      ...styles.rangeChip,
                      ...(active ? styles.rangeChipActive : null),
                    }}
                    onClick={() => setStatsPreset(preset)}
                  >
                    {preset === "CUSTOM" ? "Свободный" : preset}
                  </button>
                );
              })}
            </div>

            {statsPreset === "CUSTOM" ? (
              <div style={styles.customRangeGrid}>
                <Field label="Дата начала">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={styles.input}
                  />
                </Field>

                <Field label="Дата конца">
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={styles.input}
                  />
                </Field>
              </div>
            ) : null}

            <div style={styles.statsHero}>
              <div style={styles.statsHeroLeft}>
                <div style={styles.statsHeroLabel}>Net PnL</div>
                <div
                  style={{
                    ...styles.statsHeroValue,
                    color: pnlColor(derived.totalPnl),
                  }}
                >
                  {formatUsd(derived.totalPnl)}
                </div>
                <div style={styles.statsHeroSub}>
                  Сделок: {derived.closedTrades} · Win rate: {formatPct(derived.winRate)}
                </div>
              </div>

              <div style={styles.winLossCard}>
                <div style={styles.winLossTop}>
                  <span style={{ color: UI.green }}>{derived.wins} Win</span>
                  <span style={{ color: UI.red }}>{derived.losses} Loss</span>
                </div>
                <div style={styles.winLossTrack}>
                  <div
                    style={{
                      ...styles.winLossPositive,
                      width: `${derived.closedTrades ? (derived.wins / derived.closedTrades) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div style={styles.winLossBottom}>
                  Profit factor {Number(derived.profitFactor).toLocaleString("ru-RU", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            <div style={styles.statsGridEnhanced}>
              <StatMini
                label="Win Rate"
                value={formatPct(derived.winRate)}
                color={UI.textMain}
              />
              <StatMini
                label="Closed Trades"
                value={formatNum(derived.closedTrades, 0)}
                color={UI.textMain}
              />
              <StatMini
                label="Avg Trade"
                value={formatUsd(derived.avgTradePnl)}
                color={pnlColor(derived.avgTradePnl)}
              />
              <StatMini
                label="Best Trade"
                value={formatUsd(derived.bestTradePnl)}
                color={pnlColor(derived.bestTradePnl)}
              />
              <StatMini
                label="Worst Trade"
                value={formatUsd(derived.worstTradePnl)}
                color={pnlColor(derived.worstTradePnl)}
              />
              <StatMini
                label="Profit Factor"
                value={Number(derived.profitFactor).toLocaleString("ru-RU", {
                  maximumFractionDigits: 2,
                })}
                color={UI.yellow}
              />
              <StatMini
                label="Avg Win"
                value={formatUsd(derived.avgWin)}
                color={UI.green}
              />
              <StatMini
                label="Avg Loss"
                value={formatUsd(derived.avgLoss)}
                color={UI.red}
              />
              <StatMini
                label="Gross Profit"
                value={formatUsd(derived.grossProfit)}
                color={UI.green}
              />
              <StatMini
                label="Gross Loss"
                value={formatUsd(derived.grossLossAbs)}
                color={UI.red}
              />
              <StatMini
                label="Volume"
                value={formatUsd(derived.totalVolume)}
                color={UI.blue}
              />
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(3, mounted) }}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionMainTitle}>Открытые позиции</div>
                <div style={styles.sectionSubTitle}>
                  Короткий список: 3 последние открытые
                </div>
              </div>

              <button
                type="button"
                style={styles.inlineAction}
                onClick={() => router.replace("/bot/open-positions")}
              >
                Весь список
              </button>
            </div>

            {!shortOpenList.length ? (
              <div style={styles.emptyText}>Нет открытых позиций.</div>
            ) : (
              <div style={styles.listGrid}>
                {shortOpenList.map((p) => {
                  const t = getPositionDisplayTime(p);
                  const isOpen = expandedOpenId === p.id;

                  return (
                    <div key={p.id} style={styles.listCard}>
                      <button
                        type="button"
                        style={styles.expandButton}
                        onClick={() => setExpandedOpenId(isOpen ? null : p.id)}
                      >
                        <div style={styles.listCardTop}>
                          <div>
                            <div style={styles.listCardTitle}>{p.symbol}</div>
                            <div style={styles.listCardMiniSub}>
                              {t.label}: {t.value}
                            </div>
                          </div>

                          <div style={styles.expandRight}>
                            <div style={styles.statusTag}>#{String(p.orderId ?? p.id).slice(0, 8)}</div>
                            <div style={styles.chevron}>{isOpen ? "−" : "+"}</div>
                          </div>
                        </div>
                      </button>

                      {isOpen ? (
                        <div style={styles.expandBody}>
                          <div style={styles.rowMeta}>
                            <span>Актив: {p.symbol ?? "—"}</span>
                            <span>Биржа: {p.exchange ?? "—"}</span>
                          </div>

                          <div style={styles.rowMeta}>
                            <span>Средняя цена: {p.avgPrice ?? "—"}</span>
                            <span>TP: {p.tpPrice ?? "—"}</span>
                          </div>

                          <div style={styles.rowMeta}>
                            <span>
                              Объем: {p.qty ?? "—"} {String(p.symbol || "").replace("USDT", "") || ""}
                            </span>
                            <span>({formatUsd(p.investedQuote ?? 0)})</span>
                          </div>

                          <div style={styles.rowMetaMuted}>
                            <span>Открыта: {formatDateTime(p.openedAt)}</span>
                            <span>Изменена: {formatDateTime(p.updatedAt ?? p.openedAt)}</span>
                          </div>

                          <div style={styles.rowMetaMuted}>
                            <span>addsCount: {p.addsCount ?? 0}</span>
                            <span>Order: {String(p.orderId ?? p.id)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ ...styles.block, ...reveal(4, mounted) }}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionMainTitle}>История</div>
                <div style={styles.sectionSubTitle}>
                  Короткий список: 3 последние закрытые сделки
                </div>
              </div>

              <button
                type="button"
                style={styles.inlineAction}
                onClick={() => router.replace("/bot/history")}
              >
                Вся история
              </button>
            </div>

            {!shortHistoryList.length ? (
              <div style={styles.emptyText}>Закрытых сделок пока нет.</div>
            ) : (
              <div style={styles.listGrid}>
                {shortHistoryList.map((t) => {
                  const isOpen = expandedHistoryId === t.id;

                  return (
                    <div key={t.id} style={styles.listCard}>
                      <button
                        type="button"
                        style={styles.expandButton}
                        onClick={() => setExpandedHistoryId(isOpen ? null : t.id)}
                      >
                        <div style={styles.listCardTop}>
                          <div>
                            <div style={styles.listCardTitle}>{t.symbol}</div>
                            <div style={styles.listCardMiniSub}>
                              Закрыта: {formatTime(t.closedAt)}
                            </div>
                          </div>

                          <div style={styles.expandRight}>
                            <div
                              style={{
                                ...styles.tradePnl,
                                color: pnlColor(t.pnl),
                              }}
                            >
                              {formatUsd(t.pnl)}
                            </div>
                            <div style={styles.chevron}>{isOpen ? "−" : "+"}</div>
                          </div>
                        </div>
                      </button>

                      {isOpen ? (
                        <div style={styles.expandBody}>
                          <div style={styles.rowMeta}>
                            <span>Актив: {t.symbol ?? "—"}</span>
                            <span>Order: {String(t.orderId ?? t.id)}</span>
                          </div>

                          <div style={styles.rowMeta}>
                            <span>Средняя цена входа: {t.avgEntryPrice ?? "—"}</span>
                            <span>Цена выхода: {t.exitPrice ?? "—"}</span>
                          </div>

                          <div style={styles.rowMeta}>
                            <span>Объем: {t.qty ?? "—"}</span>
                            <span>Вход: {formatUsd(t.entryValue ?? 0)}</span>
                          </div>

                          <div style={styles.rowMeta}>
                            <span>Выход: {formatUsd(t.exitValue ?? 0)}</span>
                            <span>Прибыль: {formatUsd(t.pnl ?? 0)} · {formatPct(t.pnlPercent ?? 0)}</span>
                          </div>

                          <div style={styles.rowMetaMuted}>
                            <span>Открыта: {formatDateTime(t.openedAt)}</span>
                            <span>Закрыта: {formatDateTime(t.closedAt)}</span>
                          </div>

                          <div style={styles.rowMetaMuted}>
                            <span>addsCount: {t.addsCount ?? 0}</span>
                            <span>{getCloseReasonLabel(t.closeReason)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ ...styles.block, ...reveal(5, mounted) }}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionMainTitle}>Конфигурация бота</div>
                <div style={styles.sectionSubTitle}>
                  Сервисный блок настройки
                </div>
              </div>
            </div>

            <div style={styles.formGrid}>
              <Field label="Биржа">
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  style={styles.input}
                >
                  <option value="BINANCE">BINANCE</option>
                  <option value="BYBIT">BYBIT</option>
                  <option value="OKX">OKX</option>
                </select>
              </Field>

              <Field label="API key">
                <select
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Select API key</option>
                  {filteredKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.exchange} {k.label ? `· ${k.label}` : `· ${k.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </Field>

              {!filteredKeys.length ? (
                <div style={styles.inlineHint}>
                  Для биржи {exchange} пока нет ключей. Сначала добавь ключ на странице Keys.
                </div>
              ) : null}

              <Field label="maxActiveSymbols">
                <input
                  value={maxActiveSymbols}
                  onChange={(e) => setMaxActiveSymbols(e.target.value)}
                  placeholder="1..10"
                  style={styles.input}
                />
              </Field>

              <Field label="budgetPerSymbol">
                <input
                  value={budgetPerSymbol}
                  onChange={(e) => setBudgetPerSymbol(e.target.value)}
                  placeholder="50"
                  style={styles.input}
                />
              </Field>

              <Field label="maxTotalBudget">
                <input
                  value={maxTotalBudget}
                  onChange={(e) => setMaxTotalBudget(e.target.value)}
                  placeholder="optional"
                  style={styles.input}
                />
              </Field>

              <Field label="syncIntervalMin">
                <input
                  value={syncIntervalMin}
                  onChange={(e) => setSyncIntervalMin(e.target.value)}
                  placeholder="1..60"
                  style={styles.input}
                />
              </Field>

              <button
                type="button"
                disabled={!canSave}
                onClick={saveConfig}
                style={{
                  ...styles.blockButtonBlue,
                  opacity: canSave ? 1 : 0.7,
                  cursor: canSave ? "pointer" : "not-allowed",
                }}
              >
                {loading ? "..." : "Сохранить конфиг"}
              </button>
            </div>
          </section>

          {err ? (
            <section style={{ ...styles.errorCard, ...reveal(6, mounted) }}>
              <div style={styles.sectionMainTitle}>Ошибка</div>
              <div style={styles.errorText}>{err}</div>
            </section>
          ) : null}

          <section style={{ ...styles.debugCard, ...reveal(7, mounted) }}>
            <div style={styles.debugHeader}>
              <div>
                <div style={styles.debugTitle}>Технический статус</div>
                <div style={styles.debugSub}>Сервисная информация</div>
              </div>

              <div style={styles.debugActions}>
                <button
                  onClick={() => reloadAll(false)}
                  disabled={loading}
                  style={styles.debugActionButton}
                >
                  {loading ? "..." : "Обновить"}
                </button>
              </div>
            </div>

            <div style={styles.debugMeta}>
              <div>
                <span style={styles.debugMetaLabel}>HTTP статус</span>
                <div style={styles.debugMetaValue}>{statusCode ?? "—"}</div>
              </div>

              <div>
                <span style={styles.debugMetaLabel}>Last sync</span>
                <div style={styles.debugMetaValue}>
                  {state?.lastSyncAt ?? "—"}
                </div>
              </div>
            </div>

            <div style={styles.debugBox}>
              {resp ? JSON.stringify(resp, null, 2) : "—"}
            </div>
          </section>

          {pageLoading ? (
            <section style={{ ...styles.loadingCard, ...reveal(8, mounted) }}>
              Загрузка bot dashboard...
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.fieldLabel}>{props.label}</span>
      {props.children}
    </label>
  );
}

function MetricBox(props: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  glowColor?: string;
}) {
  return (
    <div
      style={{
        ...styles.metricItem,
        boxShadow: props.glowColor
          ? `0 0 0 1px ${props.glowColor} inset`
          : undefined,
      }}
    >
      <div style={styles.metricItemLabel}>{props.label}</div>
      <div
        style={{
          ...styles.metricItemValueLarge,
          color: props.valueColor || UI.textMain,
        }}
      >
        {props.value}
      </div>
      {props.sub ? (
        <div style={styles.metricItemSubStrong}>{props.sub}</div>
      ) : null}
    </div>
  );
}

function StatMini(props: { label: string; value: string; color?: string }) {
  return (
    <section style={styles.miniCard}>
      <div style={styles.cardLabel}>{props.label}</div>
      <div
        style={{
          ...styles.miniCardValue,
          color: props.color || UI.textMain,
        }}
      >
        {props.value}
      </div>
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: UI.text,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
    overflowX: "hidden",
  } satisfies CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
    overflowX: "hidden",
  } satisfies CSSProperties,

  topCtaWrap: {
    marginTop: 8,
    marginBottom: 18,
  } satisfies CSSProperties,

  topCtaButton: {
    width: "100%",
    height: 48,
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  topCtaIcon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(41,121,255,0.10)",
    color: UI.blue,
    flexShrink: 0,
  } satisfies CSSProperties,

  botHero: {
    marginTop: 6,
    marginBottom: 20,
    padding: 16,
    borderRadius: 22,
    border: "1px solid rgba(100,217,123,0.16)",
    background:
      "linear-gradient(180deg, rgba(100,217,123,0.06) 0%, rgba(41,121,255,0.035) 100%)",
  } satisfies CSSProperties,

  botTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  } satisfies CSSProperties,

  botEyebrow: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(100,217,123,0.72)",
    marginBottom: 6,
  } satisfies CSSProperties,

  botTitle: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: UI.textMain,
  } satisfies CSSProperties,

  lastSyncChip: {
    padding: "7px 10px",
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.04)",
    color: UI.textMuted,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  botMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  block: {
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
    marginBottom: 20,
  } satisfies CSSProperties,

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  } satisfies CSSProperties,

  sectionMainTitle: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: UI.textMain,
  } satisfies CSSProperties,

  sectionSubTitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.45,
    color: UI.textMuted,
  } satisfies CSSProperties,

  metricItem: {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    minHeight: 118,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minWidth: 0,
  } satisfies CSSProperties,

  metricItemLabel: {
    fontSize: 11,
    color: UI.textMuted,
    marginBottom: 8,
    fontWeight: 600,
    letterSpacing: "0.02em",
  } satisfies CSSProperties,

  metricItemValueLarge: {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  metricItemSubStrong: {
    marginTop: 8,
    fontSize: 12,
    color: UI.textSoft,
    lineHeight: 1.35,
    fontWeight: 600,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  rangeBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  } satisfies CSSProperties,

  rangeChip: {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: "transparent",
    color: UI.textMuted,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  rangeChipActive: {
    background: "rgba(41,121,255,0.16)",
    border: "1px solid rgba(41,121,255,0.30)",
    color: UI.textMain,
  } satisfies CSSProperties,

  customRangeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  } satisfies CSSProperties,

  statsHero: {
    border: `1px solid ${UI.border}`,
    borderRadius: 20,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,0,0,0.03) 100%)",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 12,
    marginBottom: 14,
  } satisfies CSSProperties,

  statsHeroLeft: {
    minWidth: 0,
  } satisfies CSSProperties,

  statsHeroLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 8,
  } satisfies CSSProperties,

  statsHeroValue: {
    fontSize: 34,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.05em",
  } satisfies CSSProperties,

  statsHeroSub: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.45,
    color: UI.textMuted,
  } satisfies CSSProperties,

  winLossCard: {
    borderRadius: 16,
    border: `1px solid ${UI.border}`,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  } satisfies CSSProperties,

  winLossTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    fontWeight: 800,
  } satisfies CSSProperties,

  winLossTrack: {
    marginTop: 10,
    marginBottom: 10,
    width: "100%",
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    background:
      "linear-gradient(90deg, rgba(100,217,123,0.25) 0%, rgba(255,106,106,0.16) 100%)",
    position: "relative",
  } satisfies CSSProperties,

  winLossPositive: {
    height: "100%",
    background: UI.green,
    borderRadius: 999,
  } satisfies CSSProperties,

  winLossBottom: {
    fontSize: 12,
    lineHeight: 1.4,
    color: UI.textMuted,
    fontWeight: 700,
  } satisfies CSSProperties,

  statsGridEnhanced: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  miniCard: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 90,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minWidth: 0,
  } satisfies CSSProperties,

  cardLabel: {
    fontSize: 10,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 8,
  } satisfies CSSProperties,

  miniCardValue: {
    fontSize: 18,
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  inlineAction: {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  } satisfies CSSProperties,

  listGrid: {
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  listCard: {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 14,
  } satisfies CSSProperties,

  expandButton: {
    width: "100%",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
  } satisfies CSSProperties,

  listCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  } satisfies CSSProperties,

  listCardTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: UI.textMain,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  listCardMiniSub: {
    marginTop: 5,
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  expandRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  } satisfies CSSProperties,

  chevron: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    color: UI.textSoft,
  } satisfies CSSProperties,

  expandBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: `1px solid ${UI.borderSoft}`,
  } satisfies CSSProperties,

  statusTag: {
    fontSize: 11,
    fontWeight: 800,
    border: `1px solid ${UI.border}`,
    borderRadius: 999,
    padding: "5px 9px",
    whiteSpace: "nowrap",
    color: UI.textSoft,
  } satisfies CSSProperties,

  tradePnl: {
    fontSize: 13,
    fontWeight: 800,
    textAlign: "right",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  rowMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    fontSize: 12,
    color: UI.textSoft,
    lineHeight: 1.5,
    marginBottom: 6,
  } satisfies CSSProperties,

  rowMetaMuted: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.5,
    marginTop: 2,
  } satisfies CSSProperties,

  emptyText: {
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.55,
  } satisfies CSSProperties,

  formGrid: {
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  fieldWrap: {
    display: "grid",
    gap: 8,
  } satisfies CSSProperties,

  fieldLabel: {
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  input: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    outline: "none",
    padding: "0 14px",
    WebkitAppearance: "none",
    appearance: "none",
  } satisfies CSSProperties,

  inlineHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: UI.textMuted,
    padding: "2px 2px 0",
  } satisfies CSSProperties,

  blockButtonBlue: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 2,
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  errorCard: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "rgba(255,106,106,0.06)",
  } satisfies CSSProperties,

  errorText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textSoft,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  debugCard: {
    marginTop: 4,
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
  } satisfies CSSProperties,

  debugHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  debugTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  debugSub: {
    fontSize: 11,
    color: UI.textFaint,
    marginTop: 4,
  } satisfies CSSProperties,

  debugActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  debugActionButton: {
    height: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  debugMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 10,
  } satisfies CSSProperties,

  debugMetaLabel: {
    display: "block",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    marginBottom: 5,
  } satisfies CSSProperties,

  debugMetaValue: {
    fontSize: 12,
    color: UI.textSoft,
    fontWeight: 600,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  debugBox: {
    whiteSpace: "pre-wrap",
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 14,
    padding: 10,
    minHeight: 100,
    fontSize: 11,
    lineHeight: 1.4,
    overflowX: "auto",
    color: UI.textMuted,
  } satisfies CSSProperties,

  loadingCard: {
    marginTop: 16,
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    color: UI.textMuted,
  } satisfies CSSProperties,
};