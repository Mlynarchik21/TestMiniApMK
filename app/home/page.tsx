"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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
  brand: "#2979ff",
  yellow: "#f3d709",
  btc: "#f7931a",
  eth: "#627eea",
  alt: "#64d97b",
};

function reveal(index: number, mounted: boolean): CSSProperties {
  return mounted
    ? {
        opacity: 1,
        animationName: "fadeUp",
        animationDuration: "560ms",
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        animationFillMode: "both",
        animationDelay: `${index * 70}ms`,
        willChange: "transform, opacity",
      }
    : {
        opacity: 0,
        transform: "translate3d(0, 18px, 0)",
      };
}

function fearFill(percent: number): CSSProperties {
  return {
    width: `${percent}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff5a5a",
    transformOrigin: "left center",
    animation: "fillX 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
  };
}

function ringStyle(percent: number, color: string): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${color} 0 ${percent}%, rgba(255,255,255,0.10) ${percent}% 100%)`,
    WebkitMask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
    animation: "ringAppear 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
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
    transition: "transform 160ms ease, border-color 180ms ease",
    WebkitTapHighlightColor: "transparent",
  };
}

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<AnyResp | null>(null);
  const [tokenPreview, setTokenPreview] = useState("нет токена");
  const [mounted, setMounted] = useState(false);

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

  const checkMe = () => run("/api/me", { method: "GET" });

  useEffect(() => {
    const t = getToken();
    setTokenPreview(
      t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена"
    );

    checkMe();

    try {
      const tg = (window as any)?.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#000000");
      tg?.setBackgroundColor?.("#000000");
    } catch {}

    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes pulseDot {
          0% {
            transform: scale(1);
            opacity: 0.9;
            box-shadow: 0 0 0 0 rgba(100, 217, 123, 0.35);
          }
          70% {
            transform: scale(1.08);
            opacity: 1;
            box-shadow: 0 0 0 8px rgba(100, 217, 123, 0);
          }
          100% {
            transform: scale(1);
            opacity: 0.9;
            box-shadow: 0 0 0 0 rgba(100, 217, 123, 0);
          }
        }

        @keyframes ringAppear {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fillX {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }
      `}</style>

      <main style={styles.page}>
        <div style={styles.container}>
          <section style={{ ...styles.heroCard, ...reveal(0, mounted) }}>
            <div style={styles.metricLabel}>Рын. капитализация</div>

            <div style={styles.metricValueRow}>
              <span style={styles.metricValue}>2.48</span>
              <span style={styles.metricTinyUnit}>T</span>
              <span style={styles.metricUnit}>USDT</span>
            </div>

            <div style={styles.deltaRow}>
              <span style={styles.deltaLabel}>Изменение за день</span>
              <span style={styles.deltaNegative}>-0.76%</span>
            </div>

            <div style={styles.sentimentHeader}>
              <div>
                <div style={styles.sentimentTitle}>Жадность и страх</div>
              </div>
              <div style={styles.sentimentBadgeDanger}>11%</div>
            </div>

            <div style={styles.fearTrack}>
              <div style={fearFill(11)} />
              <div style={styles.trackShimmer} />
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

          <section style={{ ...styles.blockNoBorder, ...reveal(1, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>BTC Dominance</div>
            </div>

            <div style={styles.signalRow}>
              <div style={styles.dominanceLegend}>
                <div style={styles.dominanceItem}>
                  <div style={styles.legendLeft}>
                    <span style={{ ...styles.legendDot, background: UI.btc }} />
                    <span style={styles.legendText}>BTC</span>
                  </div>
                  <span style={{ ...styles.legendValue, color: UI.btc }}>56.6%</span>
                </div>

                <div style={styles.dominanceItem}>
                  <div style={styles.legendLeft}>
                    <span style={{ ...styles.legendDot, background: UI.eth }} />
                    <span style={styles.legendText}>ETH</span>
                  </div>
                  <span style={{ ...styles.legendValue, color: UI.eth }}>17.8%</span>
                </div>

                <div style={styles.dominanceItem}>
                  <div style={styles.legendLeft}>
                    <span style={{ ...styles.legendDot, background: UI.alt }} />
                    <span style={styles.legendText}>Альткойны</span>
                  </div>
                  <span style={{ ...styles.legendValue, color: UI.alt }}>25.6%</span>
                </div>
              </div>

              <div style={styles.ringWrap}>
                <div style={styles.multiRing} />
                <div style={styles.ringCenterLabel}>
                  <div style={styles.ringCenterValue}>56.6%</div>
                  <div style={styles.ringCenterSub}>BTC</div>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Индекс альтсезона</div>
              <span style={styles.outlineBadge}>Overview</span>
            </div>

            <div style={styles.signalCard}>
              <div style={styles.signalRow}>
                <div>
                  <div style={styles.signalTitle}>Altseason Index</div>
                  <div style={{ ...styles.statBigValue, color: UI.blue }}>34</div>
                  <div style={styles.statSubtitle}>Пока рынок ближе к BTC phase</div>
                </div>

                <div style={styles.ringWrap}>
                  <div style={ringStyle(34, UI.blue)} />
                  <div style={styles.ringTextSmall}>34%</div>
                </div>
              </div>
            </div>

            <div style={styles.twoCol}>
              <MiniMetric
                label="BTC CAP"
                value="$1.41T"
                sub="Изменение за день +1.8%"
                valueColor={UI.btc}
              />
              <MiniMetric
                label="ALT CAP"
                value="$0.64T"
                sub="Изменение за день -2.4%"
                valueColor={UI.alt}
              />
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(3, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Positioning</div>
              <span style={styles.outlineBadge}>Live</span>
            </div>

            <div style={styles.subBlock}>
              <div style={styles.subBlockTitleRow}>
                <div style={styles.subBlockTitle}>Spot Activity / Perp Activity</div>
                <span style={styles.outlineBadge}>Live</span>
              </div>

              <div style={styles.splitBar}>
                <div style={styles.splitBarSpot} />
                <div style={styles.splitBarPerp} />
              </div>

              <div style={styles.splitMeta}>
                <span style={{ color: UI.green }}>68% Spot Activity</span>
                <span style={{ color: UI.red }}>32% Perp Activity</span>
              </div>

              <div style={styles.bodyTextTight}>
                Движение подтверждается в большей степени спотовым спросом, а не перегретым
                деривативным потоком.
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

          <section style={{ ...styles.aiBlock, ...reveal(4, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>AI Insight</div>
              <span style={styles.outlineBadgeBlue}>AI</span>
            </div>

            <div style={styles.bodyText}>
              Рынок в фазе страха. Возможна локальная аккумуляция. Приоритет — BTC, ETH и
              сильные альты с подтверждённым спросом. По слабым альтам риск остаётся
              повышенным.
            </div>

            <button
              type="button"
              style={styles.blockButton}
              onClick={() => router.replace("/ai")}
            >
              Открыть AI
            </button>
          </section>

          <section style={{ ...styles.botBlock, ...reveal(5, mounted) }}>
            <div style={styles.botTopRow}>
              <div>
                <div style={styles.botEyebrow}>TRADING SYSTEM</div>
                <div style={styles.botTitle}>Состояние бота</div>
              </div>
              <StatusDot text="Активен" />
            </div>

            <div style={styles.botLead}>
              Алгоритм работает стабильно, сделки и активные процессы под контролем,
              критических отклонений не обнаружено.
            </div>

            <div style={styles.botHighlightRow}>
              <div style={styles.botHighlightCard}>
                <div style={styles.botHighlightLabel}>Режим</div>
                <div style={styles.botHighlightValue}>Автоторговля</div>
                <div style={styles.botHighlightSub}>
                  Система исполняет сценарии в штатном режиме
                </div>
              </div>

              <div style={styles.botHighlightCard}>
                <div style={styles.botHighlightLabel}>Контроль риска</div>
                <div style={styles.botHighlightValue}>Нормальный</div>
                <div style={styles.botHighlightSub}>
                  Ограничения и фильтры активны
                </div>
              </div>
            </div>

            <div style={styles.compactGrid}>
              <MetricBox label="Статус" value="Активен" sub="Runtime ok" />
              <MetricBox label="Позиции" value="3" sub="Открыто" />
              <MetricBox
                label="PnL today"
                value="+12.3"
                sub="USDT"
                valueColor={UI.green}
              />
              <MetricBox label="В работе" value="45" sub="USDT" />
            </div>

            <button
              type="button"
              style={styles.blockButtonBlue}
              onClick={() => router.replace("/bot")}
            >
              Открыть бот
            </button>
          </section>

          <section style={{ ...styles.section, ...reveal(6, mounted) }}>
            <div style={styles.sectionTitle}>Переходы</div>

            <div style={styles.quickGrid}>
              <QuickNavCard
                title="Bot"
                subtitle="Сделки и контроль"
                onClick={() => router.replace("/bot")}
              />
              <QuickNavCard
                title="AI"
                subtitle="Аналитика рынка"
                onClick={() => router.replace("/ai")}
              />
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

          <section style={{ ...styles.debugCard, ...reveal(7, mounted) }}>
            <div style={styles.debugHeader}>
              <div>
                <div style={styles.debugTitle}>Технический статус</div>
                <div style={styles.debugSub}>Сервисная информация</div>
              </div>

              <button
                onClick={checkMe}
                disabled={loading}
                style={debugActionStyle(loading)}
              >
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

            <div style={styles.debugBox}>
              {result ? JSON.stringify(result, null, 2) : "—"}
            </div>
          </section>
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
  } satisfies CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
  } satisfies CSSProperties,

  heroCard: {
    background: "transparent",
    border: "none",
    padding: 0,
    marginBottom: 26,
  } satisfies CSSProperties,

  metricLabel: {
    fontSize: 13,
    color: UI.textMuted,
    marginBottom: 8,
    fontWeight: 500,
    transition: "color 180ms ease",
  } satisfies CSSProperties,

  metricValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 0,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  metricValue: {
    fontSize: 40,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.06em",
    color: "#ffffff",
    textShadow: "0 0 18px rgba(255,255,255,0.05)",
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

  deltaRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  deltaLabel: {
    fontSize: 14,
    color: UI.textMuted,
    fontWeight: 500,
  } satisfies CSSProperties,

  deltaNegative: {
    fontSize: 15,
    color: "#ff5f5f",
    fontWeight: 700,
  } satisfies CSSProperties,

  sentimentHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  } satisfies CSSProperties,

  sentimentTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.yellow,
    textShadow: "0 0 14px rgba(243, 215, 9, 0.08)",
  } satisfies CSSProperties,

  sentimentBadgeDanger: {
    minWidth: 52,
    height: 32,
    borderRadius: 999,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    color: UI.red,
    fontWeight: 800,
    fontSize: 14,
  } satisfies CSSProperties,

  fearTrack: {
    width: "100%",
    height: 9,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(110,25,25,0.50) 0%, rgba(104,71,16,0.42) 46%, rgba(18,62,37,0.42) 100%)",
    overflow: "hidden",
    position: "relative",
  } satisfies CSSProperties,

  trackShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "24%",
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
    animation: "shimmer 2.8s linear infinite",
    pointerEvents: "none",
  } satisfies CSSProperties,

  heroButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  } satisfies CSSProperties,

  primaryPill: {
    flex: "1 1 180px",
    height: 46,
    borderRadius: 999,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    transition: "transform 160ms ease, opacity 160ms ease, box-shadow 200ms ease",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
    WebkitTapHighlightColor: "transparent",
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

  outlineBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    fontSize: 11,
    color: UI.textSoft,
    fontWeight: 700,
    transition: "opacity 180ms ease, transform 180ms ease",
  } satisfies CSSProperties,

  outlineBadgeBlue: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(142,178,255,0.34)",
    fontSize: 11,
    color: UI.blue,
    fontWeight: 700,
    transition: "opacity 180ms ease, transform 180ms ease",
  } satisfies CSSProperties,

  compactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
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

  miniCard: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 108,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition:
      "transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
    WebkitTapHighlightColor: "transparent",
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
  } satisfies CSSProperties,

  smallSub: {
    marginTop: 8,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.4,
  } satisfies CSSProperties,

  metricItem: {
    background: "transparent",
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    minHeight: 108,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition:
      "transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  metricItemLabel: {
    fontSize: 11,
    color: UI.textMuted,
    marginBottom: 6,
  } satisfies CSSProperties,

  metricItemValue: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.1,
  } satisfies CSSProperties,

  metricItemSub: {
    marginTop: 6,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.35,
  } satisfies CSSProperties,

  bodyText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: UI.textSoft,
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
    width: "68%",
    background: UI.green,
    transformOrigin: "left center",
    animation: "fillX 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
  } satisfies CSSProperties,

  splitBarPerp: {
    width: "32%",
    background: UI.red,
    transformOrigin: "left center",
    animation: "fillX 980ms cubic-bezier(0.22, 1, 0.36, 1) both",
  } satisfies CSSProperties,

  splitBarLong: {
    width: "61.4%",
    background: UI.green,
    transformOrigin: "left center",
    animation: "fillX 980ms cubic-bezier(0.22, 1, 0.36, 1) both",
  } satisfies CSSProperties,

  splitBarShort: {
    width: "38.6%",
    background: UI.red,
    transformOrigin: "left center",
    animation: "fillX 1060ms cubic-bezier(0.22, 1, 0.36, 1) both",
  } satisfies CSSProperties,

  splitMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
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

  signalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  } satisfies CSSProperties,

  dominanceItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,

  legendLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
    boxShadow: "0 0 12px rgba(255,255,255,0.06)",
  } satisfies CSSProperties,

  legendText: {
    fontSize: 13,
    color: UI.textSoft,
    fontWeight: 600,
  } satisfies CSSProperties,

  legendValue: {
    fontSize: 15,
    fontWeight: 800,
  } satisfies CSSProperties,

  multiRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(
      ${UI.btc} 0 56.6%,
      ${UI.eth} 56.6% 74.4%,
      ${UI.alt} 74.4% 100%
    )`,
    WebkitMask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
    animation: "ringAppear 760ms cubic-bezier(0.22, 1, 0.36, 1) both",
  } satisfies CSSProperties,

  ringCenterLabel: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  } satisfies CSSProperties,

  ringCenterValue: {
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

  aiBlock: {
    marginTop: 4,
    marginBottom: 2,
    padding: 16,
    borderRadius: 20,
    border: `1px solid ${UI.border}`,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.025) 100%)",
  } satisfies CSSProperties,

  botBlock: {
    marginTop: 8,
    padding: 16,
    borderRadius: 22,
    border: "1px solid rgba(100,217,123,0.16)",
    background:
      "linear-gradient(180deg, rgba(100,217,123,0.06) 0%, rgba(41,121,255,0.035) 100%)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
  } satisfies CSSProperties,

  botTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
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
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: UI.textMain,
  } satisfies CSSProperties,

  botLead: {
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textSoft,
    marginBottom: 14,
    maxWidth: "92%",
  } satisfies CSSProperties,

  botHighlightRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 12,
  } satisfies CSSProperties,

  botHighlightCard: {
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.025)",
    borderRadius: 16,
    padding: 12,
    minHeight: 104,
    transition:
      "transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
  } satisfies CSSProperties,

  botHighlightLabel: {
    fontSize: 10,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 8,
  } satisfies CSSProperties,

  botHighlightValue: {
    fontSize: 17,
    lineHeight: 1.1,
    fontWeight: 800,
    color: UI.textMain,
    marginBottom: 8,
  } satisfies CSSProperties,

  botHighlightSub: {
    fontSize: 11,
    lineHeight: 1.45,
    color: UI.textMuted,
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
    marginTop: 14,
    transition: "transform 160ms ease, border-color 180ms ease, background 180ms ease",
    WebkitTapHighlightColor: "transparent",
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
    transition: "transform 160ms ease, opacity 160ms ease, box-shadow 200ms ease",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
    WebkitTapHighlightColor: "transparent",
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
    backdropFilter: "blur(4px)",
  } satisfies CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: UI.green,
    animation: "pulseDot 1.9s ease-in-out infinite",
  } satisfies CSSProperties,

  section: {
    marginTop: 20,
  } satisfies CSSProperties,

  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: UI.textMuted,
    margin: "0 2px 10px",
  } satisfies CSSProperties,

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  quickCard: {
    textAlign: "left",
    minHeight: 88,
    borderRadius: 16,
    padding: 12,
    border: `1px solid ${UI.border}`,
    background: "transparent",
    color: UI.textMain,
    cursor: "pointer",
    transition:
      "transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  quickCardTitle: {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 4,
  } satisfies CSSProperties,

  quickCardSub: {
    fontSize: 11,
    lineHeight: 1.4,
    color: UI.textMuted,
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