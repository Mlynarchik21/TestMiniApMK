"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const UI = {
  border: "rgba(255,255,255,0.14)",
  borderSoft: "rgba(255,255,255,0.10)",
  borderHard: "rgba(255,255,255,0.18)",
  text: "#f3f3f3",
  textMain: "rgba(255,255,255,0.98)",
  textSoft: "rgba(255,255,255,0.82)",
  textMuted: "rgba(255,255,255,0.66)",
  textFaint: "rgba(255,255,255,0.46)",
  green: "#64d97b",
  red: "#ff6a6a",
  orange: "#f0a33e",
  blue: "#8eb2ff",
};

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#000000");
      tg?.setBackgroundColor?.("#000000");
    } catch {}
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* OVERVIEW */}
        <section style={styles.heroCard}>
          <div style={styles.metricLabel}>Рын. капитализация</div>

          <div style={styles.metricValueRow}>
            <span style={styles.metricValue}>2.48</span>
            <span style={styles.metricUnit}>T USDT</span>
          </div>

          <div style={styles.deltaRow}>
            <span style={styles.deltaLabel}>Изменение за день</span>
            <span style={styles.deltaNegative}>-0.76%</span>
          </div>

          <div style={styles.pulseRow}>
            <span style={styles.pulseLabel}>Market pulse</span>
            <span style={styles.pulseValue}>Weak recovery</span>
          </div>

          <div style={styles.heroDivider} />

          <div style={styles.heroOverviewGrid}>
            <OverviewMetric
              label="Fear & Greed"
              value="23"
              sub="Extreme Fear"
              valueColor={UI.red}
            />
            <OverviewMetric
              label="BTC Dominance"
              value="56.5%"
              sub="BTC lead"
              valueColor={UI.orange}
            />
          </div>

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

        {/* MARKET REGIME */}
        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Market regime</div>
            <span style={styles.outlineBadge}>Now</span>
          </div>

          <div style={styles.regimeSummary}>BTC leads • Neutral • Medium risk</div>

          <div style={styles.regimeSub}>
            Капитал концентрируется в крупных активах. Альты выглядят слабее и требуют
            избирательного подхода.
          </div>

          <div style={styles.compactGrid}>
            <InfoTile title="Trend" value="Neutral Bullish" sub="Короткий горизонт" />
            <InfoTile title="Leadership" value="BTC / ETH" sub="Фокус капитала" />
            <InfoTile title="Momentum" value="Selective" sub="Не весь рынок" />
            <InfoTile title="Risk" value="Medium" sub="Альты слабее BTC" />
          </div>
        </section>

        {/* KEY SIGNALS */}
        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Key signals</div>
            <span style={styles.outlineBadge}>Live</span>
          </div>

          <div style={styles.compactGrid}>
            <InfoTile title="Funding ↑" value="+0.012%" sub="Нейтрально" valueColor={UI.green} />
            <InfoTile title="OI 24h" value="+4.8%" sub="Интерес растёт" valueColor={UI.blue} />
            <InfoTile title="Long bias" value="61 / 39" sub="Лонги выше" />
            <InfoTile title="Spot &gt; Perp" value="68 / 32" sub="Движение подтверждено" valueColor={UI.green} />
          </div>

          <div style={styles.noteBox}>
            Пока funding не перегрет, а рост OI поддержан спотом, локальный апсайд остаётся
            здоровым.
          </div>
        </section>

        {/* POSITIONING */}
        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Positioning</div>
            <span style={styles.outlineBadge}>Flow</span>
          </div>

          <div style={styles.subBlock}>
            <div style={styles.subBlockTitleRow}>
              <div style={styles.subBlockTitle}>Spot &gt; Perp</div>
              <span style={styles.outlineBadge}>Spot-led</span>
            </div>

            <div style={styles.progressMetaTop}>
              <span style={styles.metaMuted}>Spot buyers</span>
              <span style={styles.metaStrong}>68%</span>
            </div>
            <div style={styles.barTrack}>
              <div style={styles.barFill("68%", UI.green)} />
            </div>

            <div style={styles.progressSpacer} />

            <div style={styles.progressMetaTop}>
              <span style={styles.metaMuted}>Perp activity</span>
              <span style={styles.metaStrong}>32%</span>
            </div>
            <div style={styles.barTrack}>
              <div style={styles.barFill("32%", UI.red)} />
            </div>
          </div>

          <div style={styles.subBlock}>
            <div style={styles.subBlockTitleRow}>
              <div style={styles.subBlockTitle}>Long bias</div>
              <span style={styles.outlineBadge}>Live</span>
            </div>

            <div style={styles.splitBar}>
              <div style={styles.splitBarLong} />
              <div style={styles.splitBarShort} />
            </div>

            <div style={styles.splitMeta}>
              <span style={{ color: UI.green }}>61.4% Longs</span>
              <span style={{ color: UI.red }}>38.6% Shorts</span>
            </div>
          </div>
        </section>

        {/* BTC LEVELS */}
        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>BTC key levels</div>
            <span style={styles.outlineBadge}>Levels</span>
          </div>

          <div style={styles.levelsGrid}>
            <LevelItem
              label="Resistance"
              value="69 200"
              sub="Sell zone"
              color={UI.red}
            />
            <LevelItem
              label="Pivot"
              value="67 850"
              sub="Decision"
              color={UI.orange}
            />
            <LevelItem
              label="Support"
              value="66 400"
              sub="Hold = bullish"
              color={UI.green}
            />
          </div>

          <div style={styles.noteBox}>
            Пока BTC выше 66 400, базовый сценарий остаётся конструктивным. Потеря этой зоны ослабит
            бычий контекст.
          </div>
        </section>

        {/* AI */}
        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>AI Insight</div>
            <span style={styles.outlineBadgeBlue}>AI</span>
          </div>

          <div style={styles.aiList}>
            <div style={styles.aiRow}>
              <span style={styles.aiKey}>Bias</span>
              <span style={styles.aiVal}>BTC priority</span>
            </div>
            <div style={styles.aiRow}>
              <span style={styles.aiKey}>Action</span>
              <span style={styles.aiVal}>Wait for pullbacks</span>
            </div>
            <div style={styles.aiRow}>
              <span style={styles.aiKey}>Risk</span>
              <span style={styles.aiVal}>Weak alts</span>
            </div>
          </div>

          <div style={styles.bodyText}>
            Лучшие входы сейчас в сильные активы после локальных откатов, а не в догонку импульса.
          </div>

          <button
            type="button"
            style={styles.blockButton}
            onClick={() => router.replace("/ai")}
          >
            Открыть AI
          </button>
        </section>

        {/* BOT */}
        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Снимок бота</div>
            <StatusDot text="Активен" />
          </div>

          <div style={styles.compactGrid}>
            <InfoTile title="Статус" value="Активен" sub="Runtime ok" />
            <InfoTile title="Позиции" value="3" sub="Открыто" />
            <InfoTile title="PnL today" value="+12.3" sub="USDT" valueColor={UI.green} />
            <InfoTile title="В работе" value="45" sub="USDT" />
          </div>

          <button
            type="button"
            style={styles.blockButton}
            onClick={() => router.replace("/bot")}
          >
            Открыть бот
          </button>
        </section>

        {/* NAV */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Переходы</div>

          <div style={styles.quickGrid}>
            <QuickNavCard title="Bot" subtitle="Сделки и контроль" onClick={() => router.replace("/bot")} />
            <QuickNavCard title="AI" subtitle="Аналитика рынка" onClick={() => router.replace("/ai")} />
            <QuickNavCard
              title="Profile"
              subtitle="Статус и аккаунт"
              onClick={() => router.replace("/profile")}
            />
            <QuickNavCard
              title="Settings"
              subtitle="Параметры"
              onClick={() => router.replace("/settings")}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function OverviewMetric(props: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div style={styles.overviewMetric}>
      <div style={styles.overviewLabel}>{props.label}</div>
      <div style={{ ...styles.overviewValue, color: props.valueColor || UI.textMain }}>
        {props.value}
      </div>
      {props.sub ? <div style={styles.overviewSub}>{props.sub}</div> : null}
    </div>
  );
}

function InfoTile(props: {
  title: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div style={styles.metricItem}>
      <div style={styles.metricItemLabel}>{props.title}</div>
      <div style={{ ...styles.metricItemValue, color: props.valueColor || UI.textMain }}>
        {props.value}
      </div>
      {props.sub ? <div style={styles.metricItemSub}>{props.sub}</div> : null}
    </div>
  );
}

function LevelItem(props: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div style={styles.levelItem}>
      <div style={styles.levelHead}>
        <span style={{ ...styles.levelDot, background: props.color }} />
        <span style={styles.levelLabel}>{props.label}</span>
      </div>
      <div style={{ ...styles.levelValue, color: props.color }}>{props.value}</div>
      {props.sub ? <div style={styles.levelSub}>{props.sub}</div> : null}
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
    background: "#000",
    color: UI.text,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 88px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
  } as React.CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  heroCard: {
    background: "transparent",
    border: "none",
    padding: 0,
    marginBottom: 26,
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
    fontSize: 40,
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
    gap: 6,
    marginTop: 12,
    flexWrap: "wrap",
  } as React.CSSProperties,

  deltaLabel: {
    fontSize: 14,
    color: UI.textMuted,
    fontWeight: 500,
  } as React.CSSProperties,

  deltaNegative: {
    fontSize: 15,
    color: "#ff5f5f",
    fontWeight: 700,
  } as React.CSSProperties,

  pulseRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  } as React.CSSProperties,

  pulseLabel: {
    fontSize: 12,
    color: UI.textFaint,
    fontWeight: 600,
  } as React.CSSProperties,

  pulseValue: {
    fontSize: 12,
    color: UI.textMain,
    fontWeight: 700,
  } as React.CSSProperties,

  heroDivider: {
    height: 1,
    background: UI.borderSoft,
    margin: "16px 0 16px",
  } as React.CSSProperties,

  heroOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  overviewMetric: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 92,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  } as React.CSSProperties,

  overviewLabel: {
    fontSize: 11,
    color: UI.textMuted,
    marginBottom: 6,
  } as React.CSSProperties,

  overviewValue: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
  } as React.CSSProperties,

  overviewSub: {
    fontSize: 11,
    color: UI.textMuted,
    marginTop: 6,
  } as React.CSSProperties,

  heroButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  } as React.CSSProperties,

  primaryPill: {
    flex: "1 1 180px",
    height: 46,
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "transparent",
    color: UI.textMain,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  block: {
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
    marginBottom: 22,
  } as React.CSSProperties,

  sectionHead: {
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

  regimeSummary: {
    fontSize: 18,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1.15,
    marginBottom: 8,
  } as React.CSSProperties,

  regimeSub: {
    fontSize: 12,
    lineHeight: 1.55,
    color: UI.textSoft,
    marginBottom: 12,
    maxWidth: 460,
  } as React.CSSProperties,

  compactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  metricItem: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 108,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
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

  subBlock: {
    marginTop: 12,
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

  splitBar: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    display: "flex",
  } as React.CSSProperties,

  splitBarLong: {
    width: "61.4%",
    background: UI.green,
  } as React.CSSProperties,

  splitBarShort: {
    width: "38.6%",
    background: UI.red,
  } as React.CSSProperties,

  splitMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,

  levelsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  levelItem: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 112,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  } as React.CSSProperties,

  levelHead: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  } as React.CSSProperties,

  levelDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  } as React.CSSProperties,

  levelLabel: {
    fontSize: 11,
    color: UI.textMuted,
  } as React.CSSProperties,

  levelValue: {
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    marginTop: 8,
  } as React.CSSProperties,

  levelSub: {
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.35,
    marginTop: 8,
  } as React.CSSProperties,

  noteBox: {
    marginTop: 12,
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    fontSize: 12,
    lineHeight: 1.55,
    color: UI.textSoft,
  } as React.CSSProperties,

  aiList: {
    display: "grid",
    gap: 8,
    marginBottom: 12,
  } as React.CSSProperties,

  aiRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottom: `1px solid ${UI.borderSoft}`,
    paddingBottom: 8,
  } as React.CSSProperties,

  aiKey: {
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } as React.CSSProperties,

  aiVal: {
    fontSize: 12,
    color: UI.textMain,
    fontWeight: 700,
  } as React.CSSProperties,

  bodyText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: UI.textSoft,
  } as React.CSSProperties,

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

  section: {
    marginTop: 20,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: UI.textMuted,
    margin: "0 2px 10px",
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
    background: "transparent",
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
};