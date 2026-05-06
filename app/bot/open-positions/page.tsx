"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

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
  cyan: "#6fdcff",
  orange: "#ffb258",
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
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUsd(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function compactNumber(value: unknown, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function assetCodeFromSymbol(symbol: unknown) {
  const s = String(symbol || "");
  if (!s) return "";
  return s.replace(/USDT$/i, "");
}

function ratioWidth(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return "50%";
  const pct = Math.max(0, Math.min(100, (part / total) * 100));
  return `${pct}%`;
}

function formatPct(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
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

export default function BotOpenPositionsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  const [err, setErr] = useState("");
  const [resp, setResp] = useState<AnyResp | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadPositions() {
    setLoading(true);
    setErr("");

    try {
      const r = await api("/api/bot/stats?recentTake=200", { method: "GET" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      const openPositions = (((r.json as any).openPositions ?? []) as any[]) || [];
      setPositions(openPositions);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    router.replace("/bot");
  }

  useEffect(() => {
    loadPositions();

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

  const filteredPositions = useMemo(() => {
    return positions
      .slice()
      .sort((a, b) => {
        const ad = safeDate(a?.updatedAt ?? a?.openedAt)?.getTime() ?? 0;
        const bd = safeDate(b?.updatedAt ?? b?.openedAt)?.getTime() ?? 0;
        return bd - ad;
      });
  }, [positions]);

  const totalPositions = filteredPositions.length;
  const capitalInWork = filteredPositions.reduce(
    (sum, p) => sum + Number(p?.investedQuote ?? 0),
    0
  );
  const avgCapital = totalPositions > 0 ? capitalInWork / totalPositions : 0;

  const noAddsCount = filteredPositions.filter(
    (p) => Number(p?.addsCount ?? 0) === 0
  ).length;
  const withAddsCount = filteredPositions.filter(
    (p) => Number(p?.addsCount ?? 0) > 0
  ).length;

  const unchangedCount = filteredPositions.filter((p) => {
    const opened = safeDate(p?.openedAt)?.getTime() ?? 0;
    const updated = safeDate(p?.updatedAt)?.getTime() ?? 0;
    return Math.abs(updated - opened) < 1000;
  }).length;

  const updatedCount = filteredPositions.filter((p) => {
    const opened = safeDate(p?.openedAt)?.getTime() ?? 0;
    const updated = safeDate(p?.updatedAt)?.getTime() ?? 0;
    return Math.abs(updated - opened) >= 1000;
  }).length;

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

            <div style={styles.pageTitle}>Открытые ордера</div>

            <div style={styles.topBarRightSpace} />
          </section>

          <section style={{ ...styles.statsBlock, ...reveal(1, mounted) }}>
            <div style={styles.statsUnifiedCard}>
              <div style={styles.statsUnifiedTopRow}>
                <div>
                  <div style={styles.statsBlockTitle}>Позиции в работе</div>
                  <div style={styles.statsBlockSub}>
                    Все текущие открытые позиции
                  </div>
                </div>

                <div style={styles.statsTopMetricsColumn}>
                  <div
                    style={{
                      ...styles.metricLine,
                      borderColor: "rgba(100,217,123,0.20)",
                      background: "rgba(100,217,123,0.07)",
                    }}
                  >
                    <span style={styles.metricLineLabel}>В работе</span>
                    <span style={{ ...styles.metricLineValue, color: UI.green }}>
                      {totalPositions}
                    </span>
                  </div>

                  <div
                    style={{
                      ...styles.metricLine,
                      borderColor: "rgba(41,121,255,0.20)",
                      background: "rgba(41,121,255,0.07)",
                    }}
                  >
                    <span style={styles.metricLineLabel}>В работе, USDT</span>
                    <span style={{ ...styles.metricLineValue, color: UI.blue }}>
                      {formatUsd(capitalInWork)}
                    </span>
                  </div>

                  <div
                    style={{
                      ...styles.metricLine,
                      borderColor: "rgba(243,215,9,0.20)",
                      background: "rgba(243,215,9,0.07)",
                    }}
                  >
                    <span style={styles.metricLineLabel}>Средняя загрузка</span>
                    <span style={{ ...styles.metricLineValue, color: UI.yellow }}>
                      {formatUsd(avgCapital)}
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.statLineBlock}>
                <div style={styles.statLineHeader}>
                  <div style={styles.statLineTitle}>Без усреднения / С усреднением</div>
                </div>

                <div style={styles.splitBar}>
                  <div
                    style={{
                      ...styles.splitBarBlue,
                      width: ratioWidth(noAddsCount, totalPositions || 1),
                    }}
                  />
                  <div
                    style={{
                      ...styles.splitBarPurple,
                      width: ratioWidth(withAddsCount, totalPositions || 1),
                    }}
                  />
                </div>

                <div style={styles.splitMeta}>
                  <span style={{ color: UI.blue }}>
                    {formatPct(totalPositions ? (noAddsCount / totalPositions) * 100 : 0)} ·{" "}
                    {noAddsCount} без усреднения
                  </span>
                  <span style={{ color: UI.purple }}>
                    {formatPct(totalPositions ? (withAddsCount / totalPositions) * 100 : 0)} ·{" "}
                    {withAddsCount} с усреднением
                  </span>
                </div>
              </div>

              <div style={styles.statLineBlock}>
                <div style={styles.statLineHeader}>
                  <div style={styles.statLineTitle}>Новые / Измененные</div>
                </div>

                <div style={styles.splitBar}>
                  <div
                    style={{
                      ...styles.splitBarGreen,
                      width: ratioWidth(unchangedCount, totalPositions || 1),
                    }}
                  />
                  <div
                    style={{
                      ...styles.splitBarOrange,
                      width: ratioWidth(updatedCount, totalPositions || 1),
                    }}
                  />
                </div>

                <div style={styles.splitMeta}>
                  <span style={{ color: UI.green }}>
                    {formatPct(totalPositions ? (unchangedCount / totalPositions) * 100 : 0)} ·{" "}
                    {unchangedCount} новые
                  </span>
                  <span style={{ color: UI.orange }}>
                    {formatPct(totalPositions ? (updatedCount / totalPositions) * 100 : 0)} ·{" "}
                    {updatedCount} измененные
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(2, mounted) }}>
            {!filteredPositions.length && !loading ? (
              <div style={styles.emptyText}>Открытых ордеров нет.</div>
            ) : (
              <div style={styles.listGrid}>
                {filteredPositions.map((p) => {
                  const open = expandedId === p.id;
                  const assetName = assetCodeFromSymbol(p.symbol) || p.symbol || "—";
                  const invested = Number(p?.investedQuote ?? 0);
                  const addsCount = Number(p?.addsCount ?? 0);

                  return (
                    <div key={p.id} style={styles.tradeCard}>
                      <button
                        type="button"
                        style={styles.tradeCardHead}
                        onClick={() => setExpandedId(open ? null : p.id)}
                      >
                        <div style={styles.tradeHeadLeft}>
                          <div style={styles.tradeAsset}>{assetName}</div>
                          <div style={styles.tradeOrder}>
                            #{String(p.id).slice(-10)}
                          </div>
                        </div>

                        <div style={styles.tradeHeadRight}>
                          <div style={{ ...styles.tradePnl, color: UI.blue }}>
                            {formatUsd(invested)}
                          </div>
                          <div
                            style={{
                              ...styles.tradePnlPct,
                              color: addsCount > 0 ? UI.purple : UI.green,
                            }}
                          >
                            {addsCount > 0 ? `${addsCount} уср.` : "без уср."}
                          </div>
                        </div>
                      </button>

                      <div style={styles.tradeCompactInfo}>
                        <span>{formatDate(p?.openedAt)}</span>
                        <span style={styles.dot}>•</span>
                        <span>{formatDate(p?.updatedAt ?? p?.openedAt)}</span>
                        <span style={styles.dot}>•</span>
                        <span style={{ color: UI.textSoft, fontWeight: 700 }}>
                          {String(p?.status ?? "OPEN")}
                        </span>
                      </div>

                      {open ? (
                        <div style={styles.tradeExpanded}>
                          <div style={styles.detailsGrid}>
                            <DetailChip
                              label="Цена входа"
                              value={compactNumber(p?.avgPrice, 3)}
                              color={UI.blue}
                            />
                            <DetailChip
                              label="TP"
                              value={compactNumber(p?.tpPrice, 3)}
                              color={UI.green}
                            />
                            <DetailChip
                              label="Объем"
                              value={`${compactNumber(p?.qty, 3)} ${assetName}`}
                              color={UI.yellow}
                            />
                            <DetailChip
                              label="USDT"
                              value={formatUsd(p?.investedQuote ?? 0)}
                              color={UI.cyan}
                            />
                            <DetailChip
                              label="Открыта"
                              value={formatDate(p?.openedAt)}
                              color={UI.textSoft}
                            />
                            <DetailChip
                              label="Изменена"
                              value={formatDate(p?.updatedAt ?? p?.openedAt)}
                              color={UI.orange}
                            />
                            <DetailChip
                              label="Усреднений"
                              value={String(addsCount)}
                              color={UI.purple}
                            />
                            <DetailChip
                              label="Биржа"
                              value={String(p?.exchange ?? "—")}
                              color={UI.textSoft}
                            />
                          </div>

                          <div style={styles.reasonRow}>
                            <span style={styles.reasonLabel}>Статус</span>
                            <span style={{ ...styles.reasonValue, color: UI.green }}>
                              {String(p?.status ?? "OPEN")}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {err ? (
            <section style={{ ...styles.errorCard, ...reveal(3, mounted) }}>
              <div style={styles.errorTitle}>Ошибка</div>
              <div style={styles.errorText}>{err}</div>
            </section>
          ) : null}

          {loading ? (
            <section style={{ ...styles.loadingCard, ...reveal(4, mounted) }}>
              Загрузка открытых ордеров...
            </section>
          ) : null}
        </div>
      </main>
    </>
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
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
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
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    color: UI.textMain,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "center",
  } satisfies CSSProperties,

  topBarRightSpace: {
    width: 44,
    height: 44,
  } satisfies CSSProperties,

  statsBlock: {
    marginBottom: 20,
  } satisfies CSSProperties,

  statsUnifiedCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 22,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
    display: "grid",
    gap: 16,
  } satisfies CSSProperties,

  statsUnifiedTopRow: {
    display: "grid",
    gap: 14,
  } satisfies CSSProperties,

  statsBlockTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: UI.textMain,
  } satisfies CSSProperties,

  statsBlockSub: {
    marginTop: 6,
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.4,
  } satisfies CSSProperties,

  statsTopMetricsColumn: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  metricLine: {
    border: "1px solid",
    borderRadius: 16,
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,

  metricLineLabel: {
    fontSize: 12,
    color: UI.textSoft,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  } satisfies CSSProperties,

  metricLineValue: {
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1,
    textAlign: "right",
  } satisfies CSSProperties,

  statLineBlock: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  statLineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,

  statLineTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.textMain,
  } satisfies CSSProperties,

  splitBar: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    display: "flex",
  } satisfies CSSProperties,

  splitBarGreen: {
    background: UI.green,
  } satisfies CSSProperties,

  splitBarBlue: {
    background: UI.blue,
  } satisfies CSSProperties,

  splitBarPurple: {
    background: UI.purple,
  } satisfies CSSProperties,

  splitBarOrange: {
    background: UI.orange,
  } satisfies CSSProperties,

  splitMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
    fontSize: 13,
    fontWeight: 700,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  block: {
    paddingBottom: 20,
    marginBottom: 20,
  } satisfies CSSProperties,

  listGrid: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  tradeCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
    overflow: "hidden",
  } satisfies CSSProperties,

  tradeCardHead: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: UI.textMain,
    padding: 14,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  } satisfies CSSProperties,

  tradeHeadLeft: {
    minWidth: 0,
  } satisfies CSSProperties,

  tradeAsset: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: UI.textMain,
    lineHeight: 1,
  } satisfies CSSProperties,

  tradeOrder: {
    marginTop: 6,
    fontSize: 11,
    color: UI.textFaint,
    fontWeight: 700,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  tradeHeadRight: {
    textAlign: "right",
    flexShrink: 0,
  } satisfies CSSProperties,

  tradePnl: {
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.1,
  } satisfies CSSProperties,

  tradePnlPct: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 700,
  } satisfies CSSProperties,

  tradeCompactInfo: {
    padding: "0 14px 14px",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  dot: {
    color: UI.textFaint,
  } satisfies CSSProperties,

  tradeExpanded: {
    padding: "12px 14px 14px",
    borderTop: `1px solid ${UI.borderSoft}`,
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  } satisfies CSSProperties,

  detailChip: {
    border: "1px solid",
    borderRadius: 12,
    padding: "9px 10px",
    minWidth: 0,
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
    lineHeight: 1.35,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  reasonRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${UI.borderSoft}`,
    background: "rgba(255,255,255,0.02)",
  } satisfies CSSProperties,

  reasonLabel: {
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  reasonValue: {
    fontSize: 12,
    fontWeight: 800,
    textAlign: "right",
  } satisfies CSSProperties,

  emptyText: {
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.55,
    padding: "4px 2px 0",
  } satisfies CSSProperties,

  errorCard: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "rgba(255,106,106,0.06)",
  } satisfies CSSProperties,

  errorTitle: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: UI.textMain,
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