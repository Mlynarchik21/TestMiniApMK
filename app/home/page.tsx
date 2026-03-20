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
    } catch {}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <TopBar
          onClose={() => router.replace("/profile")}
          onChevron={() => router.replace("/bot")}
          onMore={() => router.replace("/settings")}
        />

        <div style={s.headerTitle}>Trader&apos;s Map</div>

        <section style={s.marketSection}>
          <div style={s.marketLabel}>Рын. капитализация</div>

          <div style={s.marketRow}>
            <div style={s.marketValueWrap}>
              <span style={s.marketValue}>2.49</span>
              <span style={s.marketUnit}>T USDT</span>
            </div>

            <div style={s.topIcons}>
              <CircleIconButton label="🎁" onClick={() => router.replace("/profile")} />
              <CircleIconButton label="🤖" onClick={() => router.replace("/bot")} />
              <CircleIconButton label="☾" onClick={() => router.replace("/settings")} />
            </div>
          </div>

          <div style={s.dayChangeRow}>
            <span style={s.dayChangeText}>Изменение за день</span>
            <span style={s.dayChangeNegative}>-0.09%</span>
          </div>

          <div style={s.fearRow}>
            <span style={s.fearLabel}>Жадность и страх</span>
            <span style={s.fearValue}>11%</span>
          </div>

          <div style={s.fearTrack}>
            <div style={s.fearFill(11)} />
          </div>

          <div style={s.profileRow}>
            <div />
            <button type="button" style={s.profileButton} onClick={() => router.replace("/profile")}>
              Мой профиль
            </button>
          </div>
        </section>

        <section style={s.searchFilterRow}>
          <button type="button" style={{ ...s.searchBox, flex: 1 }}>
            <span style={s.searchIcon}>⌕</span>
            <span style={s.searchPlaceholder}>Поиск по активам и курсам</span>
          </button>

          <button type="button" style={s.filterButton}>
            <span>Фильтры</span>
            <span style={s.newBadge}>NEW</span>
          </button>
        </section>

        <section style={s.quickSection}>
          <div style={s.quickGrid}>
            <QuickIconCard title="RSI Crypto" icon="↗" onClick={() => router.replace("/rsi")} />
            <QuickIconCard
              title="Карта ликвидаций"
              icon="◉"
              onClick={() => router.replace("/liquidation-map")}
            />
            <QuickIconCard
              title="Crypto Bubbles"
              icon="8"
              onClick={() => router.replace("/bubbles")}
            />
            <QuickIconCard
              title="Crypto ETF"
              icon="◔"
              onClick={() => router.replace("/etf")}
            />
            <QuickIconCard title="AI" icon="⚙" onClick={() => router.replace("/ai")} />
            <QuickIconCard title="Bot" icon="▣" onClick={() => router.replace("/bot")} />
            <QuickIconCard
              title="Центр знаний"
              icon="⇱"
              onClick={() => router.replace("/knowledge")}
            />
            <QuickIconCard title="Ещё" icon="•••" onClick={() => router.replace("/more")} />
          </div>
        </section>

        <section style={s.coursesSection}>
          <div style={s.sectionTopRow}>
            <div style={s.sectionTitle}>Курсы</div>
            <button type="button" style={s.outlinePill} onClick={() => router.replace("/courses")}>
              Смотреть все
            </button>
          </div>

          <div style={s.courseCard}>
            <div style={s.courseArt}>
              <div style={s.courseGlowA} />
              <div style={s.courseGlowB} />
              <div style={s.rocket}>🚀</div>
              <div style={s.coinA}>◌</div>
              <div style={s.coinB}>◌</div>
              <div style={s.lineA} />
              <div style={s.lineB} />
            </div>

            <div style={s.courseBottom}>
              <div>
                <div style={s.courseTitle}>Basic course</div>
                <div style={s.courseSub}>То, с чего стоит начать</div>
              </div>

              <button
                type="button"
                style={s.openButton}
                onClick={() => router.replace("/courses/basic")}
              >
                Открыть
              </button>
            </div>
          </div>
        </section>

        <section style={s.debugSection}>
          <div style={s.debugHeader}>
            <div>
              <div style={s.debugTitle}>Технический статус</div>
              <div style={s.debugSub}>Служебный блок</div>
            </div>

            <button type="button" onClick={checkMe} disabled={loading} style={s.debugBtn(loading)}>
              {loading ? "..." : "Проверить"}
            </button>
          </div>

          <div style={s.debugInfo}>
            <div>
              <div style={s.debugLabel}>sessionToken</div>
              <div style={s.debugValue}>{tokenPreview}</div>
            </div>
            <div>
              <div style={s.debugLabel}>HTTP статус</div>
              <div style={s.debugValue}>{status ?? "—"}</div>
            </div>
          </div>

          <div style={s.debugBox}>{result ? JSON.stringify(result, null, 2) : "—"}</div>
        </section>
      </div>
    </main>
  );
}

function TopBar(props: {
  onClose: () => void;
  onChevron: () => void;
  onMore: () => void;
}) {
  return (
    <div style={s.topBar}>
      <button type="button" style={s.closeBtn} onClick={props.onClose}>
        <span style={s.closeX}>×</span>
        <span>Закрыть</span>
      </button>

      <div style={s.topBarRight}>
        <button type="button" style={s.smallTopBtn} onClick={props.onChevron}>
          ˅
        </button>
        <button type="button" style={s.smallTopBtn} onClick={props.onMore}>
          •••
        </button>
      </div>
    </div>
  );
}

function CircleIconButton(props: { label: string; onClick: () => void }) {
  return (
    <button type="button" style={s.circleIconBtn} onClick={props.onClick}>
      <span>{props.label}</span>
    </button>
  );
}

function QuickIconCard(props: { title: string; icon: string; onClick: () => void }) {
  return (
    <button type="button" style={s.quickItem} onClick={props.onClick}>
      <div style={s.quickCircle}>{props.icon}</div>
      <div style={s.quickTitle}>{props.title}</div>
    </button>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
  } as React.CSSProperties,

  container: {
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  } as React.CSSProperties,

  closeBtn: {
    height: 56,
    padding: "0 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#151515",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  closeX: {
    fontSize: 28,
    lineHeight: 1,
    marginTop: -2,
  } as React.CSSProperties,

  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  smallTopBtn: {
    width: 56,
    height: 56,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#151515",
    color: "#fff",
    fontSize: 22,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  headerTitle: {
    textAlign: "center",
    fontSize: 28,
    lineHeight: 1.1,
    fontWeight: 800,
    marginBottom: 26,
    letterSpacing: "-0.03em",
  } as React.CSSProperties,

  marketSection: {
    marginBottom: 26,
  } as React.CSSProperties,

  marketLabel: {
    fontSize: 19,
    color: "rgba(255,255,255,0.74)",
    marginBottom: 12,
    fontWeight: 500,
  } as React.CSSProperties,

  marketRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  } as React.CSSProperties,

  marketValueWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
    minWidth: 0,
  } as React.CSSProperties,

  marketValue: {
    fontSize: 84,
    lineHeight: 0.92,
    fontWeight: 800,
    letterSpacing: "-0.07em",
  } as React.CSSProperties,

  marketUnit: {
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 500,
    color: "rgba(255,255,255,0.92)",
    letterSpacing: "-0.03em",
  } as React.CSSProperties,

  topIcons: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    paddingTop: 8,
    flexShrink: 0,
  } as React.CSSProperties,

  circleIconBtn: {
    width: 74,
    height: 74,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#000",
    color: "#fff",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    cursor: "pointer",
  } as React.CSSProperties,

  dayChangeRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginTop: 20,
    marginBottom: 18,
    flexWrap: "wrap",
  } as React.CSSProperties,

  dayChangeText: {
    fontSize: 22,
    color: "rgba(255,255,255,0.84)",
    fontWeight: 500,
  } as React.CSSProperties,

  dayChangeNegative: {
    fontSize: 22,
    color: "#ff5757",
    fontWeight: 800,
  } as React.CSSProperties,

  fearRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  } as React.CSSProperties,

  fearLabel: {
    fontSize: 20,
    color: "#f5cc00",
    fontWeight: 500,
  } as React.CSSProperties,

  fearValue: {
    fontSize: 18,
    color: "rgba(255,255,255,0.68)",
    fontWeight: 500,
  } as React.CSSProperties,

  fearTrack: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    overflow: "hidden",
    background:
      "linear-gradient(90deg, rgba(110,20,20,0.55) 0%, rgba(88,57,9,0.48) 38%, rgba(17,58,34,0.5) 100%)",
  } as React.CSSProperties,

  fearFill: (percent: number): React.CSSProperties => ({
    width: `${percent}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff4f4f",
  }),

  profileRow: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
  } as React.CSSProperties,

  profileButton: {
    height: 74,
    padding: "0 34px",
    borderRadius: 999,
    border: "none",
    background: "#377cff",
    color: "#fff",
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  searchFilterRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginBottom: 26,
  } as React.CSSProperties,

  searchBox: {
    height: 72,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "#050505",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "0 24px",
    color: "#fff",
    cursor: "pointer",
  } as React.CSSProperties,

  searchIcon: {
    fontSize: 28,
    lineHeight: 1,
    opacity: 0.92,
  } as React.CSSProperties,

  searchPlaceholder: {
    fontSize: 18,
    color: "rgba(255,255,255,0.52)",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  filterButton: {
    height: 60,
    padding: "0 18px",
    borderRadius: 999,
    border: "none",
    background: "#111",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  newBadge: {
    minWidth: 56,
    height: 36,
    borderRadius: 999,
    background: "#f4d000",
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    padding: "0 12px",
  } as React.CSSProperties,

  quickSection: {
    marginBottom: 34,
  } as React.CSSProperties,

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 22,
  } as React.CSSProperties,

  quickItem: {
    background: "transparent",
    border: "none",
    color: "#fff",
    padding: 0,
    cursor: "pointer",
    textAlign: "center",
  } as React.CSSProperties,

  quickCircle: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    fontWeight: 700,
    marginBottom: 12,
  } as React.CSSProperties,

  quickTitle: {
    fontSize: 16,
    lineHeight: 1.2,
    color: "rgba(255,255,255,0.9)",
    fontWeight: 500,
  } as React.CSSProperties,

  coursesSection: {
    marginBottom: 30,
  } as React.CSSProperties,

  sectionTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  } as React.CSSProperties,

  outlinePill: {
    height: 54,
    padding: "0 24px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#000",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  courseCard: {
    overflow: "hidden",
    borderRadius: 30,
    background: "#050505",
    border: "1px solid rgba(255,255,255,0.06)",
  } as React.CSSProperties,

  courseArt: {
    position: "relative",
    height: 290,
    background:
      "radial-gradient(circle at 60% 38%, rgba(0,183,255,0.18) 0%, rgba(0,0,0,0) 34%), #020202",
    overflow: "hidden",
  } as React.CSSProperties,

  courseGlowA: {
    position: "absolute",
    left: 40,
    top: 130,
    width: 180,
    height: 90,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,255,163,0.18), rgba(0,0,0,0))",
    filter: "blur(18px)",
  } as React.CSSProperties,

  courseGlowB: {
    position: "absolute",
    right: 70,
    top: 70,
    width: 140,
    height: 140,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,170,255,0.22), rgba(0,0,0,0))",
    filter: "blur(10px)",
  } as React.CSSProperties,

  rocket: {
    position: "absolute",
    left: "50%",
    top: "52%",
    transform: "translate(-50%, -50%) rotate(-18deg)",
    fontSize: 110,
    filter: "drop-shadow(0 0 22px rgba(0,170,255,0.28))",
  } as React.CSSProperties,

  coinA: {
    position: "absolute",
    left: 54,
    bottom: 46,
    fontSize: 74,
    color: "#25d0ff",
    opacity: 0.55,
  } as React.CSSProperties,

  coinB: {
    position: "absolute",
    right: 58,
    top: 54,
    fontSize: 58,
    color: "#18b7ff",
    opacity: 0.72,
  } as React.CSSProperties,

  lineA: {
    position: "absolute",
    left: 24,
    bottom: 70,
    width: 180,
    height: 2,
    background:
      "linear-gradient(90deg, rgba(40,255,175,0), rgba(40,255,175,0.9), rgba(40,255,175,0))",
    transform: "rotate(-10deg)",
  } as React.CSSProperties,

  lineB: {
    position: "absolute",
    right: 10,
    bottom: 96,
    width: 140,
    height: 2,
    background:
      "linear-gradient(90deg, rgba(0,194,255,0), rgba(0,194,255,0.9), rgba(0,194,255,0))",
    transform: "rotate(14deg)",
  } as React.CSSProperties,

  courseBottom: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: "0 0 0 0",
  } as React.CSSProperties,

  courseTitle: {
    fontSize: 24,
    fontWeight: 800,
    margin: "0 0 8px 0",
    padding: "0 18px",
  } as React.CSSProperties,

  courseSub: {
    fontSize: 17,
    color: "rgba(255,255,255,0.62)",
    padding: "0 18px 18px",
  } as React.CSSProperties,

  openButton: {
    marginRight: 18,
    marginBottom: 16,
    height: 58,
    padding: "0 28px",
    borderRadius: 999,
    border: "none",
    background: "#377cff",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  debugSection: {
    marginTop: 10,
    paddingTop: 18,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  } as React.CSSProperties,

  debugHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  } as React.CSSProperties,

  debugTitle: {
    fontSize: 18,
    fontWeight: 700,
  } as React.CSSProperties,

  debugSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.42)",
    marginTop: 4,
  } as React.CSSProperties,

  debugBtn: (disabled: boolean): React.CSSProperties => ({
    height: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#fff",
    color: "#000",
    fontWeight: 800,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  }),

  debugInfo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 12,
  } as React.CSSProperties,

  debugLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.44)",
    marginBottom: 6,
  } as React.CSSProperties,

  debugValue: {
    fontSize: 13,
    color: "rgba(255,255,255,0.86)",
    wordBreak: "break-word",
  } as React.CSSProperties,

  debugBox: {
    whiteSpace: "pre-wrap",
    background: "#0b0b0b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 12,
    minHeight: 110,
    fontSize: 12,
    lineHeight: 1.45,
    overflowX: "auto",
    color: "rgba(255,255,255,0.76)",
  } as React.CSSProperties,
};