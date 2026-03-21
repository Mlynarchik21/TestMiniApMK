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
          <div style={styles.heroTop}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.metricLabel}>Рын. капитализация</div>

              <div style={styles.metricValueRow}>
                <span style={styles.metricValue}>2.48</span>
                <span style={styles.metricUnit}>T USDT</span>
              </div>

              <div style={styles.deltaRow}>
                <span style={styles.deltaLabel}>Изменение за день</span>
                <span style={styles.deltaNegative}>-0.76%</span>
              </div>
            </div>
          </div>

          <div style={styles.heroDivider} />

          <div style={styles.sentimentWrap}>
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

        <section style={styles.grid}>
          <StatCard
            label="Fear & Greed"
            value="23"
            subtitle="Extreme Fear"
            accent="#ff6262"
            rightSlot={
              <div style={styles.miniProgress}>
                <div style={{ ...styles.miniProgressFill, width: "23%", background: "#ff6262" }} />
              </div>
            }
          />

          <StatCard
            label="BTC Dominance"
            value="56.5%"
            subtitle="Лидерство BTC на рынке"
            accent="#f0a33e"
            rightSlot={
              <div style={styles.ringWrap}>
                <div style={styles.ring(56.5, "#f0a33e")} />
                <div style={styles.ringTextSmall}>56.5%</div>
              </div>
            }
          />

          <WideCard title="BTC Long / Short Ratio" extra={<span style={styles.tag}>Live</span>}>
            <div style={styles.splitBar}>
              <div style={styles.splitBarLong} />
              <div style={styles.splitBarShort} />
            </div>

            <div style={styles.splitMeta}>
              <span style={{ color: "#64d97b" }}>61.4% Longs</span>
              <span style={{ color: "#ff6a6a" }}>38.6% Shorts</span>
            </div>
          </WideCard>

          <div style={styles.twoCol}>
            <MiniInfoCard label="TOTAL OI" value="$25.58B" />
            <MiniInfoCard label="COINBASE" value="#359" valueColor="#ff6a6a" />
          </div>

          <WideCard title="AI Insight" extra={<span style={styles.aiBadge}>AI</span>}>
            <div style={styles.bodyText}>
              Рынок в фазе страха. Возможна локальная аккумуляция. Риск по слабым альтам
              остаётся повышенным.
            </div>

            <button
              type="button"
              style={styles.blockButton}
              onClick={() => router.replace("/ai")}
            >
              Открыть AI
            </button>
          </WideCard>

          <WideCard title="Снимок бота" extra={<StatusDot text="Активен" />}>
            <div style={styles.botGrid}>
              <MetricItem label="Статус" value="Активен" />
              <MetricItem label="Позиции" value="3" />
              <MetricItem label="PnL сегодня" value="+12.3" valueColor="#64d97b" />
              <MetricItem label="В работе" value="45 USDT" />
            </div>

            <button
              type="button"
              style={styles.blockButton}
              onClick={() => router.replace("/bot")}
            >
              Открыть бот
            </button>
          </WideCard>
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

function StatCard(props: {
  label: string;
  value: string;
  subtitle: string;
  accent?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section style={styles.statCard}>
      <div style={styles.cardLabel}>{props.label}</div>

      <div style={styles.statCardRow}>
        <div>
          <div style={{ ...styles.statBigValue, color: props.accent || "#fff" }}>{props.value}</div>
          <div style={styles.statSubtitle}>{props.subtitle}</div>
        </div>

        {props.rightSlot}
      </div>
    </section>
  );
}

function WideCard(props: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={styles.wideCard}>
      <div style={styles.wideCardHeader}>
        <div style={styles.wideCardTitle}>{props.title}</div>
        {props.extra}
      </div>
      <div style={{ marginTop: 12 }}>{props.children}</div>
    </section>
  );
}

function MiniInfoCard(props: { label: string; value: string; valueColor?: string }) {
  return (
    <section style={styles.miniCard}>
      <div style={styles.cardLabel}>{props.label}</div>
      <div style={{ ...styles.miniCardValue, color: props.valueColor || "#f3f3f3" }}>
        {props.value}
      </div>
    </section>
  );
}

function MetricItem(props: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={styles.metricItem}>
      <div style={styles.metricItemLabel}>{props.label}</div>
      <div style={{ ...styles.metricItemValue, color: props.valueColor || "#f3f3f3" }}>
        {props.value}
      </div>
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
    color: "#f3f3f3",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 72px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
  } as React.CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  heroCard: {
    position: "relative",
    overflow: "hidden",
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    boxShadow: "none",
    marginBottom: 20,
  } as React.CSSProperties,

  heroTop: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  } as React.CSSProperties,

  metricLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.56)",
    marginBottom: 6,
    fontWeight: 500,
  } as React.CSSProperties,

  metricValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  } as React.CSSProperties,

  metricValue: {
    fontSize: 38,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.06em",
  } as React.CSSProperties,

  metricUnit: {
    fontSize: 16,
    color: "rgba(255,255,255,0.82)",
    fontWeight: 600,
    letterSpacing: "-0.02em",
  } as React.CSSProperties,

  deltaRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  } as React.CSSProperties,

  deltaLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.60)",
    fontWeight: 500,
  } as React.CSSProperties,

  deltaNegative: {
    fontSize: 15,
    color: "#ff5f5f",
    fontWeight: 700,
  } as React.CSSProperties,

  heroDivider: {
    height: 1,
    background: "rgba(255,255,255,0.06)",
    margin: "14px 0 14px",
  } as React.CSSProperties,

  sentimentWrap: {
    position: "relative",
    zIndex: 1,
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
    color: "#f3f3f3",
  } as React.CSSProperties,

  sentimentSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.46)",
    marginTop: 2,
  } as React.CSSProperties,

  sentimentBadgeDanger: {
    minWidth: 48,
    height: 30,
    borderRadius: 999,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid rgba(255,95,95,0.22)",
    color: "#ff6a6a",
    fontWeight: 700,
    fontSize: 13,
  } as React.CSSProperties,

  fearTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(99,27,27,0.45) 0%, rgba(91,71,20,0.38) 46%, rgba(13,58,35,0.38) 100%)",
    overflow: "hidden",
  } as React.CSSProperties,

  fearFill: (percent: number): React.CSSProperties => ({
    width: `${percent}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff5a5a",
    boxShadow: "none",
  }),

  heroButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  } as React.CSSProperties,

  primaryPill: {
    flex: "1 1 180px",
    height: 42,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "none",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gap: 16,
  } as React.CSSProperties,

  statCard: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: "0 0 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  } as React.CSSProperties,

  cardLabel: {
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.28)",
    fontWeight: 700,
    marginBottom: 10,
  } as React.CSSProperties,

  statCardRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } as React.CSSProperties,

  statBigValue: {
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.04em",
  } as React.CSSProperties,

  statSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.56)",
    fontWeight: 500,
  } as React.CSSProperties,

  miniProgress: {
    width: 88,
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  } as React.CSSProperties,

  miniProgressFill: {
    height: "100%",
    borderRadius: 999,
  } as React.CSSProperties,

  ringWrap: {
    width: 62,
    height: 62,
    position: "relative",
    flexShrink: 0,
  } as React.CSSProperties,

  ring: (percent: number, color: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${color} 0 ${percent}%, rgba(255,255,255,0.08) ${percent}% 100%)`,
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
    color: "#f2f2f2",
  } as React.CSSProperties,

  wideCard: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: "0 0 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  } as React.CSSProperties,

  wideCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  wideCardTitle: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,

  tag: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.68)",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
  } as React.CSSProperties,

  aiBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 10,
    background: "transparent",
    border: "1px solid rgba(55,124,255,0.20)",
    color: "#8eb2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 800,
  } as React.CSSProperties,

  splitBar: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    display: "flex",
  } as React.CSSProperties,

  splitBarLong: {
    width: "61.4%",
    background: "#64d97b",
  } as React.CSSProperties,

  splitBarShort: {
    width: "38.6%",
    background: "#ff6a6a",
  } as React.CSSProperties,

  splitMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,

  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  miniCard: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: "0 0 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  } as React.CSSProperties,

  miniCardValue: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  } as React.CSSProperties,

  bodyText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.64)",
  } as React.CSSProperties,

  blockButton: {
    width: "100%",
    height: 40,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 12,
  } as React.CSSProperties,

  botGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  metricItem: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
  } as React.CSSProperties,

  metricItemLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.42)",
    marginBottom: 6,
  } as React.CSSProperties,

  metricItemValue: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.1,
  } as React.CSSProperties,

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: "transparent",
    border: "1px solid rgba(100,217,123,0.18)",
    color: "#77de8c",
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#64d97b",
  } as React.CSSProperties,

  section: {
    marginTop: 18,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.54)",
    margin: "0 2px 10px",
  } as React.CSSProperties,

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  quickCard: {
    textAlign: "left",
    minHeight: 82,
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "transparent",
    color: "#fff",
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
    color: "rgba(255,255,255,0.48)",
  } as React.CSSProperties,

  debugCard: {
    marginTop: 18,
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
  } as React.CSSProperties,

  debugSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.42)",
    marginTop: 4,
  } as React.CSSProperties,

  debugAction: (disabled: boolean): React.CSSProperties => ({
    height: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "transparent",
    color: "#fff",
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
    color: "rgba(255,255,255,0.34)",
    marginBottom: 5,
  } as React.CSSProperties,

  debugMetaValue: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontWeight: 600,
    wordBreak: "break-word",
  } as React.CSSProperties,

  debugBox: {
    whiteSpace: "pre-wrap",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
    minHeight: 100,
    fontSize: 11,
    lineHeight: 1.4,
    overflowX: "auto",
    color: "rgba(255,255,255,0.68)",
  } as React.CSSProperties,
};