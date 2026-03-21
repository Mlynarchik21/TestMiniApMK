"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

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
  orange: "#f0a33e",
  blue: "#8eb2ff",
};

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<AnyResp | null>(null);

  const tokenPreview = useMemo(() => {
    const t = getToken();
    return t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена";
  }, []);

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
      setResult((await res.json()) as AnyResp);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  const checkMe = () => run("/api/me", { method: "GET" });

  useEffect(() => {
    checkMe();

    try {
      const tg = (window as any)?.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#000000");
      tg?.setBackgroundColor?.("#000000");
    } catch {}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
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

          <div style={styles.heroDivider} />

          <div style={styles.sentimentHeader}>
            <div>
              <div style={styles.sentimentTitle}>Жадность и страх</div>
              <div style={styles.sentimentSub}>Рыночное настроение</div>
            </div>
            <div style={styles.sentimentBadgeDanger}>11%</div>
          </div>

          <div style={styles.fearTrack}>
            <div style={styles.fearFill(11)} />
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

        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>BTC Dominance</div>
          </div>

          <div style={styles.signalRow}>
            <div>
              <div style={{ ...styles.statBigValue, color: UI.orange }}>56.5%</div>
              <div style={styles.statSubtitle}>Лидерство BTC на рынке</div>
            </div>

            <div style={styles.ringWrap}>
              <div style={styles.ring(56.5, UI.orange)} />
              <div style={styles.ringTextSmall}>56.5%</div>
            </div>
          </div>
        </section>

        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Signals</div>
            <span style={styles.outlineBadge}>Overview</span>
          </div>

          <div style={styles.signalGrid}>
            <SignalCard
              title="Fear & Greed"
              value="23"
              sub="Extreme Fear"
              accent={UI.red}
              right={
                <div style={styles.miniProgress}>
                  <div
                    style={{
                      ...styles.miniProgressFill,
                      width: "23%",
                      background: UI.red,
                    }}
                  />
                </div>
              }
            />
          </div>

          <div style={styles.twoCol}>
            <MiniMetric label="TOTAL OI" value="$25.58B" sub="Совокупно" />
            <MiniMetric label="COINBASE" value="#359" sub="Exchange rank" valueColor={UI.red} />
          </div>
        </section>

        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Market structure</div>
            <span style={styles.outlineBadge}>Core</span>
          </div>

          <div style={styles.tripleGrid}>
            <MiniMetric label="BTC.D" value="56.5%" valueColor={UI.orange} sub="Сила BTC" />
            <MiniMetric label="ETH.D" value="17.8%" valueColor={UI.blue} sub="Фокус ETH" />
            <MiniMetric label="STABLE.D" value="7.2%" valueColor={UI.green} sub="Risk-off" />
          </div>

          <div style={styles.stackGap} />

          <div style={styles.compactGrid}>
            <MetricBox label="Funding" value="+0.012%" sub="Нейтрально" valueColor={UI.green} />
            <MetricBox label="OI 24h" value="+4.8%" sub="Рост интереса" valueColor={UI.blue} />
            <MetricBox label="Breadth" value="62/100" sub="В плюсе" valueColor={UI.textMain} />
            <MetricBox label="ETF Flow" value="+184M" sub="Сегодня" valueColor={UI.green} />
          </div>
        </section>

        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Positioning</div>
            <span style={styles.outlineBadge}>Live</span>
          </div>

          <div style={styles.subBlock}>
            <div style={styles.subBlockTitleRow}>
              <div style={styles.subBlockTitle}>Spot vs Perp pressure</div>
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

            <div style={styles.bodyTextTight}>
              Движение выглядит более подтверждённым спотом, чем перегретыми фьючерсами.
            </div>
          </div>

          <div style={styles.subBlock}>
            <div style={styles.subBlockTitleRow}>
              <div style={styles.subBlockTitle}>BTC Long / Short Ratio</div>
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

        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>AI Insight</div>
            <span style={styles.outlineBadgeBlue}>AI</span>
          </div>

          <div style={styles.bodyText}>
            Рынок в фазе страха. Возможна локальная аккумуляция. Приоритет — BTC, ETH и сильные
            альты с подтверждённым спросом. По слабым альтам риск остаётся повышенным.
          </div>

          <button
            type="button"
            style={styles.blockButton}
            onClick={() => router.replace("/ai")}
          >
            Открыть AI
          </button>
        </section>

        <section style={styles.block}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionMainTitle}>Снимок бота</div>
            <StatusDot text="Активен" />
          </div>

          <div style={styles.compactGrid}>
            <MetricBox label="Статус" value="Активен" sub="Runtime ok" />
            <MetricBox label="Позиции" value="3" sub="Открыто" />
            <MetricBox label="PnL today" value="+12.3" sub="USDT" valueColor={UI.green} />
            <MetricBox label="В работе" value="45" sub="USDT" />
          </div>

          <button
            type="button"
            style={styles.blockButton}
            onClick={() => router.replace("/bot")}
          >
            Открыть бот
          </button>
        </section>

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

        <section style={styles.debugCard}>
          <div style={styles.debugHeader}>
            <div>
              <div style={styles.debugTitle}>Технический статус</div>
              <div style={styles.debugSub}>Сервисная информация</div>
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
      </div>
    </main>
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
      <div style={{ ...styles.miniCardValue, color: props.valueColor || UI.textMain }}>
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
}) {
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

function SignalCard(props: {
  title: string;
  value: string;
  sub: string;
  accent: string;
  right?: React.ReactNode;
}) {
  return (
    <section style={styles.signalCard}>
      <div style={styles.signalTitle}>{props.title}</div>
      <div style={styles.signalRow}>
        <div>
          <div style={{ ...styles.statBigValue, color: props.accent }}>{props.value}</div>
          <div style={styles.statSubtitle}>{props.sub}</div>
        </div>
        {props.right}
      </div>
    </section>
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

  heroDivider: {
    height: 1,
    background: UI.borderSoft,
    margin: "16px 0 16px",
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
    minWidth: 52,
    height: 32,
    borderRadius: 999,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: `1px solid ${UI.borderHard}`,
    color: UI.red,
    fontWeight: 700,
    fontSize: 13,
  } as React.CSSProperties,

  fearTrack: {
    width: "100%",
    height: 9,
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

  grid: {
    display: "grid",
    gap: 24,
  } as React.CSSProperties,

  block: {
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
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

  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  signalGrid: {
    display: "grid",
    gap: 14,
    marginBottom: 12,
  } as React.CSSProperties,

  stackGap: {
    height: 12,
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

  miniCard: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 108,
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
    lineHeight: 1.55,
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

  signalCard: {
    borderBottom: `1px solid ${UI.borderSoft}`,
    paddingBottom: 12,
  } as React.CSSProperties,

  signalTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: UI.textMain,
    marginBottom: 8,
  } as React.CSSProperties,

  signalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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

  miniProgress: {
    width: 96,
    height: 9,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  } as React.CSSProperties,

  miniProgressFill: {
    height: "100%",
    borderRadius: 999,
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

  debugCard: {
    marginTop: 20,
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
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
};

Как бы ты улучшил 
Что добавил что убрал ? 
