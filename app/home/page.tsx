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
    <main style={page()}>
      <div style={container()}>
        {/* TOP HERO */}
        <section style={topHero()}>
          <div style={topHeroGrid()}>
            <div style={{ minWidth: 0 }}>
              <div style={eyebrow()}>Рын. капитализация</div>

              <div style={heroValueRow()}>
                <span style={heroValue()}>2.48</span>
                <span style={heroValueSuffix()}>T USDT</span>
              </div>

              <div style={heroDeltaWrap()}>
                <div style={{ color: "rgba(255,255,255,0.88)" }}>Изменение за день</div>
                <div style={{ color: "#ff6b6b", fontWeight: 900, marginTop: 2 }}>-0.76%</div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={fearRow()}>
                  <span style={{ color: "#FFD600" }}>Жадность и страх</span>
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>11%</span>
                </div>

                <div style={fearBar()}>
                  <div style={fearBarFill(11)} />
                </div>
              </div>
            </div>

            <div style={topActions()}>
              <button type="button" style={iconBtn()} onClick={() => router.replace("/ai")}>
                ✦
              </button>

              <button type="button" style={iconBtn()} onClick={() => router.replace("/history")}>
                🔔
              </button>

              <button type="button" style={iconBtn()} onClick={() => router.replace("/settings")}>
                ☾
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={() => router.replace("/profile")}
              style={profileBtn()}
            >
              Мой профиль
            </button>
          </div>
        </section>

        {/* FEAR & GREED */}
        <section
          style={cardLarge()}
          onClick={() => router.replace("/ai")}
          role="button"
          tabIndex={0}
        >
          <div style={sectionLabel()}>FEAR & GREED INDEX</div>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <div style={gaugeWrap()}>
              <div style={gaugeArcRed()} />
              <div style={gaugeArcYellow()} />
              <div style={gaugeArcGreen()} />
              <div style={gaugeNeedle(23)} />
              <div style={gaugeCenter()}>
                <div style={gaugeValue()}>23</div>
                <div style={gaugeText()}>Extreme Fear</div>
              </div>
              <div style={gaugeMin()}>0</div>
              <div style={gaugeMax()}>100</div>
            </div>
          </div>
        </section>

        {/* BTC DOMINANCE */}
        <section style={cardMedium()} onClick={() => router.replace("/history")} role="button">
          <div style={sectionLabel()}>BTC DOMINANCE</div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
            <div style={dominanceRingWrap()}>
              <div style={dominanceRing()} />
              <div style={dominanceRingValue()}>56.5%</div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={miniChart()}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...miniChartBar(),
                      height: `${28 + ((i * 17) % 36)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LONG SHORT */}
        <section style={cardMedium()} onClick={() => router.replace("/history")} role="button">
          <div style={sectionLabel()}>BTC LONG / SHORT RATIO</div>

          <div style={ratioBar()}>
            <div style={ratioLong()} />
            <div style={ratioShort()} />
          </div>

          <div style={ratioMeta()}>
            <span style={{ color: "#69db7c", fontWeight: 800 }}>61.4% Longs</span>
            <span style={{ color: "#ff8787", fontWeight: 800 }}>38.6% Shorts</span>
          </div>
        </section>

        {/* SMALL METRICS */}
        <div style={grid2()}>
          <section style={cardSmall()} onClick={() => router.replace("/history")} role="button">
            <div style={sectionLabel()}>TOTAL OI</div>
            <div style={smallMetric()}>$25.58B</div>
          </section>

          <section style={cardSmall()} onClick={() => router.replace("/history")} role="button">
            <div style={sectionLabel()}>COINBASE</div>
            <div style={{ ...smallMetric(), color: "#ff6b6b" }}>#359</div>
          </section>
        </div>

        {/* AI BLOCK */}
        <section style={cardAccent()} onClick={() => router.replace("/ai")} role="button">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={sectionTitle()}>AI Insight</div>
              <div style={sectionSub()}>
                Рынок в фазе страха. Возможна локальная аккумуляция. Повышенный риск по слабым
                альткоинам сохраняется.
              </div>
            </div>

            <div style={aiBadge()}>AI</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" style={btnBlueFull()} onClick={() => router.replace("/ai")}>
              Открыть AI
            </button>
          </div>
        </section>

        {/* BOT SNAPSHOT */}
        <section style={cardMedium()} onClick={() => router.replace("/bot")} role="button">
          <div style={sectionTitle()}>Снимок бота</div>

          <div style={statsGrid()}>
            <div style={statBox()}>
              <div style={statLabel()}>Статус</div>
              <div style={statValue()}>Активен</div>
            </div>

            <div style={statBox()}>
              <div style={statLabel()}>Позиции</div>
              <div style={statValue()}>3</div>
            </div>

            <div style={statBox()}>
              <div style={statLabel()}>PnL сегодня</div>
              <div style={{ ...statValue(), color: "#69db7c" }}>+12.3</div>
            </div>

            <div style={statBox()}>
              <div style={statLabel()}>В работе</div>
              <div style={statValue()}>45 USDT</div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" style={btnGhostFull()} onClick={() => router.replace("/bot")}>
              Открыть бот
            </button>
          </div>
        </section>

        {/* QUICK ACCESS */}
        <div style={sectionHeader()}>Быстрый доступ</div>

        <div style={quickGrid()}>
          <QuickCard title="Bot" subtitle="Сделки и контроль" onClick={() => router.replace("/bot")} />
          <QuickCard
            title="History"
            subtitle="История сделок"
            onClick={() => router.replace("/history")}
          />
          <QuickCard title="Keys" subtitle="API и биржи" onClick={() => router.replace("/keys")} />
          <QuickCard
            title="Profile"
            subtitle="Статус и услуги"
            onClick={() => router.replace("/profile")}
          />
        </div>

        {/* DEBUG */}
        <div style={sectionHeader()}>Технический статус</div>

        <section style={cardMedium()}>
          <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 12 }}>
            <div>
              <b>sessionToken:</b> {tokenPreview}
            </div>
            <div>
              <b>HTTP статус:</b> {status ?? "—"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <button onClick={checkMe} disabled={loading} style={btnPrimary(loading)}>
              {loading ? "..." : "Проверить /api/me"}
            </button>
          </div>

          <div style={debugBox()}>
            {result ? JSON.stringify(result, null, 2) : "—"}
          </div>
        </section>
      </div>
    </main>
  );
}

function QuickCard(props: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} style={quickCard()}>
      <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.35 }}>{props.subtitle}</div>
    </button>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
  };
}

function container(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    padding: "0 14px",
  };
}

function topHero(): React.CSSProperties {
  return {
    padding: "2px 2px 6px",
    marginBottom: 14,
  };
}

function topHeroGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 64px",
    gap: 12,
    alignItems: "start",
  };
}

function eyebrow(): React.CSSProperties {
  return {
    fontSize: 16,
    lineHeight: 1.2,
    color: "rgba(255,255,255,0.86)",
    marginBottom: 8,
  };
}

function heroValueRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    flexWrap: "wrap",
  };
}

function heroValue(): React.CSSProperties {
  return {
    fontSize: 56,
    lineHeight: 0.92,
    fontWeight: 900,
    letterSpacing: "-0.05em",
  };
}

function heroValueSuffix(): React.CSSProperties {
  return {
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 800,
    opacity: 0.95,
  };
}

function heroDeltaWrap(): React.CSSProperties {
  return {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 1.08,
    fontWeight: 900,
  };
}

function fearRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    fontSize: 16,
    marginBottom: 8,
  };
}

function fearBar(): React.CSSProperties {
  return {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(255,77,79,0.35) 0%, rgba(255,214,0,0.22) 45%, rgba(0,200,83,0.22) 100%)",
    overflow: "hidden",
  };
}

function fearBarFill(percent: number): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff7a7a",
  };
}

function topActions(): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-end",
  };
}

function iconBtn(): React.CSSProperties {
  return {
    width: 56,
    height: 56,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#050505",
    color: "#fff",
    fontSize: 24,
    cursor: "pointer",
  };
}

function profileBtn(): React.CSSProperties {
  return {
    padding: "16px 24px",
    borderRadius: 999,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  };
}

function cardBase(): React.CSSProperties {
  return {
    background: "#0b1020",
    border: "1px solid rgba(111,132,255,0.12)",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  };
}

function cardLarge(): React.CSSProperties {
  return {
    ...cardBase(),
    cursor: "pointer",
  };
}

function cardMedium(): React.CSSProperties {
  return {
    ...cardBase(),
    cursor: "pointer",
  };
}

function cardSmall(): React.CSSProperties {
  return {
    ...cardBase(),
    minHeight: 132,
    cursor: "pointer",
  };
}

function cardAccent(): React.CSSProperties {
  return {
    ...cardBase(),
    background: "#101833",
    border: "1px solid rgba(59,130,246,0.16)",
    cursor: "pointer",
  };
}

function sectionLabel(): React.CSSProperties {
  return {
    fontSize: 13,
    letterSpacing: "0.14em",
    color: "rgba(255,255,255,0.4)",
    fontWeight: 800,
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 22,
    fontWeight: 900,
    marginBottom: 6,
  };
}

function sectionSub(): React.CSSProperties {
  return {
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.74)",
  };
}

function gaugeWrap(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 360,
    position: "relative",
    height: 210,
  };
}

function gaugeArcCommon(): React.CSSProperties {
  return {
    position: "absolute",
    top: 16,
    width: 118,
    height: 118,
    borderTopLeftRadius: 118,
    borderTopRightRadius: 118,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottom: "none",
    borderLeftWidth: 14,
    borderTopWidth: 14,
    borderRightWidth: 14,
    borderStyle: "solid",
  };
}

function gaugeArcRed(): React.CSSProperties {
  return {
    ...gaugeArcCommon(),
    left: 24,
    borderColor: "#ff6b6b",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  };
}

function gaugeArcYellow(): React.CSSProperties {
  return {
    ...gaugeArcCommon(),
    left: "50%",
    transform: "translateX(-50%)",
    borderColor: "rgba(255,214,0,0.36)",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  };
}

function gaugeArcGreen(): React.CSSProperties {
  return {
    ...gaugeArcCommon(),
    right: 24,
    borderColor: "rgba(0,200,83,0.28)",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
  };
}

function gaugeNeedle(percent: number): React.CSSProperties {
  const deg = -90 + (180 * percent) / 100;
  return {
    position: "absolute",
    left: "50%",
    top: 132,
    width: 92,
    height: 4,
    background: "#ff6b6b",
    transformOrigin: "0% 50%",
    transform: `translateX(0) rotate(${deg}deg)`,
    borderRadius: 999,
  };
}

function gaugeCenter(): React.CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: 92,
    transform: "translateX(-50%)",
    textAlign: "center",
    width: "100%",
  };
}

function gaugeValue(): React.CSSProperties {
  return {
    fontSize: 64,
    lineHeight: 1,
    fontWeight: 900,
    color: "#ff6b6b",
  };
}

function gaugeText(): React.CSSProperties {
  return {
    marginTop: 8,
    fontSize: 18,
    color: "#ff8787",
    fontWeight: 800,
  };
}

function gaugeMin(): React.CSSProperties {
  return {
    position: "absolute",
    left: 18,
    bottom: 4,
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
  };
}

function gaugeMax(): React.CSSProperties {
  return {
    position: "absolute",
    right: 18,
    bottom: 4,
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
  };
}

function dominanceRingWrap(): React.CSSProperties {
  return {
    width: 96,
    height: 96,
    borderRadius: 999,
    position: "relative",
    flexShrink: 0,
  };
}

function dominanceRing(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(#f5a33a 0 56.5%, rgba(255,255,255,0.08) 56.5% 100%)",
    WebkitMask:
      "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
  };
}

function dominanceRingValue(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 900,
  };
}

function miniChart(): React.CSSProperties {
  return {
    height: 82,
    display: "flex",
    alignItems: "flex-end",
    gap: 4,
  };
}

function miniChartBar(): React.CSSProperties {
  return {
    flex: 1,
    borderRadius: 999,
    background: "rgba(245,163,58,0.92)",
    minWidth: 5,
  };
}

function ratioBar(): React.CSSProperties {
  return {
    marginTop: 16,
    width: "100%",
    height: 20,
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",
    background: "rgba(255,255,255,0.06)",
  };
}

function ratioLong(): React.CSSProperties {
  return {
    width: "61.4%",
    background: "#69db7c",
  };
}

function ratioShort(): React.CSSProperties {
  return {
    width: "38.6%",
    background: "#ff6b6b",
  };
}

function ratioMeta(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
    fontSize: 16,
  };
}

function grid2(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  };
}

function smallMetric(): React.CSSProperties {
  return {
    marginTop: 22,
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 900,
  };
}

function aiBadge(): React.CSSProperties {
  return {
    minWidth: 46,
    height: 46,
    borderRadius: 14,
    background: "rgba(59,130,246,0.12)",
    color: "#8ab4ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 16,
    border: "1px solid rgba(59,130,246,0.2)",
  };
}

function btnBlueFull(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  };
}

function btnGhostFull(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.03)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  };
}

function statsGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function statBox(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 12,
  };
}

function statLabel(): React.CSSProperties {
  return {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 6,
  };
}

function statValue(): React.CSSProperties {
  return {
    fontSize: 20,
    fontWeight: 900,
  };
}

function sectionHeader(): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 800,
    color: "rgba(255,255,255,0.72)",
    margin: "2px 2px 10px",
  };
}

function quickGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  };
}

function quickCard(): React.CSSProperties {
  return {
    textAlign: "left",
    background: "#0b0f1b",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 16,
    color: "#fff",
    cursor: "pointer",
    minHeight: 104,
  };
}

function debugBox(): React.CSSProperties {
  return {
    whiteSpace: "pre-wrap",
    background: "#050505",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    minHeight: 120,
    fontSize: 12,
    lineHeight: 1.45,
    overflowX: "auto",
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}