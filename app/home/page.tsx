"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ApiSuccess<T = Record<string, unknown>> = { ok: true } & T;
type ApiError = { ok: false; error: string; message?: string; [k: string]: unknown };
type ApiResponse<T = Record<string, unknown>> = ApiSuccess<T> | ApiError;

type MetricItem = {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
};

type QuickAction = {
  title: string;
  subtitle: string;
  href: string;
};

const UI = {
  bg: "#000000",
  panel: "rgba(255,255,255,0.03)",
  panelSoft: "rgba(255,255,255,0.025)",
  border: "rgba(255,255,255,0.10)",
  borderSoft: "rgba(255,255,255,0.07)",
  borderHard: "rgba(255,255,255,0.16)",
  text: "#f3f3f3",
  textMain: "rgba(255,255,255,0.96)",
  textSoft: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.42)",
  green: "#64d97b",
  red: "#ff6a6a",
  orange: "#f0a33e",
  blue: "#8eb2ff",
  yellow: "#f0d25e",
};

const dashboardData = {
  marketCap: "2.48",
  marketCapUnit: "T USDT",
  dailyChange: -0.76,
  fearGreed: 11,
  fearGreedLabel: "Extreme Fear",
  btcDominance: 56.5,
  updatedAt: "12:48 UTC",
  source: "Demo data",
  regime: "Bearish",
  risk: "High",
  bias: "BTC focus",
  spotBuyers: 68,
  perpActivity: 32,
  longRatio: 61.4,
  shortRatio: 38.6,
  aiInsight:
    "Рынок находится в фазе страха и сжатой ликвидности. Вероятна локальная аккумуляция в BTC и ETH, тогда как слабые альты всё ещё несут повышенный риск. До подтверждения импульса приоритет — качественные активы и контроль риска.",
  bot: {
    status: "Активен",
    positions: "3",
    pnlToday: "+12.3",
    capitalAtWork: "45 USDT",
  },
};

const marketStructure: MetricItem[] = [
  { label: "BTC.D", value: "56.5%", sub: "Сила BTC", valueColor: UI.orange },
  { label: "ETH.D", value: "17.8%", sub: "Фокус ETH", valueColor: UI.blue },
  { label: "STABLE.D", value: "7.2%", sub: "Risk-off", valueColor: UI.green },
];

const confirmationMetrics: MetricItem[] = [
  { label: "Funding", value: "+0.012%", sub: "Нейтрально", valueColor: UI.green },
  { label: "OI 24h", value: "+4.8%", sub: "Рост интереса", valueColor: UI.blue },
  { label: "Breadth", value: "62/100", sub: "Позитивный фон" },
  { label: "ETF Flow", value: "+184M", sub: "Сегодня", valueColor: UI.green },
];

const signalMetrics: MetricItem[] = [
  { label: "Fear & Greed", value: "23", sub: "Extreme Fear", valueColor: UI.red },
  { label: "TOTAL OI", value: "$25.58B", sub: "Совокупно" },
  { label: "Coinbase rank", value: "#359", sub: "Exchange rank", valueColor: UI.red },
];

const quickActions: QuickAction[] = [
  { title: "Signals", subtitle: "Ключевые рыночные сигналы", href: "/ai" },
  { title: "Bot", subtitle: "Сделки и контроль позиций", href: "/bot" },
  { title: "Profile", subtitle: "Аккаунт и статус", href: "/profile" },
  { title: "Settings", subtitle: "Параметры приложения", href: "/settings" },
];

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

function getTokenPreview(token: string) {
  return token ? `${token.slice(0, 6)}…${token.slice(-6)} (len=${token.length})` : "нет токена";
}

function initTelegramWebApp() {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
    tg?.setHeaderColor?.("#000000");
    tg?.setBackgroundColor?.("#000000");
  } catch {
    // noop
  }
}

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [tokenPreview, setTokenPreview] = useState("нет токена");

  const isProd = process.env.NODE_ENV === "production";

  const dayChangeColor = useMemo(
    () => (dashboardData.dailyChange >= 0 ? UI.green : UI.red),
    []
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

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await res.json()) as ApiResponse)
        : ({ ok: false, error: "Invalid JSON response" } as ApiResponse);

      setStatus(res.status);
      setResult(data);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  const checkMe = () => run("/api/me", { method: "GET" });

  useEffect(() => {
    setTokenPreview(getTokenPreview(getToken()));
    checkMe();
    initTelegramWebApp();

    const onStorage = () => {
      setTokenPreview(getTokenPreview(getToken()));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <TopSummaryStrip
          trend={dashboardData.regime}
          risk={dashboardData.risk}
          bias={dashboardData.bias}
          updatedAt={dashboardData.updatedAt}
        />

        <section style={styles.heroCard}>
          <div style={styles.heroTopRow}>
            <div>
              <div style={styles.metricLabel}>Рын. капитализация</div>
              <div style={styles.metricValueRow}>
                <span style={styles.metricValue}>{dashboardData.marketCap}</span>
                <span style={styles.metricUnit}>{dashboardData.marketCapUnit}</span>
              </div>
            </div>

            <TagBadge text={dashboardData.source} />
          </div>

          <div style={styles.deltaRow}>
            <span style={styles.deltaLabel}>Изменение за день</span>
            <span style={{ ...styles.deltaValue, color: dayChangeColor }}>
              {dashboardData.dailyChange > 0 ? "+" : ""}
              {dashboardData.dailyChange}%
            </span>
          </div>

          <div style={styles.heroDivider} />

          <div style={styles.sentimentHeader}>
            <div>
              <div style={styles.sentimentTitle}>Жадность и страх</div>
              <div style={styles.sentimentSub}>Рыночное настроение</div>
            </div>
            <div style={styles.sentimentBadgeDanger}>{dashboardData.fearGreed}%</div>
          </div>

          <div style={styles.fearTrack}>
            <div style={styles.fearFill(dashboardData.fearGreed)} />
          </div>

          <div style={styles.heroFootnoteRow}>
            <span style={styles.heroFootnote}>{dashboardData.fearGreedLabel}</span>
            <span style={styles.heroFootnote}>Last update: {dashboardData.updatedAt}</span>
          </div>

          <div style={styles.heroActions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => router.replace("/ai")}
            >
              Открыть сигналы
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => router.replace("/bot")}
            >
              Открыть бот
            </button>
          </div>
        </section>

        <DashboardSection
          title="Market snapshot"
          badge="Core"
          content={
            <>
              <div style={styles.snapshotTop}>
                <div>
                  <div style={{ ...styles.statBigValue, color: UI.orange }}>
                    {dashboardData.btcDominance}%
                  </div>
                  <div style={styles.statSubtitle}>BTC dominance</div>
                </div>

                <div style={styles.ringWrap}>
                  <div style={styles.ring(dashboardData.btcDominance, UI.orange)} />
                  <div style={styles.ringTextSmall}>{dashboardData.btcDominance}%</div>
                </div>
              </div>

              <div style={styles.spacer12} />

              <div style={styles.tripleGrid}>
                {marketStructure.map((item) => (
                  <MiniMetric key={item.label} {...item} />
                ))}
              </div>

              <div style={styles.spacer12} />

              <div style={styles.compactGrid}>
                {confirmationMetrics.map((item) => (
                  <MetricBox key={item.label} {...item} />
                ))}
              </div>
            </>
          }
        />

        <DashboardSection
          title="Signals"
          badge="Overview"
          content={
            <>
              <div style={styles.compactGrid}>
                {signalMetrics.map((item) => (
                  <MetricBox key={item.label} {...item} />
                ))}
              </div>

              <div style={styles.spacer16} />

              <section style={styles.signalCard}>
                <div style={styles.subBlockTitleRow}>
                  <div style={styles.subBlockTitle}>Spot vs Perp pressure</div>
                  <span style={styles.outlineBadge}>Spot-led</span>
                </div>

                <div style={styles.progressMetaTop}>
                  <span style={styles.metaMuted}>Spot buyers</span>
                  <span style={styles.metaStrong}>{dashboardData.spotBuyers}%</span>
                </div>
                <div style={styles.barTrack}>
                  <div style={styles.barFill(`${dashboardData.spotBuyers}%`, UI.green)} />
                </div>

                <div style={styles.progressSpacer} />

                <div style={styles.progressMetaTop}>
                  <span style={styles.metaMuted}>Perp activity</span>
                  <span style={styles.metaStrong}>{dashboardData.perpActivity}%</span>
                </div>
                <div style={styles.barTrack}>
                  <div style={styles.barFill(`${dashboardData.perpActivity}%`, UI.red)} />
                </div>

                <div style={styles.bodyTextTight}>
                  Движение выглядит более подтверждённым спотом, чем перегретыми фьючерсами.
                </div>
              </section>

              <section style={styles.signalCard}>
                <div style={styles.subBlockTitleRow}>
                  <div style={styles.subBlockTitle}>BTC Long / Short Ratio</div>
                  <span style={styles.outlineBadge}>Live</span>
                </div>

                <div style={styles.splitBar}>
                  <div
                    style={{
                      ...styles.splitBarSegment,
                      width: `${dashboardData.longRatio}%`,
                      background: UI.green,
                    }}
                  />
                  <div
                    style={{
                      ...styles.splitBarSegment,
                      width: `${dashboardData.shortRatio}%`,
                      background: UI.red,
                    }}
                  />
                </div>

                <div style={styles.splitMeta}>
                  <span style={{ color: UI.green }}>{dashboardData.longRatio}% Longs</span>
                  <span style={{ color: UI.red }}>{dashboardData.shortRatio}% Shorts</span>
                </div>
              </section>
            </>
          }
        />

        <DashboardSection
          title="AI View"
          badge="AI"
          badgeBlue
          content={
            <>
              <div style={styles.aiGrid}>
                <SummaryChip label="Regime" value={dashboardData.regime} valueColor={UI.red} />
                <SummaryChip label="Risk" value={dashboardData.risk} valueColor={UI.orange} />
                <SummaryChip label="Bias" value={dashboardData.bias} valueColor={UI.blue} />
              </div>

              <div style={styles.spacer12} />

              <div style={styles.bodyText}>{dashboardData.aiInsight}</div>

              <button
                type="button"
                style={styles.blockButton}
                onClick={() => router.replace("/ai")}
              >
                Открыть AI-анализ
              </button>
            </>
          }
        />

        <DashboardSection
          title="Bot snapshot"
          badge="Live"
          content={
            <>
              <div style={styles.sectionHeadCompact}>
                <div style={styles.sectionSubtle}>Состояние торгового модуля</div>
                <StatusDot text={dashboardData.bot.status} />
              </div>

              <div style={styles.compactGrid}>
                <MetricBox label="Статус" value={dashboardData.bot.status} sub="Runtime ok" />
                <MetricBox label="Позиции" value={dashboardData.bot.positions} sub="Открыто" />
                <MetricBox
                  label="PnL today"
                  value={dashboardData.bot.pnlToday}
                  sub="USDT"
                  valueColor={UI.green}
                />
                <MetricBox label="В работе" value={dashboardData.bot.capitalAtWork} sub="Капитал" />
              </div>

              <button
                type="button"
                style={styles.blockButton}
                onClick={() => router.replace("/bot")}
              >
                Перейти к боту
              </button>
            </>
          }
        />

        <section style={styles.section}>
          <div style={styles.sectionTitle}>Быстрые переходы</div>

          <div style={styles.quickGrid}>
            {quickActions.map((item) => (
              <QuickNavCard
                key={item.href}
                title={item.title}
                subtitle={item.subtitle}
                onClick={() => router.replace(item.href)}
              />
            ))}
          </div>
        </section>

        {!isProd ? (
          <section style={styles.debugCard}>
            <div style={styles.debugHeader}>
              <div>
                <div style={styles.debugTitle}>Технический статус</div>
                <div style={styles.debugSub}>Dev-only сервисная информация</div>
              </div>

              <button onClick={checkMe} disabled={loading} style={styles.debugAction(loading)}>
                {loading ? "..." : "Проверить /api/me"}
              </button>
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

            <div style={styles.debugBox}>{result ? JSON.stringify(result, null, 2) : "—"}</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function DashboardSection(props: {
  title: string;
  badge?: string;
  badgeBlue?: boolean;
  content: React.ReactNode;
}) {
  return (
    <section style={styles.block}>
      <div style={styles.sectionHead}>
        <div style={styles.sectionMainTitle}>{props.title}</div>
        {props.badge ? (
          <span style={props.badgeBlue ? styles.outlineBadgeBlue : styles.outlineBadge}>
            {props.badge}
          </span>
        ) : null}
      </div>
      {props.content}
    </section>
  );
}

function TopSummaryStrip(props: {
  trend: string;
  risk: string;
  bias: string;
  updatedAt: string;
}) {
  return (
    <section style={styles.summaryStrip}>
      <SummaryStripItem label="Trend" value={props.trend} valueColor={UI.red} />
      <SummaryStripItem label="Risk" value={props.risk} valueColor={UI.orange} />
      <SummaryStripItem label="Bias" value={props.bias} valueColor={UI.blue} />
      <SummaryStripItem label="Updated" value={props.updatedAt} valueColor={UI.textMain} />
    </section>
  );
}

function SummaryStripItem(props: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={styles.summaryStripItem}>
      <div style={styles.summaryStripLabel}>{props.label}</div>
      <div style={{ ...styles.summaryStripValue, color: props.valueColor || UI.textMain }}>
        {props.value}
      </div>
    </div>
  );
}

function SummaryChip(props: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={styles.summaryChip}>
      <div style={styles.summaryChipLabel}>{props.label}</div>
      <div style={{ ...styles.summaryChipValue, color: props.valueColor || UI.textMain }}>
        {props.value}
      </div>
    </div>
  );
}

function MiniMetric(props: MetricItem) {
  return (
    <section style={styles.miniCard}>
      <div style={styles.cardLabel}>{props.label}</div>
      <div style={{ ...styles.miniCardValue, color: props.valueColor || UI.textMain }}>
        {props.value}
      </div>
      {props.sub ? <div style={styles.smallSub}>{props.sub}</div> : null}
    </section>
  );
}

function MetricBox(props: MetricItem) {
  return (
    <div style={styles.metricItem}>
      <div style={styles.metricItemLabel}>{props.label}</div>
      <div style={{ ...styles.metricItemValue, color: props.valueColor || UI.textMain }}>
        {props.value}
      </div>
      {props.sub ? <div style={styles.metricItemSub}>{props.sub}</div> : null}
    </div>
  );
}

function StatusDot(props: { text: string }) {
  return (
    <div style={styles.statusPill}>
      <span style={styles.statusDot} />
      <span>{props.text}</span>
    </div>
  );
}

function TagBadge(props: { text: string }) {
  return <div style={styles.tagBadge}>{props.text}</div>;
}

function QuickNavCard(props: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} style={styles.quickCard}>
      <div style={styles.quickCardTitle}>{props.title}</div>
      <div style={styles.quickCardSub}>{props.subtitle}</div>
    </button>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: UI.bg,
    color: UI.text,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 88px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
  } as React.CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 18,
  } as React.CSSProperties,

  summaryStripItem: {
    border: `1px solid ${UI.border}`,
    background: UI.panelSoft,
    borderRadius: 16,
    padding: "12px 12px 11px",
  } as React.CSSProperties,

  summaryStripLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 6,
  } as React.CSSProperties,

  summaryStripValue: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1.2,
  } as React.CSSProperties,

  heroCard: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
    border: `1px solid ${UI.border}`,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.015) inset",
  } as React.CSSProperties,

  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  } as React.CSSProperties,

  tagBadge: {
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    color: UI.yellow,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  metricLabel: {
    fontSize: 13,
    color: UI.textMuted,
    marginBottom: 8,
    fontWeight: 500,
  } as React.CSSProperties,

  metricValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  } as React.CSSProperties,

  metricValue: {
    fontSize: 42,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.06em",
    color: UI.textMain,
  } as React.CSSProperties,

  metricUnit: {
    fontSize: 16,
    color: UI.textSoft,
    fontWeight: 600,
    letterSpacing: "-0.02em",
  } as React.CSSProperties,

  deltaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  } as React.CSSProperties,

  deltaLabel: {
    fontSize: 14,
    color: UI.textMuted,
    fontWeight: 500,
  } as React.CSSProperties,

  deltaValue: {
    fontSize: 15,
    fontWeight: 800,
  } as React.CSSProperties,

  heroDivider: {
    height: 1,
    background: UI.borderSoft,
    margin: "16px 0",
  } as React.CSSProperties,

  sentimentHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  } as React.CSSProperties,

  sentimentTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.textMain,
  } as React.CSSProperties,

  sentimentSub: {
    fontSize: 11,
    color: UI.textFaint,
    marginTop: 2,
  } as React.CSSProperties,

  sentimentBadgeDanger: {
    minWidth: 56,
    height: 34,
    borderRadius: 999,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: `1px solid ${UI.borderHard}`,
    color: UI.red,
    fontWeight: 800,
    fontSize: 13,
  } as React.CSSProperties,

  fearTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(110,25,25,0.50) 0%, rgba(104,71,16,0.42) 46%, rgba(18,62,37,0.42) 100%)",
    overflow: "hidden",
  } as React.CSSProperties,

  fearFill: (percent: number): React.CSSProperties => ({
    width: `${percent}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff5a5a",
  }),

  heroFootnoteRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    flexWrap: "wrap",
  } as React.CSSProperties,

  heroFootnote: {
    fontSize: 11,
    color: UI.textMuted,
  } as React.CSSProperties,

  heroActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 16,
  } as React.CSSProperties,

  primaryButton: {
    height: 46,
    borderRadius: 14,
    border: "none",
    background: UI.textMain,
    color: "#000",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  secondaryButton: {
    height: 46,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  block: {
    padding: "18px 0",
    borderBottom: `1px solid ${UI.borderSoft}`,
  } as React.CSSProperties,

  section: {
    marginTop: 20,
  } as React.CSSProperties,

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  } as React.CSSProperties,

  sectionHeadCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  } as React.CSSProperties,

  sectionMainTitle: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: UI.textMain,
  } as React.CSSProperties,

  sectionSubtle: {
    fontSize: 12,
    color: UI.textMuted,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: UI.textMuted,
    margin: "0 2px 10px",
  } as React.CSSProperties,

  outlineBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    fontSize: 11,
    color: UI.textSoft,
    fontWeight: 700,
  } as React.CSSProperties,

  outlineBadgeBlue: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(142,178,255,0.34)",
    fontSize: 11,
    color: UI.blue,
    fontWeight: 700,
  } as React.CSSProperties,

  snapshotTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  } as React.CSSProperties,

  tripleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  compactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  aiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  miniCard: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 104,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  } as React.CSSProperties,

  metricItem: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 104,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  } as React.CSSProperties,

  cardLabel: {
    fontSize: 10,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 8,
  } as React.CSSProperties,

  miniCardValue: {
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  } as React.CSSProperties,

  smallSub: {
    marginTop: 8,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.35,
  } as React.CSSProperties,

  metricItemLabel: {
    fontSize: 11,
    color: UI.textMuted,
    marginBottom: 6,
  } as React.CSSProperties,

  metricItemValue: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.1,
  } as React.CSSProperties,

  metricItemSub: {
    marginTop: 6,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.35,
  } as React.CSSProperties,

  summaryChip: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    background: UI.panelSoft,
  } as React.CSSProperties,

  summaryChipLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 6,
  } as React.CSSProperties,

  summaryChipValue: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.2,
  } as React.CSSProperties,

  subBlockTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  } as React.CSSProperties,

  subBlockTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.textMain,
  } as React.CSSProperties,

  signalCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    background: UI.panelSoft,
    marginTop: 12,
  } as React.CSSProperties,

  progressMetaTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  } as React.CSSProperties,

  metaMuted: {
    fontSize: 11,
    color: UI.textMuted,
  } as React.CSSProperties,

  metaStrong: {
    fontSize: 12,
    fontWeight: 700,
    color: UI.textMain,
  } as React.CSSProperties,

  barTrack: {
    width: "100%",
    height: 9,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  } as React.CSSProperties,

  barFill: (width: string, color: string): React.CSSProperties => ({
    width,
    height: "100%",
    borderRadius: 999,
    background: color,
  }),

  progressSpacer: {
    height: 12,
  } as React.CSSProperties,

  bodyText: {
    fontSize: 12,
    lineHeight: 1.58,
    color: UI.textSoft,
  } as React.CSSProperties,

  bodyTextTight: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 1.5,
    color: UI.textMuted,
  } as React.CSSProperties,

  splitBar: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    display: "flex",
  } as React.CSSProperties,

  splitBarSegment: {
    height: "100%",
  } as React.CSSProperties,

  splitMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,

  statBigValue: {
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.04em",
  } as React.CSSProperties,

  statSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 500,
  } as React.CSSProperties,

  ringWrap: {
    width: 68,
    height: 68,
    position: "relative",
    flexShrink: 0,
  } as React.CSSProperties,

  ring: (percent: number, color: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${color} 0 ${percent}%, rgba(255,255,255,0.10) ${percent}% 100%)`,
    WebkitMask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
  }),

  ringTextSmall: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: UI.textMain,
  } as React.CSSProperties,

  blockButton: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 14,
  } as React.CSSProperties,

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: "transparent",
    border: "1px solid rgba(100,217,123,0.24)",
    color: UI.green,
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: UI.green,
  } as React.CSSProperties,

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  quickCard: {
    textAlign: "left",
    minHeight: 88,
    borderRadius: 16,
    padding: 12,
    border: `1px solid ${UI.border}`,
    background: UI.panelSoft,
    color: UI.textMain,
    cursor: "pointer",
  } as React.CSSProperties,

  quickCardTitle: {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 4,
  } as React.CSSProperties,

  quickCardSub: {
    fontSize: 11,
    lineHeight: 1.4,
    color: UI.textMuted,
  } as React.CSSProperties,

  debugCard: {
    marginTop: 22,
    borderTop: `1px solid ${UI.borderSoft}`,
    paddingTop: 18,
  } as React.CSSProperties,

  debugHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  } as React.CSSProperties,

  debugTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: UI.textMain,
  } as React.CSSProperties,

  debugSub: {
    fontSize: 11,
    color: UI.textFaint,
    marginTop: 4,
  } as React.CSSProperties,

  debugAction: (disabled: boolean): React.CSSProperties => ({
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
  }),

  debugMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 10,
  } as React.CSSProperties,

  debugMetaLabel: {
    display: "block",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    marginBottom: 5,
  } as React.CSSProperties,

  debugMetaValue: {
    fontSize: 12,
    color: UI.textSoft,
    fontWeight: 600,
    wordBreak: "break-word",
  } as React.CSSProperties,

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
  } as React.CSSProperties,

  spacer12: {
    height: 12,
  } as React.CSSProperties,

  spacer16: {
    height: 16,
  } as React.CSSProperties,
};