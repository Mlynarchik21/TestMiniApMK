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
  orange: "#ffb258",
  cyan: "#6fdcff",
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

function safeDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const d = safeDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
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
  if (value === "TP" || value === "TARGET") return "По таргету";
  if (value === "STRATEGY") return "По стратегии";
  return String(reason);
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

function calcTradeDurationMs(t: any) {
  const opened = safeDate(t?.openedAt);
  const closed = safeDate(t?.closedAt);
  if (!opened || !closed) return 0;
  return closed.getTime() - opened.getTime();
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

  const winningTrades = trades.filter((t) => Number(t?.pnl ?? 0) > 0);
  const losingTrades = trades.filter((t) => Number(t?.pnl ?? 0) < 0);

  const maxProfitTrade = winningTrades.length
    ? Math.max(...winningTrades.map((t) => Number(t?.pnl ?? 0)))
    : 0;
  const minProfitTrade = winningTrades.length
    ? Math.min(...winningTrades.map((t) => Number(t?.pnl ?? 0)))
    : 0;
  const avgProfitTrade = winningTrades.length
    ? winningTrades.reduce((sum, t) => sum + Number(t?.pnl ?? 0), 0) / winningTrades.length
    : 0;

  const maxLossTrade = losingTrades.length
    ? Math.min(...losingTrades.map((t) => Number(t?.pnl ?? 0)))
    : 0;
  const minLossTrade = losingTrades.length
    ? Math.max(...losingTrades.map((t) => Number(t?.pnl ?? 0)))
    : 0;
  const avgLossTrade = losingTrades.length
    ? losingTrades.reduce((sum, t) => sum + Math.abs(Number(t?.pnl ?? 0)), 0) /
      losingTrades.length
    : 0;

  const durations = trades
    .map(calcTradeDurationMs)
    .filter((v) => Number.isFinite(v) && v > 0);

  const avgDuration = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  const minDuration = durations.length ? Math.min(...durations) : 0;
  const maxDuration = durations.length ? Math.max(...durations) : 0;

  let totalVolume = 0;
  let maxBalanceSeen = 0;
  let maxProfitSeries = 0;
  let maxLossSeries = 0;

  for (const t of trades) {
    const entryValue = Number(t?.entryValue ?? 0);
    const exitValue = Number(t?.exitValue ?? 0);
    const pnl = Number(t?.pnl ?? 0);
    const balance = Number(t?.maxBalance ?? t?.balanceAfter ?? t?.equityAfter ?? 0);

    if (Number.isFinite(entryValue)) totalVolume += entryValue;
    if (Number.isFinite(exitValue)) totalVolume += exitValue;
    if (Number.isFinite(balance) && balance > maxBalanceSeen) maxBalanceSeen = balance;
    if (Number.isFinite(pnl)) {
      if (pnl > maxProfitSeries) maxProfitSeries = pnl;
      if (pnl < maxLossSeries) maxLossSeries = pnl;
    }
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
    totalVolume,
    maxProfitTrade,
    minProfitTrade,
    avgProfitTrade,
    maxLossTrade,
    minLossTrade,
    avgLossTrade,
    avgDuration,
    minDuration,
    maxDuration,
    maxBalanceSeen,
    maxProfitSeries,
    maxLossSeries,
    wins: wins.length,
    losses: losses.length,
  };
}

function ringStyle(percent: number, color: string): CSSProperties {
  const safePercent = Math.max(0, Math.min(100, percent));
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${color} 0 ${safePercent}%, rgba(255,255,255,0.10) ${safePercent}% 100%)`,
    WebkitMask:
      "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
  };
}

function compactNumber(value: unknown, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function assetCodeFromSymbol(symbol: unknown) {
  const s = String(symbol || "");
  if (!s) return "";
  return s.replace(/USDT$/i, "");
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
  );
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
    "calc(env(safe-area-inset-top, 0px) + 15px)"
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

  async function startBot() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/bot/start", { method: "POST" });
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

  async function stopBot() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/bot/stop", { method: "POST" });
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

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/");
  }

  useEffect(() => {
    reloadAll(true);

    const tg = (window as any)?.Telegram?.WebApp;

    const updateLayout = () => {
      if (tg?.isFullscreen) {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 88px)");
      } else {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 15px)");
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
  const botActive =
    !!config?.enabled &&
    String(state?.status ?? "").toUpperCase() !== "STOPPED" &&
    String(state?.status ?? "").toUpperCase() !== "IDLE";

  const netPnlCirclePercent = Math.min(
    100,
    Math.max(
      0,
      derived.grossProfit + derived.grossLossAbs > 0
        ? (Math.abs(derived.totalPnl) / (derived.grossProfit + derived.grossLossAbs)) * 100
        : 0
    )
  );

  const exchangeBalance =
    Number(stats?.exchangeBalance ?? stats?.balance ?? stats?.equity ?? 0) || 0;
  const collateralAmount =
    Number(stats?.collateral ?? stats?.marginBalance ?? capitalInWork ?? 0) || 0;
  const collateralPercent =
    exchangeBalance > 0
      ? Math.min(100, Math.max(0, (collateralAmount / exchangeBalance) * 100))
      : 0;

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
          <section style={{ ...styles.topBar, ...reveal(0, mounted) }}>
            <button
              type="button"
              aria-label="Назад"
              style={styles.backButton}
              onClick={handleBack}
            >
              <ArrowLeftIcon />
            </button>

            <button
              type="button"
              style={styles.topCtaButton}
              onClick={() => router.push("/keys")}
            >
              <span style={styles.topCtaIcon}>
                <BotIcon />
              </span>
              <span>Добавить API</span>
            </button>
          </section>

          <section style={{ ...styles.botHero, ...reveal(1, mounted) }}>
            <div style={styles.botTopRow}>
              <div style={styles.botEyebrow}>BOT CONTROL</div>

              <div
                style={{
                  ...styles.statusPill,
                  color: botActive ? UI.green : UI.red,
                  border: botActive
                    ? "1px solid rgba(100,217,123,0.22)"
                    : "1px solid rgba(255,106,106,0.22)",
                  background: botActive
                    ? "rgba(100,217,123,0.08)"
                    : "rgba(255,106,106,0.08)",
                }}
              >
                <span
                  style={{
                    ...styles.statusDot,
                    background: botActive ? UI.green : UI.red,
                  }}
                />
                <span>{botActive ? "Активный" : "Не активный"}</span>
              </div>
            </div>

            <div style={styles.botMetricsGrid}>
              <MetricBox
                label="Открытые позиции"
                value={String(openPositionsCount)}
                sub="Сейчас в работе"
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
                sub="Капитал в работе"
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

            <div style={styles.botActionsRow}>
              <button
                type="button"
                style={styles.primaryAction}
                disabled={loading}
                onClick={startBot}
              >
                {loading ? "..." : "Запустить"}
              </button>

              <button
                type="button"
                style={styles.secondaryAction}
                disabled={loading}
                onClick={stopBot}
              >
                Остановить
              </button>

              <button
                type="button"
                style={styles.ghostAction}
                onClick={() => router.push("/bot/config")}
              >
                Настройка бота
              </button>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Статистика</div>
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

              <div style={styles.ringWrapLarge}>
                <div
                  style={ringStyle(
                    netPnlCirclePercent,
                    derived.totalPnl >= 0 ? UI.green : UI.red
                  )}
                />
                <div style={styles.ringCenterLabel}>
                  <div style={styles.ringCenterValueLarge}>
                    {Math.round(netPnlCirclePercent)}%
                  </div>
                  <div
                    style={{
                      ...styles.ringCenterSub,
                      color: derived.totalPnl >= 0 ? UI.green : UI.red,
                    }}
                  >
                    PnL
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.statsUnifiedBlock}>
              <div style={styles.statsUnifiedTop}>
                <div style={styles.statsUnifiedMini}>
                  <span style={styles.statsUnifiedLabel}>Win Rate</span>
                  <span style={{ ...styles.statsUnifiedValue, color: UI.yellow }}>
                    {formatPct(derived.winRate)}
                  </span>
                </div>

                <div style={styles.statsUnifiedMini}>
                  <span style={styles.statsUnifiedLabel}>Profit Factor</span>
                  <span style={{ ...styles.statsUnifiedValue, color: UI.blue }}>
                    {Number(derived.profitFactor).toLocaleString("ru-RU", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div style={styles.statsUnifiedMini}>
                  <span style={styles.statsUnifiedLabel}>Макс баланс</span>
                  <span style={{ ...styles.statsUnifiedValue, color: UI.purple }}>
                    {formatUsd(derived.maxBalanceSeen)}
                  </span>
                </div>
              </div>

              <div style={styles.statsUnifiedMiddle}>
                <div style={styles.dualAnalyticsCard}>
                  <div style={styles.dualAnalyticsHeader}>
                    <span
                      style={{
                        ...styles.analyticsAccent,
                        background: UI.green,
                        boxShadow: `0 0 18px ${UI.green}55`,
                      }}
                    />
                    <span style={styles.dualAnalyticsTitle}>Прибыль</span>
                  </div>

                  <div style={styles.analyticsCompactRows}>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>Макс</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.green }}>
                        {formatUsd(derived.maxProfitTrade)}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>Мин</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.green }}>
                        {formatUsd(derived.minProfitTrade)}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>Средняя</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.green }}>
                        {formatUsd(derived.avgProfitTrade)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.dualAnalyticsCard}>
                  <div style={styles.dualAnalyticsHeader}>
                    <span
                      style={{
                        ...styles.analyticsAccent,
                        background: UI.red,
                        boxShadow: `0 0 18px ${UI.red}55`,
                      }}
                    />
                    <span style={styles.dualAnalyticsTitle}>Убыток</span>
                  </div>

                  <div style={styles.analyticsCompactRows}>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>Макс</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.red }}>
                        {formatUsd(Math.abs(derived.maxLossTrade))}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>Мин</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.red }}>
                        {formatUsd(Math.abs(derived.minLossTrade))}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={{ ...styles.analyticsCompactLabel, color: UI.cyan }}>
                        Время
                      </span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.cyan }}>
                        {formatDuration(derived.avgDuration)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.extremeStrip}>
                <div style={styles.extremeStripCard}>
                  <div style={styles.extremeTitle}>Макс прибыль</div>
                  <div style={styles.extremeValuesRow}>
                    <span style={{ color: UI.green }}>{formatUsd(derived.maxProfitSeries)}</span>
                    <span style={styles.extremeDivider}>•</span>
                    <span style={{ color: UI.textSoft }}>
                      Лучший трейд {formatUsd(derived.bestTradePnl)}
                    </span>
                  </div>
                </div>

                <div style={styles.extremeStripCard}>
                  <div style={styles.extremeTitle}>Макс убыток</div>
                  <div style={styles.extremeValuesRow}>
                    <span style={{ color: UI.red }}>
                      {formatUsd(Math.abs(derived.maxLossSeries))}
                    </span>
                    <span style={styles.extremeDivider}>•</span>
                    <span style={{ color: UI.textSoft }}>
                      Худший трейд {formatUsd(Math.abs(derived.worstTradePnl))}
                    </span>
                  </div>
                </div>

                <div style={styles.extremeStripCard}>
                  <div style={styles.extremeTitle}>Диапазон времени сделки</div>
                  <div style={styles.extremeValuesRow}>
                    <span style={{ color: UI.blue }}>{formatDuration(derived.minDuration)}</span>
                    <span style={styles.extremeDivider}>—</span>
                    <span style={{ color: UI.blue }}>{formatDuration(derived.maxDuration)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(3, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>В работе</div>

              <button
                type="button"
                style={styles.inlineActionGhost}
                onClick={() => router.push("/bot/open-positions")}
              >
                Все ордера
              </button>
            </div>

            {!shortOpenList.length ? (
              <div style={styles.emptyText}>Нет открытых позиций.</div>
            ) : (
              <div style={styles.listGridTight}>
                {shortOpenList.map((p) => {
                  const isOpen = expandedOpenId === p.id;
                  const assetName = assetCodeFromSymbol(p.symbol) || p.symbol || "—";

                  return (
                    <div
                      key={p.id}
                      style={styles.tradeCardCompactDense}
                      onClick={() => setExpandedOpenId(isOpen ? null : p.id)}
                    >
                      <div style={styles.tradeDenseHead}>
                        <div style={styles.tradeDenseAsset}>{assetName}</div>
                        <div style={styles.tradeDenseQty}>
                          {compactNumber(p.qty, 3)} {assetName}
                        </div>
                      </div>

                      <div style={styles.tradeDenseMetaLine}>
                        <span style={styles.tradeDenseOrder}>#{String(p.orderId ?? p.id).slice(0, 10)}</span>
                        <span style={styles.tradeDenseDate}>{formatDate(p.openedAt)}</span>
                      </div>

                      {isOpen ? (
                        <div style={styles.tradeExpandedDense}>
                          <div style={styles.detailsGridDense}>
                            <DetailChip label="Цена" value={compactNumber(p.avgPrice, 3)} color={UI.blue} />
                            <DetailChip label="TP" value={compactNumber(p.tpPrice, 3)} color={UI.green} />
                            <DetailChip label="USDT" value={formatUsd(p.investedQuote ?? 0)} color={UI.yellow} />
                            <DetailChip label="Изменена" value={formatDate(p.updatedAt ?? p.openedAt)} color={UI.textSoft} />
                            <DetailChip label="Усреднений" value={String(p.addsCount ?? 0)} color={UI.purple} />
                            <DetailChip label="Биржа" value={String(p.exchange ?? "—")} color={UI.cyan} />
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
              <div style={styles.sectionMainTitle}>История</div>

              <button
                type="button"
                style={styles.inlineActionGhost}
                onClick={() => router.push("/bot/history")}
              >
                Вся история
              </button>
            </div>

            {!shortHistoryList.length ? (
              <div style={styles.emptyText}>Закрытых сделок пока нет.</div>
            ) : (
              <div style={styles.listGridTight}>
                {shortHistoryList.map((t) => {
                  const isOpen = expandedHistoryId === t.id;
                  const assetName = assetCodeFromSymbol(t.symbol) || t.symbol || "—";

                  return (
                    <div
                      key={t.id}
                      style={styles.tradeCardCompactDense}
                      onClick={() => setExpandedHistoryId(isOpen ? null : t.id)}
                    >
                      <div style={styles.tradeDenseHead}>
                        <div style={styles.tradeDenseAsset}>{assetName}</div>
                        <div
                          style={{
                            ...styles.tradeDenseQty,
                            color: pnlColor(t.pnl),
                          }}
                        >
                          {formatUsd(t.pnl)}
                        </div>
                      </div>

                      <div style={styles.tradeDenseMetaLine}>
                        <span style={styles.tradeDenseOrder}>#{String(t.orderId ?? t.id).slice(0, 10)}</span>
                        <span style={styles.tradeDenseDate}>{formatDate(t.closedAt)}</span>
                      </div>

                      {isOpen ? (
                        <div style={styles.tradeExpandedDense}>
                          <div style={styles.detailsGridDense}>
                            <DetailChip label="Вход" value={compactNumber(t.avgEntryPrice, 3)} color={UI.blue} />
                            <DetailChip label="Выход" value={compactNumber(t.exitPrice, 3)} color={UI.orange} />
                            <DetailChip label="P&L" value={`${formatUsd(t.pnl ?? 0)} · ${formatPct(t.pnlPercent ?? 0)}`} color={pnlColor(t.pnl)} />
                            <DetailChip label="Закрытие" value={getCloseReasonLabel(t.closeReason)} color={UI.yellow} />
                            <DetailChip label="Открыта" value={formatDate(t.openedAt)} color={UI.textSoft} />
                            <DetailChip label="Закрыта" value={formatDate(t.closedAt)} color={UI.textSoft} />
                            <DetailChip label="Вход USDT" value={formatUsd(t.entryValue ?? 0)} color={UI.purple} />
                            <DetailChip label="Выход USDT" value={formatUsd(t.exitValue ?? 0)} color={UI.green} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ ...styles.accountBlock, ...reveal(5, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Состояние счета</div>
            </div>

            <div style={styles.accountInner}>
              <div style={styles.accountLeft}>
                <div style={styles.accountMetric}>
                  <div style={styles.accountMetricLabel}>Баланс на бирже</div>
                  <div style={styles.accountMetricValue}>
                    {formatUsd(exchangeBalance)}
                  </div>
                </div>

                <div style={styles.accountMetric}>
                  <div style={styles.accountMetricLabel}>Сумма залога</div>
                  <div style={{ ...styles.accountMetricValue, color: UI.blue }}>
                    {formatUsd(collateralAmount)}
                  </div>
                </div>
              </div>

              <div style={styles.accountRingWrap}>
                <div style={ringStyle(collateralPercent, UI.blue)} />
                <div style={styles.ringCenterLabel}>
                  <div style={styles.ringCenterValueLarge}>
                    {Math.round(collateralPercent)}%
                  </div>
                  <div style={{ ...styles.ringCenterSub, color: UI.blue }}>
                    Залог
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              style={styles.ghostAction}
              onClick={() => router.push("/bot/account-history")}
            >
              История счета
            </button>
          </section>

          {err ? (
            <section style={{ ...styles.errorCard, ...reveal(6, mounted) }}>
              <div style={styles.sectionMainTitle}>Ошибка</div>
              <div style={styles.errorText}>{err}</div>
            </section>
          ) : null}

          {pageLoading ? (
            <section style={{ ...styles.loadingCard, ...reveal(7, mounted) }}>
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

function DetailChip(props: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        ...styles.detailChip,
        borderColor: `${props.color}33`,
        background: `${props.color}10`,
      }}
    >
      <div style={styles.detailChipLabel}>{props.label}</div>
      <div style={{ ...styles.detailChipValue, color: props.color }}>
        {props.value}
      </div>
    </div>
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

  topBar: {
    marginTop: 8,
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.04)",
    color: UI.textMain,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  topCtaButton: {
    flex: 1,
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
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(100,217,123,0.72)",
    marginTop: 6,
  } satisfies CSSProperties,

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  } satisfies CSSProperties,

  botMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  botActionsRow: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  } satisfies CSSProperties,

  primaryAction: {
    height: 44,
    borderRadius: 14,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  secondaryAction: {
    height: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "transparent",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  } satisfies CSSProperties,

  ghostAction: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 14,
  } satisfies CSSProperties,

  block: {
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
    marginBottom: 20,
  } satisfies CSSProperties,

  accountBlock: {
    paddingBottom: 20,
    marginBottom: 20,
  } satisfies CSSProperties,

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  } satisfies CSSProperties,

  sectionMainTitle: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: UI.textMain,
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
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 12,
    marginBottom: 14,
    alignItems: "center",
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

  ringWrapLarge: {
    width: 112,
    height: 112,
    position: "relative",
    margin: "0 auto",
  } satisfies CSSProperties,

  ringCenterLabel: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 4,
  } satisfies CSSProperties,

  ringCenterValueLarge: {
    fontSize: 18,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1,
  } satisfies CSSProperties,

  ringCenterSub: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: 700,
  } satisfies CSSProperties,

  statsUnifiedBlock: {
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  statsUnifiedTop: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  } satisfies CSSProperties,

  statsUnifiedMini: {
    border: `1px solid ${UI.border}`,
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    gap: 6,
  } satisfies CSSProperties,

  statsUnifiedLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
  } satisfies CSSProperties,

  statsUnifiedValue: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.2,
  } satisfies CSSProperties,

  statsUnifiedMiddle: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  dualAnalyticsCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
  } satisfies CSSProperties,

  dualAnalyticsHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  } satisfies CSSProperties,

  analyticsAccent: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  } satisfies CSSProperties,

  dualAnalyticsTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  analyticsCompactRows: {
    display: "grid",
    gap: 9,
  } satisfies CSSProperties,

  analyticsCompactRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "baseline",
  } satisfies CSSProperties,

  analyticsCompactLabel: {
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  analyticsCompactValue: {
    fontSize: 12,
    fontWeight: 800,
    textAlign: "right",
  } satisfies CSSProperties,

  extremeStrip: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  extremeStripCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
  } satisfies CSSProperties,

  extremeTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 8,
  } satisfies CSSProperties,

  extremeValuesRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 13,
    fontWeight: 800,
  } satisfies CSSProperties,

  extremeDivider: {
    color: UI.textFaint,
  } satisfies CSSProperties,

  inlineActionGhost: {
    height: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  listGridTight: {
    display: "grid",
    gap: 8,
  } satisfies CSSProperties,

  tradeCardCompactDense: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.025) 100%)",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    cursor: "pointer",
  } satisfies CSSProperties,

  tradeDenseHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  } satisfies CSSProperties,

  tradeDenseAsset: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: UI.textMain,
    lineHeight: 1,
  } satisfies CSSProperties,

  tradeDenseQty: {
    fontSize: 12,
    fontWeight: 700,
    color: UI.blue,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  tradeDenseMetaLine: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  tradeDenseOrder: {
    fontSize: 11,
    color: UI.textFaint,
    fontWeight: 700,
  } satisfies CSSProperties,

  tradeDenseDate: {
    fontSize: 11,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  tradeExpandedDense: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid ${UI.borderSoft}`,
  } satisfies CSSProperties,

  detailsGridDense: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
  } satisfies CSSProperties,

  detailChip: {
    border: "1px solid",
    borderRadius: 12,
    padding: "8px 9px",
  } satisfies CSSProperties,

  detailChipLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 4,
  } satisfies CSSProperties,

  detailChipValue: {
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.25,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  accountInner: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 14,
    alignItems: "center",
    border: `1px solid ${UI.border}`,
    borderRadius: 20,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(41,121,255,0.03) 100%)",
  } satisfies CSSProperties,

  accountLeft: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  } satisfies CSSProperties,

  accountMetric: {
    display: "grid",
    gap: 6,
  } satisfies CSSProperties,

  accountMetricLabel: {
    fontSize: 11,
    color: UI.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
  } satisfies CSSProperties,

  accountMetricValue: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: UI.textMain,
  } satisfies CSSProperties,

  accountRingWrap: {
    width: 112,
    height: 112,
    position: "relative",
    flexShrink: 0,
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

  loadingCard: {
    marginTop: 16,
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    color: UI.textMuted,
  } satisfies CSSProperties,
};