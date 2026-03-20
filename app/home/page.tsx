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
        {/* HERO */}
        <section style={heroSection()}>
          <div style={heroTopRow()}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={heroLabel()}>Рын. капитализация</div>

              <div style={heroMainValue()}>
                <span>2.48</span>
                <span style={heroMainSuffix()}>T USDT</span>
              </div>

              <div style={heroDayLine()}>
                <span style={{ color: "rgba(255,255,255,0.82)" }}>Изменение за день </span>
                <span style={{ color: "#ff6b6b", fontWeight: 800 }}>-0.76%</span>
              </div>

              <div style={fearInlineRow()}>
                <span style={{ color: "#FFD54A" }}>Жадность и страх</span>
                <span style={{ color: "rgba(255,255,255,0.72)" }}>11%</span>
              </div>

              <div style={fearTrack()}>
                <div style={fearFill(11)} />
              </div>
            </div>

            <div style={heroIcons()}>
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

          <div style={heroActions()}>
            <button type="button" style={actionBtnBlue()} onClick={() => router.replace("/profile")}>
              Профиль
            </button>
            <button type="button" style={actionBtnGhost()} onClick={() => router.replace("/ai")}>
              AI
            </button>
            <button type="button" style={actionBtnGhost()} onClick={() => router.replace("/bot")}>
              Bot
            </button>
          </div>
        </section>

        {/* FEAR & GREED */}
        <section style={card()}>
          <div style={cardLabel()}>FEAR & GREED INDEX</div>

          <div style={{ marginTop: 16 }}>
            <div style={bigMetricValue("#ff6b6b")}>23</div>
            <div style={bigMetricSub("#ff8787")}>Extreme Fear</div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={simpleMeter()}>
              <div style={simpleMeterFill(23, "#ff6b6b")} />
            </div>
            <div style={meterMeta()}>
              <span>0</span>
              <span>100</span>
            </div>
          </div>
        </section>

        {/* BTC DOM */}
        <section style={card()}>
          <div style={cardLabel()}>BTC DOMINANCE</div>

          <div style={inlineMetricRow()}>
            <div style={ringWrap()}>
              <div style={ring(56.5, "#f5a33a")} />
              <div style={ringText()}>56.5%</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={barsWrap()}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...bar(),
                      height: `${28 + ((i * 13) % 34)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LONG SHORT */}
        <section style={card()}>
          <div style={cardLabel()}>BTC LONG / SHORT RATIO</div>

          <div style={splitBar()}>
            <div style={splitBarLong()} />
            <div style={splitBarShort()} />
          </div>

          <div style={splitMeta()}>
            <span style={{ color: "#69db7c" }}>61.4% Longs</span>
            <span style={{ color: "#ff7b7b" }}>38.6% Shorts</span>
          </div>
        </section>

        {/* SMALL CARDS */}
        <div style={twoCol()}>
          <section style={cardSmall()}>
            <div style={cardLabel()}>TOTAL OI</div>
            <div style={smallValue()}>$25.58B</div>
          </section>

          <section style={cardSmall()}>
            <div style={cardLabel()}>COINBASE</div>
            <div style={{ ...smallValue(), color: "#ff6b6b" }}>#359</div>
          </section>
        </div>

        {/* AI */}
        <section style={card()}>
          <div style={topLineBetween()}>
            <div>
              <div style={cardTitle()}>AI Insight</div>
              <div style={cardText()}>
                Рынок в фазе страха. Возможна локальная аккумуляция. Риск по слабым альтам
                остаётся повышенным.
              </div>
            </div>

            <div style={badge()}>AI</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button type="button" style={wideGhostButton()} onClick={() => router.replace("/ai")}>
              Открыть AI
            </button>
          </div>
        </section>

        {/* BOT SNAPSHOT */}
        <section style={card()}>
          <div style={cardTitle()}>Снимок бота</div>

          <div style={statsGrid()}>
            <div style={statItem()}>
              <div style={statLabel()}>Статус</div>
              <div style={statValue()}>Активен</div>
            </div>
            <div style={statItem()}>
              <div style={statLabel()}>Позиции</div>
              <div style={statValue()}>3</div>
            </div>
            <div style={statItem()}>
              <div style={statLabel()}>PnL сегодня</div>
              <div style={{ ...statValue(), color: "#69db7c" }}>+12.3</div>
            </div>
            <div style={statItem()}>
              <div style={statLabel()}>В работе</div>
              <div style={statValue()}>45 USDT</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button type="button" style={wideGhostButton()} onClick={() => router.replace("/bot")}>
              Открыть бот
            </button>
          </div>
        </section>

        {/* QUICK ACCESS */}
        <div style={sectionHeader()}>Переходы</div>

        <div style={quickGrid()}>
          <QuickCard title="Bot" subtitle="Сделки и контроль" onClick={() => router.replace("/bot")} />
          <QuickCard title="Keys" subtitle="API и биржи" onClick={() => router.replace("/keys")} />
          <QuickCard
            title="History"
            subtitle="История сделок"
            onClick={() => router.replace("/history")}
          />
          <QuickCard
            title="Profile"
            subtitle="Статус и услуги"
            onClick={() => router.replace("/profile")}
          />
        </div>

        {/* DEBUG */}
        <div style={sectionHeader()}>Технический статус</div>

        <section style={card()}>
          <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 12 }}>
            <div>
              <b>sessionToken:</b> {tokenPreview}
            </div>
            <div>
              <b>HTTP статус:</b> {status ?? "—"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <button onClick={checkMe} disabled={loading} style={primaryBtn(loading)}>
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
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
        {props.subtitle}
      </div>
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
    padding: "0 16px",
  };
}

function heroSection(): React.CSSProperties {
  return {
    marginBottom: 18,
  };
}

function heroTopRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 56px",
    gap: 14,
    alignItems: "start",
  };
}

function heroLabel(): React.CSSProperties {
  return {
    fontSize: 17,
    color: "rgba(255,255,255,0.78)",
    marginBottom: 8,
  };
}

function heroMainValue(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    flexWrap: "wrap",
    fontSize: 58,
    fontWeight: 900,
    letterSpacing: "-0.05em",
    lineHeight: 0.95,
  };
}

function heroMainSuffix(): React.CSSProperties {
  return {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  };
}

function heroDayLine(): React.CSSProperties {
  return {
    marginTop: 18,
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 800,
  };
}

function fearInlineRow(): React.CSSProperties {
  return {
    marginTop: 18,
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 16,
  };
}

function fearTrack(): React.CSSProperties {
  return {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(255,77,79,0.35) 0%, rgba(255,214,0,0.24) 45%, rgba(0,200,83,0.22) 100%)",
    overflow: "hidden",
  };
}

function fearFill(percent: number): React.CSSProperties {
  return {
    width: `${percent}%`,
    height: "100%",
    borderRadius: 999,
    background: "#ff7b7b",
  };
}

function heroIcons(): React.CSSProperties {
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
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#050505",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
  };
}

function heroActions(): React.CSSProperties {
  return {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    marginTop: 16,
  };
}

function actionBtnBlue(): React.CSSProperties {
  return {
    padding: "14px 22px",
    borderRadius: 999,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  };
}

function actionBtnGhost(): React.CSSProperties {
  return {
    padding: "14px 20px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#0a0a0a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  };
}

function card(): React.CSSProperties {
  return {
    background: "#050505",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  };
}

function cardSmall(): React.CSSProperties {
  return {
    background: "#050505",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 18,
    minHeight: 128,
  };
}

function cardLabel(): React.CSSProperties {
  return {
    fontSize: 14,
    letterSpacing: "0.16em",
    color: "rgba(255,255,255,0.36)",
    fontWeight: 800,
  };
}

function bigMetricValue(color?: string): React.CSSProperties {
  return {
    fontSize: 72,
    lineHeight: 1,
    fontWeight: 900,
    color: color || "#fff",
  };
}

function bigMetricSub(color?: string): React.CSSProperties {
  return {
    marginTop: 6,
    fontSize: 20,
    fontWeight: 700,
    color: color || "rgba(255,255,255,0.72)",
  };
}

function simpleMeter(): React.CSSProperties {
  return {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  };
}

function simpleMeterFill(percent: number, color: string): React.CSSProperties {
  return {
    width: `${percent}%`,
    height: "100%",
    borderRadius: 999,
    background: color,
  };
}

function meterMeta(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 6,
    fontSize: 13,
    color: "rgba(255,255,255,0.38)",
  };
}

function inlineMetricRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginTop: 16,
  };
}

function ringWrap(): React.CSSProperties {
  return {
    width: 96,
    height: 96,
    position: "relative",
    flexShrink: 0,
  };
}

function ring(percent: number, color: string): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${color} 0 ${percent}%, rgba(255,255,255,0.08) ${percent}% 100%)`,
    WebkitMask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
  };
}

function ringText(): React.CSSProperties {
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

function barsWrap(): React.CSSProperties {
  return {
    height: 84,
    display: "flex",
    alignItems: "flex-end",
    gap: 5,
  };
}

function bar(): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 5,
    borderRadius: 999,
    background: "#f5a33a",
  };
}

function splitBar(): React.CSSProperties {
  return {
    width: "100%",
    height: 22,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    display: "flex",
    marginTop: 16,
  };
}

function splitBarLong(): React.CSSProperties {
  return {
    width: "61.4%",
    background: "#69db7c",
  };
}

function splitBarShort(): React.CSSProperties {
  return {
    width: "38.6%",
    background: "#ff6b6b",
  };
}

function splitMeta(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
    fontSize: 17,
    fontWeight: 700,
  };
}

function twoCol(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  };
}

function smallValue(): React.CSSProperties {
  return {
    marginTop: 22,
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 900,
  };
}

function topLineBetween(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  };
}

function cardTitle(): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 6,
  };
}

function cardText(): React.CSSProperties {
  return {
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.7)",
  };
}

function badge(): React.CSSProperties {
  return {
    minWidth: 46,
    height: 46,
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  };
}

function wideGhostButton(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0a0a0a",
    color: "#fff",
    fontWeight: 800,
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

function statItem(): React.CSSProperties {
  return {
    background: "#0a0a0a",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18,
    padding: 14,
  };
}

function statLabel(): React.CSSProperties {
  return {
    fontSize: 12,
    color: "rgba(255,255,255,0.46)",
    marginBottom: 7,
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
    margin: "2px 2px 10px",
    fontSize: 14,
    fontWeight: 700,
    color: "rgba(255,255,255,0.6)",
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
    background: "#050505",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 16,
    color: "#fff",
    minHeight: 102,
    cursor: "pointer",
  };
}

function debugBox(): React.CSSProperties {
  return {
    whiteSpace: "pre-wrap",
    background: "#0a0a0a",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 12,
    minHeight: 120,
    fontSize: 12,
    lineHeight: 1.45,
    overflowX: "auto",
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}