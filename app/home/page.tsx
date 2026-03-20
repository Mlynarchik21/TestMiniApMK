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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={page()}>
      <div style={container()}>
        {/* TOP HERO */}
        <section style={topHero()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={eyebrow()}>Рын. капитализация</div>

              <div style={heroValueRow()}>
                <span style={heroValue()}>2.48</span>
                <span style={heroValueSuffix()}>T USDT</span>
              </div>

              <div style={heroDeltaWrap()}>
                <span style={{ color: "rgba(255,255,255,0.82)" }}>Изменение за день </span>
                <span style={{ color: "#ff6b6b", fontWeight: 800 }}>-0.76%</span>
              </div>

              <div style={{ marginTop: 20 }}>
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

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button
              type="button"
              onClick={() => router.replace("/profile")}
              style={profileBtn()}
            >
              Мой профиль
            </button>
          </div>
        </section>

        {/* FEAR & GREED HERO */}
        <section
          style={cardLarge()}
          onClick={() => router.replace("/ai")}
          role="button"
          tabIndex={0}
        >
          <div style={sectionLabel()}>FEAR & GREED INDEX</div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <div style={gaugeWrap()}>
              <div style={gaugeArc()} />
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

        {/* MARKET WIDGETS */}
        <section style={cardMedium()} onClick={() => router.replace("/history")} role="button">
          <div style={sectionLabel()}>BTC DOMINANCE</div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 16 }}>
            <div style={dominanceRingWrap()}>
              <div style={dominanceRing()} />
              <div style={dominanceRingValue()}>56.5%</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={miniChart()}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...miniChartBar(),
                      height: `${30 + ((i * 17) % 45)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={cardMedium()} onClick={() => router.replace("/history")} role="button">
          <div style={sectionLabel()}>BTC LONG / SHORT RATIO</div>

          <div style={ratioBar()}>
            <div style={ratioLong()} />
            <div style={ratioShort()} />
          </div>

          <div style={ratioMeta()}>
            <span style={{ color: "#69db7c", fontWeight: 700 }}>61.4% Longs</span>
            <span style={{ color: "#ff8787", fontWeight: 700 }}>38.6% Shorts</span>
          </div>
        </section>

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
            <div style={{ flex: 1 }}>
              <div style={sectionTitle()}>AI Insight</div>
              <div style={sectionSub()}>
                Рынок в фазе страха. Возможна локальная аккумуляция. Повышенный риск по слабым
                альткоинам сохраняется.
              </div>
            </div>

            <div style={aiBadge()}>AI</div>
          </div>

          <div style={{ marginTop: 14 }}>
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

          <div style={{ marginTop: 14 }}>
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

        {/* DEBUG / LAST RESPONSE */}
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
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{props.subtitle}</div>
    </button>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
  };
}

function container(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
  };
}

function topHero(): React.CSSProperties {
  return {
    padding: "8px 2px 10px",
    marginBottom: 18,
  };
}

function eyebrow(): React.CSSProperties {
  return {
    fontSize: 18,
    opacity: 0.88,
    marginBottom: 8,
  };
}

function heroValueRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  };
}

function heroValue(): React.CSSProperties {
  return {
    fontSize: 72,
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  };
}

function heroValueSuffix(): React.CSSProperties {
  return {
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 700,
    opacity: 0.95,
  };
}

function heroDeltaWrap(): React.CSSProperties {
  return {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 1.1,
    fontWeight: 700,
  };
}

function fearRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    fontSize: 18,
    marginBottom: 10,
  };
}

function fearBar(): React.CSSProperties {
  return {
    width: "100%",
    height: 18,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(255,77,79,0.22) 0%, rgba(255,214,0,0.16) 45%, rgba(0,200,83,0.14) 100%)",
    overflow: "hidden",
  };
}

function fearBarFill(percent: number): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #ff6b6b, #ff8787)",
  };
}

function topActions(): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-end",
    minWidth: 74,
  };
}

function iconBtn(): React.CSSProperties {
  return {
    width: 64,
    height: 64,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "#050505",
    color: "#fff",
    fontSize: 28,
    cursor: "pointer",
  };
}

function profileBtn(): React.CSSProperties {
  return {
    padding: "18px 28px",
    borderRadius: 999,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(59,130,246,0.22)",
  };
}

function cardBase(): React.CSSProperties {
  return {
    background: "linear-gradient(180deg, #101427 0%, #0b0f1d 100%)",
    border: "1px solid rgba(111,132,255,0.14)",
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
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
    minHeight: 152,
    cursor: "pointer",
  };
}

function cardAccent(): React.CSSProperties {
  return {
    ...cardBase(),
    background:
      "linear-gradient(180deg, rgba(32,40,82,1) 0%, rgba(13,18,36,1) 100%)",
    border: "1px solid rgba(59,130,246,0.25)",
    cursor: "pointer",
  };
}

function sectionLabel(): React.CSSProperties {
  return {
    fontSize: 14,
    letterSpacing: "0.14em",
    color: "rgba(255,255,255,0.42)",
    fontWeight: 700,
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 8,
  };
}

function sectionSub(): React.CSSProperties {
  return {
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.72)",
  };
}

function gaugeWrap(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 420,
    position: "relative",
    height: 240,
  };
}

function gaugeArc(): React.CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: 14,
    width: 300,
    height: 150,
    transform: "translateX(-50%)",
    borderTopLeftRadius: 300,
    borderTopRightRadius: 300,
    borderBottom: "none",
    borderLeft: "16px solid #ff6b6b",
    borderTop: "16px solid rgba(255,214,0,0.25)",
    borderRight: "16px solid rgba(0,200,83,0.2)",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  };
}

function gaugeNeedle(percent: number): React.CSSProperties {
  const deg = -90 + (180 * percent) / 100;
  return {
    position: "absolute",
    left: "50%",
    top: 148,
    width: 110,
    height: 4,
    background: "#ff6b6b",
    transformOrigin: "0% 50%",
    transform: `translateX(0) rotate(${deg}deg)`,
    borderRadius: 999,
    boxShadow: "0 0 14px rgba(255,107,107,0.6)",
  };
}

function gaugeCenter(): React.CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: 100,
    transform: "translateX(-50%)",
    textAlign: "center",
  };
}

function gaugeValue(): React.CSSProperties {
  return {
    fontSize: 72,
    lineHeight: 1,
    fontWeight: 900,
    color: "#ff6b6b",
    textShadow: "0 0 20px rgba(255,107,107,0.18)",
  };
}

function gaugeText(): React.CSSProperties {
  return {
    marginTop: 10,
    fontSize: 20,
    color: "#ff8787",
    fontWeight: 700,
  };
}

function gaugeMin(): React.CSSProperties {
  return {
    position: "absolute",
    left: 16,
    bottom: 8,
    color: "rgba(255,255,255,0.35)",
    fontSize: 16,
  };
}

function gaugeMax(): React.CSSProperties {
  return {
    position: "absolute",
    right: 16,
    bottom: 8,
    color: "rgba(255,255,255,0.35)",
    fontSize: 16,
  };
}

function dominanceRingWrap(): React.CSSProperties {
  return {
    width: 112,
    height: 112,
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
      "conic-gradient(#f59f3a 0 56.5%, rgba(255,255,255,0.08) 56.5% 100%)",
    WebkitMask:
      "radial-gradient(circle at center, transparent 56%, #000 57%)",
    mask: "radial-gradient(circle at center, transparent 56%, #000 57%)",
  };
}

function dominanceRingValue(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 900,
  };
}

function miniChart(): React.CSSProperties {
  return {
    height: 92,
    display: "flex",
    alignItems: "flex-end",
    gap: 4,
  };
}

function miniChartBar(): React.CSSProperties {
  return {
    flex: 1,
    borderRadius: 999,
    background: "linear-gradient(180deg, rgba(245,159,58,0.92), rgba(245,159,58,0.18))",
    minWidth: 6,
  };
}

function ratioBar(): React.CSSProperties {
  return {
    marginTop: 18,
    width: "100%",
    height: 28,
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
    marginTop: 14,
    fontSize: 18,
  };
}

function grid2(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  };
}

function smallMetric(): React.CSSProperties {
  return {
    marginTop: 28,
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
  };
}

function aiBadge(): React.CSSProperties {
  return {
    minWidth: 52,
    height: 52,
    borderRadius: 16,
    background: "rgba(59,130,246,0.12)",
    color: "#8ab4ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 18,
    border: "1px solid rgba(59,130,246,0.28)",
  };
}

function btnBlueFull(): React.CSSProperties {
  return {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 18,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  };
}

function btnGhostFull(): React.CSSProperties {
  return {
    width: "100%",
    padding: "15px 18px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.03)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  };
}

function statsGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
  };
}

function statBox(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
  };
}

function statLabel(): React.CSSProperties {
  return {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 8,
  };
}

function statValue(): React.CSSProperties {
  return {
    fontSize: 22,
    fontWeight: 900,
  };
}

function sectionHeader(): React.CSSProperties {
  return {
    fontSize: 15,
    fontWeight: 800,
    color: "rgba(255,255,255,0.72)",
    margin: "2px 2px 10px",
  };
}

function quickGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  };
}

function quickCard(): React.CSSProperties {
  return {
    textAlign: "left",
    background: "#0c0c0f",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 18,
    color: "#fff",
    cursor: "pointer",
    minHeight: 116,
  };
}

function debugBox(): React.CSSProperties {
  return {
    whiteSpace: "pre-wrap",
    background: "#050505",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    minHeight: 140,
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
    border: "1px solid rgba(255,255,255,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}