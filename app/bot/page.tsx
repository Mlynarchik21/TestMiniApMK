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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 4a4 4 0 0 0-4 4v2.1c0 .7-.2 1.4-.6 2L6 14.5c-.4.7.1 1.5.9 1.5h10.2c.8 0 1.3-.8.9-1.5l-1.4-2.4c-.4-.6-.6-1.3-.6-2V8a4 4 0 0 0-4-4Zm0 16a2.5 2.5 0 0 0 2.3-1.5h-4.6A2.5 2.5 0 0 0 12 20Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 4.2 4.5 10v8.1c0 .8.6 1.4 1.4 1.4h4.2v-5.1c0-.8.6-1.4 1.4-1.4h1c.8 0 1.4.6 1.4 1.4v5.1H18a1.4 1.4 0 0 0 1.4-1.4V10L12 4.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 5a7 7 0 1 1-6.7 9h2.1A5 5 0 1 0 12 7c-1.4 0-2.7.6-3.6 1.5L10 10H4V4l2.9 2.9A7 7 0 0 1 12 5Zm-.8 3.5h1.6V12l2.7 1.6-.8 1.3-3.5-2.1V8.5Z"
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
      setMaxTotalBudget(
        c.maxTotalBudget != null ? String(c.maxTotalBudget) : ""
      );
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

      body.maxTotalBudget = maxTotalBudget.trim()
        ? maxTotalBudget.trim()
        : null;

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

  async function openTestTrade() {
    const symbol = testSymbol.trim().toUpperCase();

    if (!symbol || !symbol.endsWith("USDT")) {
      setErr("Укажи символ в формате BTCUSDT");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const r = await api(
        `/api/engine/test-open?symbol=${encodeURIComponent(symbol)}`,
        {
          method: "POST",
        }
      );

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

  async function closeAllDeals() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/engine/test-close-all", {
        method: "POST",
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

  async function purgeHistory() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/engine/test-close-all?purge=1", {
        method: "POST",
      });

      setResp(r.json);
      setStatusCode(r.status);

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

  const botEnabled = !!config?.enabled;
  const runStatus = state?.status ?? "IDLE";
  const isRunning =
    runStatus === "RUNNING" || runStatus === "ACTIVE" || botEnabled;

  const canSave = !loading && !!keyId;
  const activePositionsCount = positions.length;
  const capitalInWork = stats?.capitalInWork ?? 0;
  const pnlToday = stats?.pnlToday ?? 0;
  const winRate = stats?.winRate ?? 0;
  const lastSyncAt = formatDateTime(state?.lastSyncAt);

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
          <section style={{ ...styles.heroTop, ...reveal(0, mounted) }}>
            <div style={styles.heroHeaderRow}>
              <div style={styles.metricLabel}>Trading system</div>

              <div style={styles.heroRightColumn}>
                <div style={styles.updatedAt}>Last sync: {lastSyncAt}</div>

                <div style={styles.topActions}>
                  <button
                    type="button"
                    aria-label="Home"
                    style={styles.iconButton}
                    onClick={() => router.replace("/")}
                  >
                    <HomeIcon />
                  </button>

                  <button
                    type="button"
                    aria-label="History"
                    style={styles.iconButton}
                    onClick={() => router.replace("/history")}
                  >
                    <HistoryIcon />
                  </button>

                  <button
                    type="button"
                    aria-label="Notifications"
                    style={styles.iconButton}
                    onClick={() => router.replace("/notifications")}
                  >
                    <BellIcon />
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.heroRowMiddle}>
              <div style={styles.metricValueRow}>
                <span style={styles.metricValue}>
                  {isRunning ? "ACTIVE" : "IDLE"}
                </span>
              </div>
            </div>

            <div style={styles.deltaRowInline}>
              <span style={styles.deltaLabel}>Состояние движка</span>
              <span
                style={{
                  ...styles.deltaNegative,
                  color: isRunning ? UI.green : UI.textMuted,
                }}
              >
                {runStatus}
              </span>
            </div>
          </section>

          <section style={{ ...styles.botHero, ...reveal(1, mounted) }}>
            <div style={styles.botTopRow}>
              <div>
                <div style={styles.botEyebrow}>BOT CONTROL</div>
                <div style={styles.botTitle}>Состояние бота</div>
              </div>
              <StatusDot text={isRunning ? "Активен" : "Остановлен"} />
            </div>

            <div style={styles.botMetricsGrid}>
              <MetricBox
                label="Статус"
                value={isRunning ? "Активен" : "Стоп"}
                sub={botEnabled ? "Config enabled" : "Config disabled"}
                valueColor={isRunning ? UI.green : UI.textMain}
                glowColor={
                  isRunning
                    ? "rgba(100,217,123,0.18)"
                    : "rgba(255,255,255,0.10)"
                }
              />
              <MetricBox
                label="Позиции"
                value={String(activePositionsCount)}
                sub="Открыто сейчас"
                valueColor={UI.textMain}
                glowColor="rgba(255,255,255,0.10)"
              />
              <MetricBox
                label="PnL today"
                value={formatUsd(pnlToday)}
                sub="За сегодня"
                valueColor={pnlColor(pnlToday)}
                glowColor="rgba(41,121,255,0.16)"
              />
              <MetricBox
                label="В работе"
                value={formatUsd(capitalInWork)}
                sub="Capital in work"
                valueColor={UI.blue}
                glowColor="rgba(41,121,255,0.18)"
              />
            </div>

            <div style={styles.heroButtons}>
              <button
                type="button"
                style={styles.primaryPill}
                disabled={loading}
                onClick={startBot}
              >
                {loading ? "..." : "Запустить бота"}
              </button>

              <button
                type="button"
                style={styles.secondaryPillDanger}
                disabled={loading}
                onClick={stopBot}
              >
                Остановить
              </button>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Статистика</div>
            </div>

            <div style={styles.statsGrid}>
              <StatMini
                label="Total PnL"
                value={formatUsd(stats?.totalPnl ?? 0)}
                color={pnlColor(stats?.totalPnl)}
              />
              <StatMini
                label="PnL Today"
                value={formatUsd(stats?.pnlToday ?? 0)}
                color={pnlColor(stats?.pnlToday)}
              />
              <StatMini
                label="PnL 7d"
                value={formatUsd(stats?.pnl7d ?? 0)}
                color={pnlColor(stats?.pnl7d)}
              />
              <StatMini
                label="PnL 30d"
                value={formatUsd(stats?.pnl30d ?? 0)}
                color={pnlColor(stats?.pnl30d)}
              />
              <StatMini
                label="Win rate"
                value={formatPct(winRate)}
                color={UI.textMain}
              />
              <StatMini
                label="Closed trades"
                value={formatNum(stats?.closedTrades ?? 0, 0)}
                color={UI.textMain}
              />
              <StatMini
                label="Open positions"
                value={formatNum(stats?.openPositions ?? 0, 0)}
                color={UI.textMain}
              />
              <StatMini
                label="Capital in work"
                value={formatUsd(stats?.capitalInWork ?? 0)}
                color={UI.blue}
              />
              <StatMini
                label="Avg trade PnL"
                value={formatUsd(stats?.avgTradePnl ?? 0)}
                color={pnlColor(stats?.avgTradePnl)}
              />
              <StatMini
                label="Best trade"
                value={formatUsd(stats?.bestTradePnl ?? 0)}
                color={pnlColor(stats?.bestTradePnl)}
              />
              <StatMini
                label="Worst trade"
                value={formatUsd(stats?.worstTradePnl ?? 0)}
                color={pnlColor(stats?.worstTradePnl)}
              />
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(3, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Конфигурация бота</div>
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
                  Для биржи {exchange} пока нет ключей. Сначала добавь ключ на
                  странице Keys.
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

          <section style={{ ...styles.block, ...reveal(4, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Тестовые действия</div>
            </div>

            <div style={styles.formGrid}>
              <Field label="Тестовый символ">
                <input
                  value={testSymbol}
                  onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
                  placeholder="BTCUSDT"
                  style={styles.input}
                />
              </Field>

              <button
                type="button"
                disabled={loading}
                onClick={openTestTrade}
                style={styles.blockButtonBlue}
              >
                {loading ? "..." : "Open test trade"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={closeAllDeals}
                style={styles.blockButton}
              >
                Close all deals
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={purgeHistory}
                style={styles.blockButtonDanger}
              >
                Close all + clear history
              </button>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(5, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Активные позиции</div>
            </div>

            {!positions.length ? (
              <div style={styles.emptyText}>
                Пока пусто. Trading Engine ещё не подключён.
              </div>
            ) : (
              <div style={styles.listGrid}>
                {positions.map((p) => (
                  <PositionCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </section>

          <section style={{ ...styles.block, ...reveal(6, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Open positions snapshot</div>
            </div>

            {!statsOpenPositions.length ? (
              <div style={styles.emptyText}>Нет открытых позиций.</div>
            ) : (
              <div style={styles.listGrid}>
                {statsOpenPositions.map((p) => (
                  <SnapshotCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </section>

          <section style={{ ...styles.block, ...reveal(7, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Recent closed trades</div>
            </div>

            {!recentTrades.length ? (
              <div style={styles.emptyText}>Закрытых сделок пока нет.</div>
            ) : (
              <div style={styles.listGrid}>
                {recentTrades.map((t) => (
                  <TradeCard key={t.id} t={t} />
                ))}
              </div>
            )}
          </section>

          {err ? (
            <section style={{ ...styles.errorCard, ...reveal(8, mounted) }}>
              <div style={styles.sectionMainTitle}>Ошибка</div>
              <div style={styles.errorText}>{err}</div>
            </section>
          ) : null}

          <section style={{ ...styles.debugCard, ...reveal(9, mounted) }}>
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
                <span style={styles.debugMetaLabel}>Run status</span>
                <div style={styles.debugMetaValue}>{runStatus}</div>
              </div>
            </div>

            <div style={styles.debugMeta}>
              <div>
                <span style={styles.debugMetaLabel}>Last sync</span>
                <div style={styles.debugMetaValue}>
                  {state?.lastSyncAt ?? "—"}
                </div>
              </div>

              <div>
                <span style={styles.debugMetaLabel}>Last error</span>
                <div style={styles.debugMetaValue}>
                  {state?.lastError ?? "—"}
                </div>
              </div>
            </div>

            <div style={styles.debugBox}>
              {resp ? JSON.stringify(resp, null, 2) : "—"}
            </div>
          </section>
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

function StatusDot(props: { text: string }) {
  const active = props.text.toLowerCase().includes("актив");
  return (
    <div
      style={{
        ...styles.statusPill,
        color: active ? UI.green : UI.textMuted,
        border: active
          ? "1px solid rgba(100,217,123,0.22)"
          : `1px solid ${UI.border}`,
        background: active
          ? "rgba(100,217,123,0.08)"
          : "rgba(255,255,255,0.05)",
      }}
    >
      <span
        style={{
          ...styles.statusDot,
          background: active ? UI.green : UI.textMuted,
        }}
      />
      <span>{props.text}</span>
    </div>
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
      <div style={{ ...styles.miniCardValue, color: props.color || UI.textMain }}>
        {props.value}
      </div>
    </section>
  );
}

function PositionCard({ p }: { p: any }) {
  return (
    <div style={styles.listCard}>
      <div style={styles.listCardTop}>
        <div style={styles.listCardTitle}>
          {p.exchange} · {p.symbol}
        </div>
        <div
          style={{
            ...styles.statusTag,
            color: p.status === "OPEN" ? UI.green : UI.textSoft,
          }}
        >
          {p.status}
        </div>
      </div>

      <div style={styles.rowMeta}>
        <span>avgPrice: {p.avgPrice ?? "—"}</span>
        <span>qty: {p.qty ?? "—"}</span>
      </div>

      <div style={styles.rowMeta}>
        <span>tpPrice: {p.tpPrice ?? "—"}</span>
        <span>investedQuote: {p.investedQuote ?? "0"}</span>
      </div>

      <div style={styles.rowMetaMuted}>
        <span>addsCount: {p.addsCount ?? 0}</span>
        <span>openedAt: {formatDateTime(p.openedAt)}</span>
      </div>
    </div>
  );
}

function SnapshotCard({ p }: { p: any }) {
  return (
    <div style={styles.listCard}>
      <div style={styles.listCardTop}>
        <div style={styles.listCardTitle}>{p.symbol}</div>
      </div>

      <div style={styles.rowMeta}>
        <span>avgPrice: {p.avgPrice ?? "—"}</span>
        <span>qty: {p.qty ?? "—"}</span>
      </div>

      <div style={styles.rowMeta}>
        <span>tpPrice: {p.tpPrice ?? "—"}</span>
        <span>investedQuote: {p.investedQuote ?? "—"}</span>
      </div>

      <div style={styles.rowMetaMuted}>
        <span>addsCount: {p.addsCount ?? 0}</span>
        <span>openedAt: {formatDateTime(p.openedAt)}</span>
      </div>
    </div>
  );
}

function TradeCard({ t }: { t: any }) {
  return (
    <div style={styles.listCard}>
      <div style={styles.listCardTop}>
        <div style={styles.listCardTitle}>
          {t.exchange} · {t.symbol}
        </div>
        <div
          style={{
            ...styles.tradePnl,
            color: pnlColor(t.pnl),
          }}
        >
          {formatUsd(t.pnl)} · {formatPct(t.pnlPercent)}
        </div>
      </div>

      <div style={styles.rowMeta}>
        <span>entryValue: {t.entryValue ?? "—"}</span>
        <span>exitValue: {t.exitValue ?? "—"}</span>
      </div>

      <div style={styles.rowMeta}>
        <span>avgEntry: {t.avgEntryPrice ?? "—"}</span>
        <span>exitPrice: {t.exitPrice ?? "—"}</span>
      </div>

      <div style={styles.rowMetaMuted}>
        <span>qty: {t.qty ?? "—"}</span>
        <span>addsCount: {t.addsCount ?? 0}</span>
      </div>

      <div style={styles.rowMetaMuted}>
        <span>reason: {t.closeReason ?? "—"}</span>
        <span>closedAt: {formatDateTime(t.closedAt)}</span>
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

  heroTop: {
    position: "relative",
    marginTop: 8,
    marginBottom: 16,
  } satisfies CSSProperties,

  heroHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: -8,
    position: "relative",
    top: 14,
    zIndex: 10,
  } satisfies CSSProperties,

  heroRowMiddle: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 4,
  } satisfies CSSProperties,

  heroRightColumn: {
    width: 170,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  } satisfies CSSProperties,

  metricLabel: {
    fontSize: 13,
    color: UI.textMuted,
    fontWeight: 500,
    lineHeight: 1.2,
    margin: 0,
  } satisfies CSSProperties,

  updatedAt: {
    fontSize: 11,
    color: UI.textFaint,
    lineHeight: 1.2,
    textAlign: "right",
    margin: 0,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  topActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    width: "100%",
    marginTop: 6,
  } satisfies CSSProperties,

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.04)",
    color: UI.textMain,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  metricValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 0,
    flexWrap: "wrap",
    marginBottom: 0,
  } satisfies CSSProperties,

  metricValue: {
    fontSize: 40,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.06em",
    color: "#ffffff",
  } satisfies CSSProperties,

  deltaRowInline: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 0,
    marginBottom: 0,
  } satisfies CSSProperties,

  deltaLabel: {
    fontSize: 14,
    color: UI.textMuted,
    fontWeight: 500,
    lineHeight: 1.2,
  } satisfies CSSProperties,

  deltaNegative: {
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.15,
    margin: 0,
  } satisfies CSSProperties,

  botHero: {
    marginTop: 8,
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

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
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

  heroButtons: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    marginTop: 14,
  } satisfies CSSProperties,

  primaryPill: {
    width: "100%",
    height: 46,
    borderRadius: 999,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  secondaryPillDanger: {
    width: "100%",
    height: 44,
    borderRadius: 999,
    border: "1px solid rgba(255,106,106,0.28)",
    background: "transparent",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  block: {
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

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  miniCard: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 88,
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

  blockButton: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 2,
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

  blockButtonDanger: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.26)",
    background: "transparent",
    color: UI.red,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 2,
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

  listCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  } satisfies CSSProperties,

  listCardTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: UI.textMain,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  statusTag: {
    fontSize: 11,
    fontWeight: 800,
    border: `1px solid ${UI.border}`,
    borderRadius: 999,
    padding: "5px 9px",
    whiteSpace: "nowrap",
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
};