"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type KeyRow = {
  id: string;
  exchange: "BINANCE" | "BYBIT" | "OKX";
  label: string | null;
};

type BalanceRow = {
  asset: string;
  free: string;
  locked: string;
};

type StatsRangePreset = "1D" | "1W" | "1M" | "CUSTOM";

const SHOW_TEST_PANEL = true;

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

function hasWord(label: string | null | undefined, word: string) {
  return new RegExp(word, "i").test(label || "");
}

function isBybitDemoKey(
  key: Pick<KeyRow, "exchange" | "label"> | null | undefined
) {
  if (!key) return false;
  return key.exchange === "BYBIT" && hasWord(key.label, "demo");
}

function balanceSum(rows: BalanceRow[]) {
  return rows.reduce((sum, row) => {
    const free = Number(row.free || 0);
    const locked = Number(row.locked || 0);
    return (
      sum +
      (Number.isFinite(free) ? free : 0) +
      (Number.isFinite(locked) ? locked : 0)
    );
  }, 0);
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
  const [mounted, setMounted] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [showPnlInfo, setShowPnlInfo] = useState(false);

  const [testActionLoading, setTestActionLoading] = useState<
    "" | "open" | "average" | "close"
  >("");
  const [testError, setTestError] = useState("");
  const [testSymbol, setTestSymbol] = useState("BTCUSDT");

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
  const [balanceData, setBalanceData] = useState<any>(null);

  const [exchange, setExchange] = useState("BYBIT");
  const [keyId, setKeyId] = useState("");
  const [maxActiveSymbols, setMaxActiveSymbols] = useState("10");
  const [budgetPerSymbol, setBudgetPerSymbol] = useState("50");
  const [maxTotalBudget, setMaxTotalBudget] = useState("");
  const [syncIntervalMin, setSyncIntervalMin] = useState("5");

  const [statsPreset, setStatsPreset] = useState<StatsRangePreset>("1W");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [expandedOpenId, setExpandedOpenId] = useState<string | null>(null);

  const filteredKeys = useMemo(
    () => keys.filter((k) => k.exchange === exchange),
    [keys, exchange]
  );

  const activeKey = useMemo(
    () => keys.find((k) => k.id === keyId) ?? null,
    [keys, keyId]
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
      setExchange(c.exchange ?? "BYBIT");
      setKeyId(c.keyId ?? "");
      setMaxActiveSymbols(String(c.maxActiveSymbols ?? 10));
      setBudgetPerSymbol(String(c.budgetPerSymbol ?? "50"));
      setMaxTotalBudget(c.maxTotalBudget != null ? String(c.maxTotalBudget) : "");
      setSyncIntervalMin(String(c.syncIntervalMin ?? 5));
    }

    return r;
  }

  async function loadStats(
    preset = statsPreset,
    fromValue = customFrom,
    toValue = customTo
  ) {
    const range = getRangeDates(preset, fromValue, toValue);
    const qs = new URLSearchParams();

    if (range.from) qs.set("from", range.from.toISOString());
    if (range.to) qs.set("to", range.to.toISOString());
    qs.set("recentTake", "20");

    const r = await api(`/api/bot/stats?${qs.toString()}`, { method: "GET" });

    if (r.json.ok) {
      setStats((r.json as any).stats ?? null);
      setRecentTrades(((r.json as any).recentTrades ?? []) as any[]);
      setStatsOpenPositions(((r.json as any).openPositions ?? []) as any[]);
    }

    return r;
  }

  async function loadBalance(currentKeyId?: string, currentKeys?: KeyRow[]) {
    const targetKeyId = currentKeyId ?? keyId;
    const keyRows = currentKeys ?? keys;

    if (!targetKeyId) {
      setBalanceData(null);
      setBalanceError("");
      return;
    }

    const targetKey = keyRows.find((k) => k.id === targetKeyId) ?? null;
    if (!targetKey) {
      setBalanceData(null);
      setBalanceError("");
      return;
    }

    setBalanceLoading(true);
    setBalanceError("");

    try {
      const params = new URLSearchParams();
      params.set("keyId", targetKeyId);

      const r = await api(`/api/balance?${params.toString()}`, { method: "GET" });

      if (!r.json.ok) {
        setBalanceData(null);
        setBalanceError(humanizeError(r.json));
        return;
      }

      setBalanceData(r.json);
    } finally {
      setBalanceLoading(false);
    }
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

      const loadedKeys = keysRes.json.ok
        ? (((keysRes.json as any).keys ?? []) as KeyRow[])
        : [];
      const loadedConfig = botRes.json.ok ? (botRes.json as any).config ?? null : null;
      const loadedKeyId = loadedConfig?.keyId ?? "";

      if (loadedKeyId) {
        await loadBalance(loadedKeyId, loadedKeys);
      } else {
        setBalanceData(null);
        setBalanceError("");
      }
    } finally {
      if (showGlobalLoader) setPageLoading(false);
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
    if (!symbol) {
      setTestError("Укажи символ для тестовой сделки");
      return;
    }

    setTestActionLoading("open");
    setTestError("");

    try {
      const r = await api(
        `/api/engine/test-open?symbol=${encodeURIComponent(symbol)}`,
        { method: "POST" }
      );

      setResp(r.json);

      if (!r.json.ok) {
        setTestError(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setTestActionLoading("");
    }
  }

  async function averageTestTrade() {
    const symbol = testSymbol.trim().toUpperCase();
    if (!symbol) {
      setTestError("Укажи символ для усреднения");
      return;
    }

    setTestActionLoading("average");
    setTestError("");

    try {
      const r = await api(
        `/api/engine/test-average?symbol=${encodeURIComponent(symbol)}`,
        { method: "POST" }
      );

      setResp(r.json);

      if (!r.json.ok) {
        setTestError(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setTestActionLoading("");
    }
  }

  async function closeTestTrade() {
    const symbol = testSymbol.trim().toUpperCase();
    if (!symbol) {
      setTestError("Укажи символ для закрытия");
      return;
    }

    setTestActionLoading("close");
    setTestError("");

    try {
      const r = await api(
        `/api/engine/test-close?symbol=${encodeURIComponent(symbol)}`,
        { method: "POST" }
      );

      setResp(r.json);

      if (!r.json.ok) {
        setTestError(humanizeError(r.json));
        return;
      }

      await reloadAll();
    } finally {
      setTestActionLoading("");
    }
  }

  async function copyTestError() {
    if (!testError) return;

    try {
      await navigator.clipboard.writeText(testError);
    } catch {
      setTestError((prev) => prev);
    }
  }

  function handleBack() {
    router.replace("/home");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      reloadAll(false);
    }, 15000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsPreset, customFrom, customTo]);

  useEffect(() => {
    if (!pageLoading) {
      loadStats(statsPreset, customFrom, customTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsPreset, customFrom, customTo]);

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
  const openedToday = liveOpenPositions.filter((p) => isTodayGmtPlus3(p?.openedAt)).length;
  const capitalInWork = Number(stats?.capitalInWork ?? 0);
  const pnlToday = Number(stats?.pnlToday ?? 0);

  const shortOpenList = liveOpenPositions
    .slice()
    .sort((a, b) => {
      const ad = safeDate(a?.updatedAt ?? a?.openedAt)?.getTime() ?? 0;
      const bd = safeDate(b?.updatedAt ?? b?.openedAt)?.getTime() ?? 0;
      return bd - ad;
    })
    .slice(0, 3);

  const botActive =
    !!config?.enabled &&
    String(state?.status ?? "").toUpperCase() !== "STOPPED" &&
    String(state?.status ?? "").toUpperCase() !== "IDLE";

  const netPnlValue = Number(stats?.totalPnl ?? 0);
  const grossProfit = Number(stats?.grossProfit ?? 0);
  const grossLossAbs = Number(stats?.grossLossAbs ?? 0);

  const netPnlCirclePercent = Math.min(
    100,
    Math.max(
      0,
      grossProfit + grossLossAbs > 0
        ? (Math.abs(netPnlValue) / (grossProfit + grossLossAbs)) * 100
        : 0
    )
  );

  const raw = (balanceData as any)?.raw ?? {};
  const balances = (((balanceData as any)?.balances ?? []) as BalanceRow[]) || [];
  const isBybit = activeKey?.exchange === "BYBIT";
  const totalEquity = Number(raw.totalEquity ?? raw.totalWalletBalance ?? 0);
  const totalWalletBalance = Number(raw.totalWalletBalance ?? raw.totalEquity ?? 0);
  const totalAvailableBalance = Number(raw.totalAvailableBalance ?? 0);
  const spotAssetSum = balanceSum(balances);

  const exchangeBalance = isBybit
    ? totalEquity || totalWalletBalance || spotAssetSum
    : spotAssetSum;

  const accountUsagePercent =
    exchangeBalance > 0
      ? Math.min(100, Math.max(0, (capitalInWork / exchangeBalance) * 100))
      : 0;

  const avgDurationMs = Number(stats?.avgDurationMs ?? 0);
  const profitableTrades = Number(stats?.profitableTrades ?? 0);
  const losingTrades = Number(stats?.losingTrades ?? 0);
  const totalTrades = profitableTrades + losingTrades;
  const profitablePct =
    totalTrades > 0 ? Math.min(100, Math.round((profitableTrades / totalTrades) * 100)) : 0;
  const losingPct =
    totalTrades > 0 ? Math.min(100, Math.round((losingTrades / totalTrades) * 100)) : 0;
  const durationHours = avgDurationMs > 0 ? avgDurationMs / (1000 * 60 * 60) : 0;
  const durationPct = Math.min(100, Math.max(8, Math.round(durationHours * 12)));

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
              <div style={styles.botStateLabel}>Состояние бота</div>
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
                sub="GMT+3"
                valueColor={UI.yellow}
                glowColor="rgba(243,215,9,0.14)"
              />
              <MetricBox
                label="Маржа в работе"
                value={formatUsd(capitalInWork)}
                sub="Текущая загрузка"
                valueColor={UI.blue}
                glowColor="rgba(41,121,255,0.18)"
              />
              <MetricBox
                label="PnL за день"
                value={formatUsd(pnlToday)}
                sub="Текущий день"
                valueColor={pnlColor(pnlToday)}
                glowColor={
                  pnlToday >= 0
                    ? "rgba(100,217,123,0.18)"
                    : "rgba(255,106,106,0.18)"
                }
              />
            </div>

            <div style={styles.botActionsGrid}>
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
                style={styles.wideAction}
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
                <label style={styles.fieldWrap}>
                  <span style={styles.fieldLabel}>Дата начала</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.fieldWrap}>
                  <span style={styles.fieldLabel}>Дата конца</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={styles.input}
                  />
                </label>
              </div>
            ) : null}

            <div style={styles.statsHero}>
              <button
                type="button"
                onClick={() => setShowPnlInfo(true)}
                style={styles.infoBtnCorner}
                aria-label="Что значит PnL %"
              >
                i
              </button>

              <div style={styles.statsHeroLeft}>
                <div style={styles.statsHeroLabel}>Net PnL</div>
                <div
                  style={{
                    ...styles.statsHeroValue,
                    color: pnlColor(netPnlValue),
                  }}
                >
                  {formatUsd(netPnlValue)}
                </div>
                <div style={styles.statsHeroSub}>
                  Сделок: {Number(stats?.closedTrades ?? 0)} · Win rate:{" "}
                  {formatPct(stats?.winRate ?? 0)}
                </div>
              </div>

              <div style={styles.ringWrapLarge}>
                <div
                  style={ringStyle(
                    netPnlCirclePercent,
                    netPnlValue >= 0 ? UI.green : UI.red
                  )}
                />
                <div style={styles.ringCenterLabel}>
                  <div style={styles.ringCenterValueLarge}>
                    {Math.round(netPnlCirclePercent)}%
                  </div>
                  <div
                    style={{
                      ...styles.ringCenterSub,
                      color: netPnlValue >= 0 ? UI.green : UI.red,
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
                  <span style={styles.statsUnifiedLabel}>win rate</span>
                  <span style={{ ...styles.statsUnifiedValue, color: UI.yellow }}>
                    {formatPct(stats?.winRate ?? 0)}
                  </span>
                </div>

                <div style={styles.statsUnifiedMini}>
                  <span style={styles.statsUnifiedLabel}>profit factor</span>
                  <span style={{ ...styles.statsUnifiedValue, color: UI.blue }}>
                    {Number(stats?.profitFactor ?? 0).toLocaleString("ru-RU", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div style={styles.statsUnifiedMini}>
                  <span style={styles.statsUnifiedLabel}>max balance</span>
                  <span style={{ ...styles.statsUnifiedValue, color: UI.purple }}>
                    {formatUsd(
                      stats?.maxBalanceSeen ??
                        stats?.maxBalance ??
                        stats?.equityPeak ??
                        0
                    )}
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
                      <span style={styles.analyticsCompactLabel}>max</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.green }}>
                        {formatUsd(stats?.maxProfitTrade ?? 0)}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>min</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.green }}>
                        {formatUsd(stats?.minProfitTrade ?? 0)}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>avg</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.green }}>
                        {formatUsd(stats?.avgProfitTrade ?? 0)}
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
                      <span style={styles.analyticsCompactLabel}>max</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.red }}>
                        {formatUsd(Math.abs(Number(stats?.maxLossTrade ?? 0)))}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>min</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.red }}>
                        {formatUsd(Math.abs(Number(stats?.minLossTrade ?? 0)))}
                      </span>
                    </div>
                    <div style={styles.analyticsCompactRow}>
                      <span style={styles.analyticsCompactLabel}>avg</span>
                      <span style={{ ...styles.analyticsCompactValue, color: UI.red }}>
                        {formatUsd(Math.abs(Number(stats?.avgLossTrade ?? 0)))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.analyticsCircleBlock}>
                <div style={styles.analyticsCircleGrid}>
                  <div style={styles.analyticsCircleCard}>
                    <div style={styles.analyticsCircleTitle}>Avg время</div>
                    <div style={styles.circleWrap}>
                      <div style={ringStyle(durationPct, UI.blue)} />
                      <div style={styles.circleCenterText}>
                        {formatDuration(avgDurationMs)}
                      </div>
                    </div>
                    <div style={styles.circleFootText}>
                      Мин {formatDuration(Number(stats?.minDurationMs ?? 0))}
                    </div>
                    <div style={styles.circleFootText}>
                      Макс {formatDuration(Number(stats?.maxDurationMs ?? 0))}
                    </div>
                  </div>

                  <div style={styles.analyticsCircleCard}>
                    <div style={styles.analyticsCircleTitle}>Плюсовые</div>
                    <div style={styles.circleWrap}>
                      <div style={ringStyle(profitablePct, UI.green)} />
                      <div style={styles.circleCenterText}>
                        {profitableTrades}
                      </div>
                    </div>
                    <div style={styles.circleFootText}>{profitablePct}% от всех</div>
                    <div style={styles.circleFootText}>
                      Avg PnL {formatUsd(stats?.avgTradePnl ?? 0)}
                    </div>
                  </div>

                  <div style={styles.analyticsCircleCard}>
                    <div style={styles.analyticsCircleTitle}>Минусовые</div>
                    <div style={styles.circleWrap}>
                      <div style={ringStyle(losingPct, UI.red)} />
                      <div style={styles.circleCenterText}>
                        {losingTrades}
                      </div>
                    </div>
                    <div style={styles.circleFootText}>{losingPct}% от всех</div>
                    <div style={styles.circleFootText}>
                      Сделок {Number(stats?.closedTrades ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.accountBlock, ...reveal(3, mounted) }}>
            <div style={styles.accountInner}>
              <div style={styles.accountLeft}>
                <div style={styles.accountMetric}>
                  <div style={styles.accountMetricLabel}>Баланс на бирже</div>
                  <div style={styles.accountMetricValue}>
                    {formatUsd(exchangeBalance)}
                  </div>
                </div>

                <div style={styles.accountMetric}>
                  <div style={styles.accountMetricLabel}>Сумма в работе</div>
                  <div style={{ ...styles.accountMetricValue, color: UI.blue }}>
                    {formatUsd(capitalInWork)}
                  </div>
                </div>

                <div style={styles.accountSubMeta}>
                  <span>available {formatUsd(totalAvailableBalance)}</span>
                </div>
              </div>

              <div style={styles.accountRingWrap}>
                <div style={ringStyle(accountUsagePercent, UI.blue)} />
                <div style={styles.ringCenterLabel}>
                  <div style={styles.ringCenterValueLarge}>
                    {Math.round(accountUsagePercent)}%
                  </div>
                  <div style={{ ...styles.ringCenterSub, color: UI.blue }}>
                    В работе
                  </div>
                </div>
              </div>
            </div>

            {balanceError ? (
              <div style={styles.accountError}>{balanceError}</div>
            ) : null}

            <button
              type="button"
              style={styles.wideGhostAction}
              onClick={() => router.push("/bot/account-history")}
              disabled={balanceLoading}
            >
              {balanceLoading ? "..." : "История счета"}
            </button>
          </section>

          <section style={{ ...styles.block, ...reveal(4, mounted) }}>
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
                        <span style={styles.tradeDenseOrder}>
                          #{String(p.orderId ?? p.id).slice(0, 10)}
                        </span>
                        <span style={styles.tradeDenseDate}>
                          {formatDate(p.openedAt)}
                        </span>
                      </div>

                      {isOpen ? (
                        <div style={styles.tradeExpandedDense}>
                          <div style={styles.detailsGridDense}>
                            <DetailChip
                              label="Цена"
                              value={compactNumber(p.avgPrice, 3)}
                              color={UI.blue}
                            />
                            <DetailChip
                              label="TP"
                              value={compactNumber(p.tpPrice, 3)}
                              color={UI.green}
                            />
                            <DetailChip
                              label="USDT"
                              value={formatUsd(p.investedQuote ?? 0)}
                              color={UI.yellow}
                            />
                            <DetailChip
                              label="Изм."
                              value={formatDate(p.updatedAt ?? p.openedAt)}
                              color={UI.textSoft}
                            />
                            <DetailChip
                              label="adds"
                              value={String(p.addsCount ?? 0)}
                              color={UI.purple}
                            />
                            <DetailChip
                              label="Биржа"
                              value={String(p.exchange ?? "—")}
                              color={UI.cyan}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {SHOW_TEST_PANEL ? (
            <section style={{ ...styles.debugCard, ...reveal(5, mounted) }}>
              <div style={styles.sectionHead}>
                <div style={styles.sectionMainTitle}>Тестовая панель</div>
              </div>

              <div style={styles.testHint}>
                Временный блок для тестов. Позже его уберём.
              </div>

              <div style={styles.testPanelCard}>
                <label style={styles.fieldWrap}>
                  <span style={styles.fieldLabel}>Тестовый символ</span>
                  <input
                    value={testSymbol}
                    onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
                    placeholder="BTCUSDT"
                    style={styles.input}
                  />
                </label>

                <div style={styles.testActionsGrid}>
                  <button
                    type="button"
                    style={styles.testPrimaryBtn}
                    onClick={openTestTrade}
                    disabled={testActionLoading !== ""}
                  >
                    {testActionLoading === "open" ? "..." : "Открыть тест сделку"}
                  </button>

                  <button
                    type="button"
                    style={styles.testGhostBtn}
                    onClick={averageTestTrade}
                    disabled={testActionLoading !== ""}
                  >
                    {testActionLoading === "average" ? "..." : "Усреднить тест сделку"}
                  </button>

                  <button
                    type="button"
                    style={styles.testDangerBtn}
                    onClick={closeTestTrade}
                    disabled={testActionLoading !== ""}
                  >
                    {testActionLoading === "close" ? "..." : "Закрыть тест сделку"}
                  </button>
                </div>
              </div>

              {testError ? (
                <div style={styles.testErrorCard}>
                  <div style={styles.testErrorHead}>
                    <div style={styles.testErrorTitle}>Ошибка тестового действия</div>
                    <button
                      type="button"
                      style={styles.copyBtn}
                      onClick={copyTestError}
                    >
                      Копировать
                    </button>
                  </div>

                  <div style={styles.testErrorText}>{testError}</div>
                </div>
              ) : null}
            </section>
          ) : null}

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

      {showPnlInfo ? (
        <div style={styles.modalOverlay} onClick={() => setShowPnlInfo(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Что означает PnL %</div>
            <div style={styles.modalText}>
              Это относительная эффективность стратегии.
              <br />
              <br />
              Показывает долю чистой прибыли относительно общего объема прибыли и убытков.
              <br />
              <br />
              Чем выше значение, тем лучше соотношение результата к риску.
            </div>
            <button
              type="button"
              style={styles.modalBtn}
              onClick={() => setShowPnlInfo(false)}
            >
              Понял
            </button>
          </div>
        </div>
      ) : null}
    </>
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  } satisfies CSSProperties,

  botStateLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: UI.textMain,
    letterSpacing: "-0.01em",
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

  botActionsGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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

  wideAction: {
    gridColumn: "1 / -1",
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  wideGhostAction: {
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
    borderBottom: `1px solid ${UI.borderSoft}`,
    marginBottom: 20,
  } satisfies CSSProperties,

  debugCard: {
    marginTop: 0,
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
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

  statsHero: {
    position: "relative",
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

  infoBtnCorner: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    zIndex: 3,
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

  analyticsCircleBlock: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.025)",
  } satisfies CSSProperties,

  analyticsCircleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  analyticsCircleCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,

  analyticsCircleTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: UI.textSoft,
    textAlign: "center",
  } satisfies CSSProperties,

  circleWrap: {
    width: 76,
    height: 76,
    position: "relative",
  } satisfies CSSProperties,

  circleCenterText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 800,
    color: UI.textMain,
    padding: 8,
    lineHeight: 1.1,
  } satisfies CSSProperties,

  circleFootText: {
    fontSize: 11,
    color: UI.textMuted,
    textAlign: "center",
    lineHeight: 1.35,
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

  accountSubMeta: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  accountError: {
    marginTop: 10,
    fontSize: 12,
    color: UI.red,
    lineHeight: 1.5,
  } satisfies CSSProperties,

  emptyText: {
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.55,
  } satisfies CSSProperties,

  testHint: {
    fontSize: 12,
    color: UI.textMuted,
    marginBottom: 10,
    lineHeight: 1.5,
  } satisfies CSSProperties,

  testPanelCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  testActionsGrid: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  testPrimaryBtn: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  testGhostBtn: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  testDangerBtn: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "rgba(255,106,106,0.10)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  } satisfies CSSProperties,

  testErrorCard: {
    marginTop: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "rgba(255,106,106,0.06)",
    padding: 14,
  } satisfies CSSProperties,

  testErrorHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  } satisfies CSSProperties,

  testErrorTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  testErrorText: {
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textSoft,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  copyBtn: {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
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

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: 16,
  } satisfies CSSProperties,

  modalCard: {
    width: "100%",
    maxWidth: 320,
    background: "#0c0c0c",
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 16,
  } satisfies CSSProperties,

  modalTitle: {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 10,
    color: UI.textMain,
  } satisfies CSSProperties,

  modalText: {
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.6,
  } satisfies CSSProperties,

  modalBtn: {
    marginTop: 14,
    width: "100%",
    height: 40,
    borderRadius: 12,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,
};