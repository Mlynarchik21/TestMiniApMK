"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type HomeMarketResp =
  | {
      ok: true;
      market: {
        totalMarketCapUsd: number;
        totalMarketCapT: string;
        marketCapChange24h: number;
        btcDominance: number;
        ethDominance: number;
        altDominance: number;
        activeCryptocurrencies: number;
        markets: number;
        totalVolumeUsd: number;
      };
      fearGreed: {
        value: number;
        classification: string;
        timestamp: string | null;
        timeUntilUpdate: number;
      };
      altseason: {
        value: number | null;
        source: string | null;
      };
      positioning: {
        spotShare: number | null;
        perpShare: number | null;
        btcLongShortRatio: number | null;
        longPercent: number | null;
        shortPercent: number | null;
        source: string | null;
      };
      updatedAt: string;
    }
  | { ok: false; error: string; message?: string };

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
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
  btc: "#f7931a",
  eth: "#627eea",
  alt: "#64d97b",
};

const SHOW_DEBUG_PANEL = false;

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

function fearFill(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff6a6a",
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

function debugActionStyle(disabled: boolean): CSSProperties {
  return {
    height: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.8 : 1,
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  };
}

function formatPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatUsd(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatTrillionsFromUsdAndPercent(totalUsd: number, percent: number) {
  if (!Number.isFinite(totalUsd) || !Number.isFinite(percent)) return "—";
  return `$${((totalUsd * percent) / 100 / 1_000_000_000_000).toFixed(2)}T`;
}

function getAltseasonLabel(value: number | null) {
  if (value == null) return "Нет данных";
  if (value >= 75) return "Altseason";
  if (value <= 25) return "Bitcoin season";
  return "Промежуточная фаза";
}

function formatUpdatedAt(iso?: string | null) {
  if (!iso) return "—";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pnlColor(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return UI.textMain;
  if (n > 0) return UI.green;
  if (n < 0) return UI.red;
  return UI.textMain;
}

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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M6 6.5h12a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 18 17.5H10l-4.2 3c-.7.5-1.8 0-1.8-.9v-2.1A2.5 2.5 0 0 1 3.5 15V9A2.5 2.5 0 0 1 6 6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2-1.6a.6.6 0 0 0 .1-.8l-1.9-3.3a.6.6 0 0 0-.8-.2L16.4 6a7.8 7.8 0 0 0-1.7-1l-.4-2.6a.6.6 0 0 0-.6-.4H10.3a.6.6 0 0 0-.6.4L9.3 5a7.8 7.8 0 0 0-1.7 1L5.2 4.1a.6.6 0 0 0-.8.2L2.5 7.6a.6.6 0 0 0 .1.8l2 1.6a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2 1.6a.6.6 0 0 0-.1.8l1.9 3.3a.6.6 0 0 0 .8.2l2.4-1a7.8 7.8 0 0 0 1.7 1l.4 2.6a.6.6 0 0 0 .6.4h3.4a.6.6 0 0 0 .6-.4l.4-2.6a7.8 7.8 0 0 0 1.7-1l2.4 1a.6.6 0 0 0 .8-.2l1.9-3.3a.6.6 0 0 0-.1-.8l-2-1.6ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<AnyResp | null>(null);
  const [tokenPreview, setTokenPreview] = useState("нет токена");
  const [mounted, setMounted] = useState(false);
  const [marketData, setMarketData] = useState<HomeMarketResp | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  const [botWidgetLoading, setBotWidgetLoading] = useState(false);
  const [botWidget, setBotWidget] = useState<{
    active: boolean;
    openPositions: number;
    pnlToday: number;
    capitalInWork: number;
  } | null>(null);

  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 5px)"
  );

  async function run(path: string, init?: RequestInit) {
    setLoading(true);
    setStatus(null);
    setResult(null);

    const token = getToken();

    try {
      const res = await fetch(path, {
        cache: "no-store",
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setStatus(res.status);

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await res.json()) as AnyResp)
        : ({
            ok: res.ok,
            error: res.ok ? "" : "invalid_response",
            message: await res.text(),
          } as AnyResp);

      setResult(data);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  async function loadHomeMarket() {
    setMarketLoading(true);

    try {
      const res = await fetch("/api/home-market", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json()) as HomeMarketResp;
      setMarketData(data);
    } catch (e: any) {
      setMarketData({
        ok: false,
        error: e?.message ?? "home market fetch error",
      });
    } finally {
      setMarketLoading(false);
    }
  }

  async function loadBotWidget() {
    setBotWidgetLoading(true);

    const token = getToken();

    try {
      const [botRes, statsRes] = await Promise.all([
        fetch("/api/bot", {
          method: "GET",
          cache: "no-store",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
        fetch("/api/bot/stats?recentTake=20", {
          method: "GET",
          cache: "no-store",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
      ]);

      const botJson = (await botRes.json().catch(() => ({
        ok: false,
      }))) as AnyResp;

      const statsJson = (await statsRes.json().catch(() => ({
        ok: false,
      }))) as AnyResp;

      const config = botJson.ok ? (botJson as any).config ?? null : null;
      const state = botJson.ok ? (botJson as any).state ?? null : null;
      const positions =
        botJson.ok && Array.isArray((botJson as any).positions)
          ? (botJson as any).positions
          : [];

      const active =
        !!config?.enabled &&
        String(state?.status ?? "").toUpperCase() !== "STOPPED" &&
        String(state?.status ?? "").toUpperCase() !== "IDLE";

      const openPositions = statsJson.ok
        ? Number((statsJson as any)?.stats?.openPositions ?? positions.length ?? 0)
        : positions.length;

      const pnlToday = statsJson.ok
        ? Number((statsJson as any)?.stats?.pnlToday ?? 0)
        : 0;

      const capitalInWork = statsJson.ok
        ? Number((statsJson as any)?.stats?.capitalInWork ?? 0)
        : 0;

      setBotWidget({
        active,
        openPositions,
        pnlToday,
        capitalInWork,
      });
    } catch {
      setBotWidget(null);
    } finally {
      setBotWidgetLoading(false);
    }
  }

  const checkMe = () => run("/api/me", { method: "GET" });

  useEffect(() => {
    const t = getToken();
    setTokenPreview(
      t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена"
    );

    checkMe();
    loadHomeMarket();
    loadBotWidget();

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

    const pollId = setInterval(() => {
      loadBotWidget();
    }, 15000);

    const id = requestAnimationFrame(() => setMounted(true));

    return () => {
      clearInterval(pollId);
      cancelAnimationFrame(id);

      try {
        if (tg?.offEvent) {
          tg.offEvent("fullscreen_changed", updateLayout);
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marketCapT = marketData?.ok ? marketData.market.totalMarketCapT : "—";
  const marketChange24h = marketData?.ok
    ? marketData.market.marketCapChange24h
    : null;
  const fearValue = marketData?.ok ? marketData.fearGreed.value : 0;
  const fearText = marketData?.ok
    ? marketData.fearGreed.classification
    : "Нет данных";
  const btcDominance = marketData?.ok ? marketData.market.btcDominance : null;
  const ethDominance = marketData?.ok ? marketData.market.ethDominance : null;
  const altDominance = marketData?.ok ? marketData.market.altDominance : null;
  const altseasonValue = marketData?.ok ? marketData.altseason.value : null;
  const updatedAt = marketData?.ok ? formatUpdatedAt(marketData.updatedAt) : "—";

  const spotShare = marketData?.ok ? marketData.positioning.spotShare : null;
  const perpShare = marketData?.ok ? marketData.positioning.perpShare : null;
  const longPercent = marketData?.ok ? marketData.positioning.longPercent : null;
  const shortPercent = marketData?.ok ? marketData.positioning.shortPercent : null;
  const longShortRatio = marketData?.ok
    ? marketData.positioning.btcLongShortRatio
    : null;

  const botActive = botWidget?.active ?? false;
  const botOpenPositions = botWidget?.openPositions ?? 0;
  const botPnlToday = botWidget?.pnlToday ?? 0;
  const botCapitalInWork = botWidget?.capitalInWork ?? 0;

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
              <div style={styles.metricLabel}>Рын. капитализация</div>

              <div style={styles.heroRightColumn}>
                <div style={styles.updatedAt}>Обновлено: {updatedAt}</div>

                <div style={styles.topActions}>
                  <button
                    type="button"
                    aria-label="Уведомления"
                    style={styles.iconButton}
                    onClick={() => router.replace("/notifications")}
                  >
                    <BellIcon />
                  </button>

                  <button
                    type="button"
                    aria-label="Поддержка"
                    style={styles.iconButton}
                    onClick={() => router.replace("/support")}
                  >
                    <ChatIcon />
                  </button>

                  <button
                    type="button"
                    aria-label="Настройки"
                    style={styles.iconButton}
                    onClick={() => router.replace("/settings")}
                  >
                    <SettingsIcon />
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.heroRowMiddle}>
              <div style={styles.metricValueRow}>
                <span style={styles.metricValue}>{marketCapT}</span>
                <span style={styles.metricTinyUnit}>T</span>
                <span style={styles.metricUnit}>USDT</span>
              </div>
            </div>

            <div style={styles.deltaRowInline}>
              <span style={styles.deltaLabel}>Изменение за день</span>
              <span
                style={{
                  ...styles.deltaNegative,
                  color:
                    marketChange24h != null
                      ? marketChange24h >= 0
                        ? UI.green
                        : UI.red
                      : UI.textMuted,
                }}
              >
                {marketChange24h != null ? formatPct(marketChange24h) : "—"}
              </span>
            </div>
          </section>

          <section style={{ ...styles.heroCard, ...reveal(1, mounted) }}>
            <div style={styles.sentimentHeader}>
              <div style={styles.sentimentTitle}>Жадность и страх</div>
              <div style={styles.sentimentBadgeDanger}>
                {marketData?.ok ? `${marketData.fearGreed.value}%` : "—"}
              </div>
            </div>

            <div style={styles.fearTrack}>
              <div style={fearFill(fearValue)} />
            </div>

            <div style={{ ...styles.smallSub, marginTop: 10 }}>{fearText}</div>

            <div style={styles.heroButtons}>
              <button
                type="button"
                style={styles.primaryPill}
                onClick={() => router.replace("/profile")}
              >
                Профиль
              </button>
            </div>
          </section>

          <section style={{ ...styles.blockNoBorder, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>BTC Dominance</div>
            </div>

            <div style={styles.signalRowTopAligned}>
              <div style={styles.dominanceLegend}>
                <div style={styles.dominanceItem}>
                  <div style={styles.legendLeft}>
                    <span style={{ ...styles.legendDot, background: UI.btc }} />
                    <span style={styles.legendText}>BTC</span>
                  </div>
                  <span style={{ ...styles.legendValue, color: UI.btc }}>
                    {btcDominance != null ? `${btcDominance.toFixed(1)}%` : "—"}
                  </span>
                </div>

                <div style={styles.dominanceItem}>
                  <div style={styles.legendLeft}>
                    <span style={{ ...styles.legendDot, background: UI.eth }} />
                    <span style={styles.legendText}>ETH</span>
                  </div>
                  <span style={{ ...styles.legendValue, color: UI.eth }}>
                    {ethDominance != null ? `${ethDominance.toFixed(1)}%` : "—"}
                  </span>
                </div>

                <div style={styles.dominanceItem}>
                  <div style={styles.legendLeft}>
                    <span style={{ ...styles.legendDot, background: UI.alt }} />
                    <span style={styles.legendText}>Альткойны</span>
                  </div>
                  <span style={{ ...styles.legendValue, color: UI.alt }}>
                    {altDominance != null ? `${altDominance.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>

              <div style={styles.ringWrapLarge}>
                <div
                  style={{
                    ...styles.multiRing,
                    background: marketData?.ok
                      ? `conic-gradient(
                          ${UI.btc} 0 ${marketData.market.btcDominance}%,
                          ${UI.eth} ${marketData.market.btcDominance}% ${
                          marketData.market.btcDominance +
                          marketData.market.ethDominance
                        }%,
                          ${UI.alt} ${
                          marketData.market.btcDominance +
                          marketData.market.ethDominance
                        }% 100%
                        )`
                      : styles.multiRing.background,
                  }}
                />
                <div style={styles.ringCenterLabel}>
                  <div style={styles.ringCenterValueLarge}>
                    {btcDominance != null ? `${btcDominance.toFixed(1)}%` : "—"}
                  </div>
                  <div style={styles.ringCenterSub}>BTC</div>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(3, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Индекс альтсезона</div>
            </div>

            <div style={styles.signalCard}>
              <div style={styles.signalRowTopAligned}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.signalTitle}>Altseason Index</div>
                  <div style={{ ...styles.statBigValue, color: UI.blue }}>
                    {altseasonValue != null ? altseasonValue : "—"}
                  </div>
                  <div style={styles.statSubtitle}>
                    {getAltseasonLabel(altseasonValue)}
                  </div>
                </div>

                <div style={styles.ringWrap}>
                  <div style={ringStyle(altseasonValue ?? 0, UI.blue)} />
                  <div style={styles.ringTextSmall}>
                    {altseasonValue != null ? `${altseasonValue}%` : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.twoCol}>
              <MiniMetric
                label="BTC CAP"
                value={
                  marketData?.ok
                    ? formatTrillionsFromUsdAndPercent(
                        marketData.market.totalMarketCapUsd,
                        marketData.market.btcDominance
                      )
                    : "—"
                }
                sub={
                  marketData?.ok
                    ? `BTC dominance ${marketData.market.btcDominance.toFixed(
                        1
                      )}%`
                    : "Нет данных"
                }
                valueColor={UI.btc}
              />

              <MiniMetric
                label="ALT CAP"
                value={
                  marketData?.ok
                    ? formatTrillionsFromUsdAndPercent(
                        marketData.market.totalMarketCapUsd,
                        marketData.market.altDominance
                      )
                    : "—"
                }
                sub={
                  marketData?.ok
                    ? `Alt dominance ${marketData.market.altDominance.toFixed(
                        1
                      )}%`
                    : "Нет данных"
                }
                valueColor={UI.alt}
              />
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(4, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Positioning</div>
            </div>

            <div style={styles.subBlock}>
              <div style={styles.subBlockTitleRow}>
                <div style={styles.subBlockTitle}>
                  Spot Activity / Perp Activity
                </div>
              </div>

              <div style={styles.splitBar}>
                <div
                  style={{
                    ...styles.splitBarSpot,
                    width: `${spotShare ?? 0}%`,
                  }}
                />
                <div
                  style={{
                    ...styles.splitBarPerp,
                    width: `${perpShare ?? 0}%`,
                  }}
                />
              </div>

              <div style={styles.splitMeta}>
                <span style={{ color: UI.green }}>
                  {spotShare != null ? `${spotShare}% Spot Activity` : "—"}
                </span>
                <span style={{ color: UI.red }}>
                  {perpShare != null ? `${perpShare}% Perp Activity` : "—"}
                </span>
              </div>

              <div style={styles.bodyTextTight}>
                Движение подтверждается в большей степени спотовым спросом, а
                не перегретым деривативным потоком.
              </div>
            </div>

            <div style={styles.subBlock}>
              <div style={styles.subBlockTitleRow}>
                <div style={styles.subBlockTitle}>BTC Long / Short Ratio</div>
              </div>

              <div style={styles.splitBar}>
                <div
                  style={{
                    ...styles.splitBarLong,
                    width: `${longPercent ?? 0}%`,
                  }}
                />
                <div
                  style={{
                    ...styles.splitBarShort,
                    width: `${shortPercent ?? 0}%`,
                  }}
                />
              </div>

              <div style={styles.splitMeta}>
                <span style={{ color: UI.green }}>
                  {longPercent != null ? `${longPercent}% Longs` : "—"}
                </span>
                <span style={{ color: UI.red }}>
                  {shortPercent != null ? `${shortPercent}% Shorts` : "—"}
                </span>
              </div>

              <div style={styles.bodyTextTight}>
                {longShortRatio != null
                  ? `Текущий BTC Long / Short Ratio: ${longShortRatio}`
                  : "Нет актуальных данных по Long / Short Ratio"}
              </div>
            </div>
          </section>

          <section style={{ ...styles.botBlock, ...reveal(5, mounted) }}>
            <div style={styles.botTopRow}>
              <div>
                <div style={styles.botEyebrow}>TRADING SYSTEM</div>
                <div style={styles.botTitle}>Состояние бота</div>
              </div>

              <StatusDot
                text={
                  botWidgetLoading
                    ? "Загрузка"
                    : botActive
                    ? "Активен"
                    : "Не активен"
                }
                active={botActive}
              />
            </div>

            <div style={styles.botMetricsGrid}>
              <MetricBox
                label="Статус"
                value={
                  botWidgetLoading
                    ? "..."
                    : botActive
                    ? "Активен"
                    : "Остановлен"
                }
                sub={
                  botWidgetLoading
                    ? "Обновляем..."
                    : botActive
                    ? "Runtime ok"
                    : "Бот выключен"
                }
                valueColor={botActive ? UI.green : UI.red}
                glowColor={
                  botActive
                    ? "rgba(100,217,123,0.18)"
                    : "rgba(255,106,106,0.18)"
                }
              />
              <MetricBox
                label="Позиции"
                value={botWidgetLoading ? "..." : String(botOpenPositions)}
                sub="Открыто"
                valueColor={UI.textMain}
                glowColor="rgba(255,255,255,0.10)"
              />
              <MetricBox
                label="PnL today"
                value={botWidgetLoading ? "..." : formatUsd(botPnlToday)}
                sub="USDT"
                valueColor={pnlColor(botPnlToday)}
                glowColor={
                  botPnlToday >= 0
                    ? "rgba(100,217,123,0.18)"
                    : "rgba(255,106,106,0.18)"
                }
              />
              <MetricBox
                label="В работе"
                value={botWidgetLoading ? "..." : formatUsd(botCapitalInWork)}
                sub="USDT"
                valueColor={UI.blue}
                glowColor="rgba(41,121,255,0.18)"
              />
            </div>

            <button
              type="button"
              style={styles.blockButtonBlue}
              onClick={() => router.replace("/bot")}
            >
              Открыть бот
            </button>
          </section>

          {SHOW_DEBUG_PANEL ? (
            <section style={{ ...styles.debugCard, ...reveal(6, mounted) }}>
              <div style={styles.debugHeader}>
                <div>
                  <div style={styles.debugTitle}>Технический статус</div>
                  <div style={styles.debugSub}>Сервисная информация</div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={loadHomeMarket}
                    disabled={marketLoading}
                    style={debugActionStyle(marketLoading)}
                  >
                    {marketLoading ? "..." : "Обновить рынок"}
                  </button>

                  <button
                    onClick={loadBotWidget}
                    disabled={botWidgetLoading}
                    style={debugActionStyle(botWidgetLoading)}
                  >
                    {botWidgetLoading ? "..." : "Обновить бота"}
                  </button>

                  <button
                    onClick={checkMe}
                    disabled={loading}
                    style={debugActionStyle(loading)}
                  >
                    {loading ? "..." : "Проверить /api/me"}
                  </button>
                </div>
              </div>

              <div style={styles.debugMeta}>
                <div>
                  <span style={styles.debugMetaLabel}>sessionToken</span>
                  <div style={styles.debugMetaValue}>{tokenPreview}</div>
                </div>

                <div>
                  <span style={styles.debugMetaLabel}>HTTP статус</span>
                  <div style={styles.debugMetaValue}>{status ?? "—"}</div>
                </div>
              </div>

              <div style={styles.debugMeta}>
                <div>
                  <span style={styles.debugMetaLabel}>fear & greed</span>
                  <div style={styles.debugMetaValue}>
                    {marketData?.ok
                      ? `${marketData.fearGreed.value} · ${marketData.fearGreed.classification}`
                      : "—"}
                  </div>
                </div>

                <div>
                  <span style={styles.debugMetaLabel}>updatedAt</span>
                  <div style={styles.debugMetaValue}>
                    {marketData?.ok ? marketData.updatedAt : "—"}
                  </div>
                </div>
              </div>

              <div style={styles.debugBox}>
                {result ? JSON.stringify(result, null, 2) : "—"}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

function MiniMetric(props: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <section style={styles.miniCard}>
      <div style={styles.cardLabel}>{props.label}</div>
      <div
        style={{
          ...styles.miniCardValue,
          color: props.valueColor || UI.textMain,
        }}
      >
        {props.value}
      </div>
      {props.sub ? <div style={styles.smallSub}>{props.sub}</div> : null}
    </section>
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

function StatusDot(props: { text: string; active?: boolean }) {
  const active = !!props.active;

  return (
    <div
      style={{
        ...styles.statusPill,
        background: active
          ? "rgba(100,217,123,0.08)"
          : "rgba(255,106,106,0.08)",
        border: active
          ? "1px solid rgba(100,217,123,0.22)"
          : "1px solid rgba(255,106,106,0.22)",
        color: active ? UI.green : UI.red,
      }}
    >
      <span
        style={{
          ...styles.statusDot,
          background: active ? UI.green : UI.red,
        }}
      />
      <span>{props.text}</span>
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
    fontSize: 15,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  heroCard: {
    background: "transparent",
    border: "none",
    padding: 0,
    marginBottom: 26,
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

  metricTinyUnit: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    marginLeft: 1,
    marginRight: 3,
  } satisfies CSSProperties,

  metricUnit: {
    fontSize: 18,
    color: UI.textMain,
    fontWeight: 700,
    letterSpacing: "-0.02em",
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

  sentimentHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  } satisfies CSSProperties,

  sentimentTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.yellow,
  } satisfies CSSProperties,

  sentimentBadgeDanger: {
    minWidth: 52,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    background: "transparent",
    border: "none",
    color: UI.red,
    fontWeight: 800,
    fontSize: 14,
    padding: 0,
  } satisfies CSSProperties,

  fearTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(110,25,25,0.50) 0%, rgba(104,71,16,0.42) 46%, rgba(18,62,37,0.42) 100%)",
    overflow: "hidden",
    position: "relative",
  } satisfies CSSProperties,

  heroButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
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

  block: {
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
  } satisfies CSSProperties,

  blockNoBorder: {
    paddingBottom: 20,
    borderBottom: "none",
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

  signalCard: {
    borderBottom: `1px solid ${UI.borderSoft}`,
    paddingBottom: 12,
    marginBottom: 12,
  } satisfies CSSProperties,

  signalTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: UI.textMain,
    marginBottom: 8,
  } satisfies CSSProperties,

  signalRowTopAligned: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    minWidth: 0,
  } satisfies CSSProperties,

  statBigValue: {
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.04em",
  } satisfies CSSProperties,

  statSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 500,
  } satisfies CSSProperties,

  ringWrap: {
    width: 68,
    height: 68,
    position: "relative",
    flexShrink: 0,
  } satisfies CSSProperties,

  ringWrapLarge: {
    width: 86,
    height: 86,
    position: "relative",
    flexShrink: 0,
    marginTop: 2,
  } satisfies CSSProperties,

  ringTextSmall: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: UI.textMain,
  } satisfies CSSProperties,

  dominanceLegend: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  } satisfies CSSProperties,

  dominanceItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minWidth: 0,
  } satisfies CSSProperties,

  legendLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  } satisfies CSSProperties,

  legendText: {
    fontSize: 13,
    color: UI.textSoft,
    fontWeight: 600,
  } satisfies CSSProperties,

  legendValue: {
    fontSize: 15,
    fontWeight: 800,
    flexShrink: 0,
  } satisfies CSSProperties,

  multiRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${UI.btc} 0 56.6%, ${UI.eth} 56.6% 74.4%, ${UI.alt} 74.4% 100%)`,
    WebkitMask:
      "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
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
    fontSize: 12,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1,
  } satisfies CSSProperties,

  ringCenterSub: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: 700,
    color: UI.btc,
  } satisfies CSSProperties,

  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  miniCard: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 108,
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
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  smallSub: {
    marginTop: 8,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.4,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  subBlock: {
    marginTop: 12,
  } satisfies CSSProperties,

  subBlockTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  } satisfies CSSProperties,

  subBlockTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.textMain,
  } satisfies CSSProperties,

  bodyTextTight: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 1.5,
    color: UI.textMuted,
  } satisfies CSSProperties,

  splitBar: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    display: "flex",
  } satisfies CSSProperties,

  splitBarSpot: {
    background: UI.green,
  } satisfies CSSProperties,

  splitBarPerp: {
    background: UI.red,
  } satisfies CSSProperties,

  splitBarLong: {
    background: UI.green,
  } satisfies CSSProperties,

  splitBarShort: {
    background: UI.red,
  } satisfies CSSProperties,

  splitMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  botBlock: {
    marginTop: 8,
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
    background: "rgba(100,217,123,0.08)",
    border: "1px solid rgba(100,217,123,0.22)",
    color: UI.green,
    fontSize: 11,
    fontWeight: 700,
  } satisfies CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: UI.green,
  } satisfies CSSProperties,

  botMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
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
    marginTop: 14,
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  debugCard: {
    marginTop: 20,
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