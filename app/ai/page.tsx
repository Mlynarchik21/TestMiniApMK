"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AiScenarioKey = "today" | "week" | "month";
type PortfolioModeKey = "balanced" | "defensive" | "aggressive";

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
};

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

function ringStyle(percent: number, color: string): CSSProperties {
  const safePercent = Math.max(0, Math.min(100, percent));
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(${color} 0 ${safePercent}%, rgba(255,255,255,0.10) ${safePercent}% 100%)`,
    WebkitMask:
      "radial-gradient(circle at center, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
  };
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

export default function AiPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  const [scenario, setScenario] = useState<AiScenarioKey>("today");
  const [portfolioMode, setPortfolioMode] = useState<PortfolioModeKey>("balanced");

  useEffect(() => {
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
      tg?.onEvent?.("fullscreen_changed", updateLayout);
    } catch {}

    const id = requestAnimationFrame(() => setMounted(true));

    return () => {
      cancelAnimationFrame(id);
      try {
        tg?.offEvent?.("fullscreen_changed", updateLayout);
      } catch {}
    };
  }, []);

  const scenarioConfig = useMemo(() => {
    const map = {
      today: {
        bar1: 62,
        bar2: 0,
        bar3: 0,
        detail:
          "Сегодня AI рекомендует частично фиксировать прибыль, не увеличивать плечо и держать дневной риск под жёстким контролем.",
        rows: [
          { focus: "Фиксация части профита", pnl: "+0.5…+2%", risk: "контроль" },
          { focus: "Снижение плеча", pnl: "нейтрально", risk: "ниже риск" },
          { focus: "Рост доли стейблов", pnl: "нейтрально", risk: "защита" },
        ],
      },
      week: {
        bar1: 0,
        bar2: 78,
        bar3: 0,
        detail:
          "На неделю приоритет — выровнять риск, убрать перегруз в одной монете и закрывать сильные импульсные позиции поэтапно.",
        rows: [
          { focus: "Снижение концентрации", pnl: "+2…+4%", risk: "умеренный" },
          { focus: "Ротация в стейблы", pnl: "нейтрально", risk: "мягче просадка" },
          { focus: "Меньше сделок в день", pnl: "по рынку", risk: "ниже хаос" },
        ],
      },
      month: {
        bar1: 0,
        bar2: 0,
        bar3: 54,
        detail:
          "На месяц AI советует заранее собрать сценарии роста, флэта и падения, а также прописать уровни докупки и фиксации.",
        rows: [
          { focus: "План уровней", pnl: "по сценарию", risk: "структурно" },
          { focus: "Сдвиг в защиту", pnl: "+3…+6%", risk: "ниже вола" },
          { focus: "Ограничить high-beta", pnl: "умеренный", risk: "контроль хвоста" },
        ],
      },
    } satisfies Record<
      AiScenarioKey,
      {
        bar1: number;
        bar2: number;
        bar3: number;
        detail: string;
        rows: { focus: string; pnl: string; risk: string }[];
      }
    >;

    return map[scenario];
  }, [scenario]);

  const allocationConfig = useMemo(() => {
    const map = {
      balanced: {
        text:
          "Сбалансированный режим: основа в BTC/ETH, часть в альтах и обязательный запас стейблкоинов для манёвра.",
        rows: [
          {
            title: "Стейблкоины",
            sub: "кэш на докупки и покрытие маржи",
            target: "25–30%",
            current: "~18%",
            targetColor: UI.green,
          },
          {
            title: "BTC / ETH",
            sub: "ядро портфеля",
            target: "45–55%",
            current: "~60%",
            targetColor: UI.textMain,
          },
          {
            title: "Крупные альты",
            sub: "SOL и ликвидные монеты",
            target: "15–20%",
            current: "~15%",
            targetColor: UI.textMain,
          },
          {
            title: "Агрессивный сегмент",
            sub: "high-beta идеи",
            target: "<5%",
            current: "~7%",
            targetColor: UI.red,
          },
        ],
      },
      defensive: {
        text:
          "Защитный режим: упор на сохранение капитала, больше стейблкоинов и минимальный агрессивный риск.",
        rows: [
          {
            title: "Стейблкоины",
            sub: "главный буфер ликвидности",
            target: "35–45%",
            current: "~18%",
            targetColor: UI.green,
          },
          {
            title: "BTC / ETH",
            sub: "база участия в рынке",
            target: "30–40%",
            current: "~60%",
            targetColor: UI.textMain,
          },
          {
            title: "Крупные альты",
            sub: "только сильные монеты",
            target: "10–15%",
            current: "~15%",
            targetColor: UI.textMain,
          },
          {
            title: "Агрессивный сегмент",
            sub: "тестовые суммы",
            target: "0–3%",
            current: "~7%",
            targetColor: UI.red,
          },
        ],
      },
      aggressive: {
        text:
          "Агрессивный режим: фокус на доходности, но даже здесь AI оставляет обязательный резерв в стейблкоинах.",
        rows: [
          {
            title: "Стейблкоины",
            sub: "минимальный буфер",
            target: "10–15%",
            current: "~18%",
            targetColor: UI.yellow,
          },
          {
            title: "BTC / ETH",
            sub: "основа с рабочим риском",
            target: "45–55%",
            current: "~60%",
            targetColor: UI.textMain,
          },
          {
            title: "Крупные альты",
            sub: "основной драйвер доходности",
            target: "20–30%",
            current: "~15%",
            targetColor: UI.green,
          },
          {
            title: "Агрессивный сегмент",
            sub: "высокий бета-риск",
            target: "5–10%",
            current: "~7%",
            targetColor: UI.red,
          },
        ],
      },
    } satisfies Record<
      PortfolioModeKey,
      {
        text: string;
        rows: {
          title: string;
          sub: string;
          target: string;
          current: string;
          targetColor: string;
        }[];
      }
    >;

    return map[portfolioMode];
  }, [portfolioMode]);

  const checklist = useMemo(() => {
    if (portfolioMode === "defensive") {
      return [
        { text: "Увеличить долю стейблкоинов до защитного диапазона.", tone: "ok" },
        { text: "Снизить плечо по фьючерсным позициям до комфортного уровня.", tone: "ok" },
        { text: "Не открывать новые high-risk сделки без подтверждения.", tone: "warn" },
        { text: "Фиксировать прибыль ступенчато, а не одной точкой.", tone: "ok" },
        { text: "Исключить перегруженные и перекупленные монеты.", tone: "bad" },
      ];
    }

    if (portfolioMode === "aggressive") {
      return [
        { text: "Держать минимальный, но обязательный резерв в стейблкоинах.", tone: "warn" },
        { text: "Работать только с заранее заданным лимитом убытка на день.", tone: "ok" },
        { text: "Не увеличивать риск после серии убыточных сделок.", tone: "bad" },
        { text: "Оставлять часть прибыли в кэше после сильных импульсов.", tone: "ok" },
        { text: "Следить за концентрацией в одной монете и одном секторе.", tone: "warn" },
      ];
    }

    return [
      { text: "Зафиксировать часть прибыли по самым перегретым позициям.", tone: "ok" },
      { text: "Снизить плечо по BTC/ETH до безопасного уровня.", tone: "ok" },
      { text: "Подтянуть дневной лимит убытка и не превышать его.", tone: "warn" },
      { text: "Довести долю стейблкоинов до целевого диапазона.", tone: "ok" },
      { text: "Избегать новых входов в перекупленных активах без отката.", tone: "bad" },
    ];
  }, [portfolioMode]);

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

        button,
        input,
        textarea,
        select {
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
              onClick={() => router.replace("/home")}
            >
              <ArrowLeftIcon />
            </button>

            <div style={styles.pageTitle}>AI-аналитика</div>

            <div style={styles.topSpacer} />
          </section>

          <section style={{ ...styles.heroCard, ...reveal(1, mounted) }}>
            <div style={styles.sectionMainTitle}>Режим аккаунта и индекс здоровья</div>
            <div style={styles.sectionSubText}>
              Сводный взгляд AI на состояние счёта: риск, концентрация и рабочий режим.
            </div>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryRow}>
                <div style={styles.summaryLeft}>
                  <div style={styles.summaryMain}>Текущий режим</div>
                  <div style={styles.summarySub}>
                    баланс между риском и доходностью
                  </div>
                </div>
                <div style={styles.summaryRight}>
                  <div style={{ ...styles.summaryValue, color: UI.green }}>
                    сбалансированный
                  </div>
                  <div style={styles.summaryHint}>
                    aggressive / balanced / defensive
                  </div>
                </div>
              </div>

              <div style={styles.summaryRow}>
                <div style={styles.summaryLeft}>
                  <div style={styles.summaryMain}>Основной источник риска</div>
                  <div style={styles.summarySub}>
                    фьючерсы и перегруз в BTC/ETH
                  </div>
                </div>
                <div style={styles.summaryRight}>
                  <div style={styles.summaryValue}>BTC / ETH</div>
                  <div style={styles.summaryHint}>часть позиций с плечом</div>
                </div>
              </div>

              <div style={styles.summaryRow}>
                <div style={styles.summaryLeft}>
                  <div style={styles.summaryMain}>Буфер стейблкоинов</div>
                  <div style={styles.summarySub}>
                    запас на покрытие и докупки
                  </div>
                </div>
                <div style={styles.summaryRight}>
                  <div style={styles.summaryValue}>~18%</div>
                  <div style={{ ...styles.summaryHint, color: UI.yellow }}>
                    ниже комфортного уровня
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.healthRow}>
              <span style={styles.healthLabel}>Индекс здоровья AI</span>
              <div style={styles.healthTrack}>
                <div style={styles.healthFill} />
              </div>
              <span style={styles.healthValue}>82/100</span>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Сценарии управления риском</div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionSubText}>
                Как действовать сегодня, на неделе и в горизонте месяца.
              </div>

              <div style={styles.aiProgressList}>
                <div style={styles.aiProgressItem}>
                  <div style={styles.aiProgressTitle}>Сегодня</div>
                  <div style={styles.aiProgressLine}>
                    <div
                      style={{
                        ...styles.aiProgressFill,
                        width: `${scenarioConfig.bar1}%`,
                        background:
                          "linear-gradient(90deg, rgba(100,217,123,0.95), rgba(100,217,123,0.30))",
                      }}
                    />
                  </div>
                </div>

                <div style={styles.aiProgressItem}>
                  <div style={styles.aiProgressTitle}>Неделя</div>
                  <div style={styles.aiProgressLine}>
                    <div
                      style={{
                        ...styles.aiProgressFill,
                        width: `${scenarioConfig.bar2}%`,
                        background:
                          "linear-gradient(90deg, rgba(41,121,255,0.95), rgba(41,121,255,0.30))",
                      }}
                    />
                  </div>
                </div>

                <div style={styles.aiProgressItem}>
                  <div style={styles.aiProgressTitle}>Месяц</div>
                  <div style={styles.aiProgressLine}>
                    <div
                      style={{
                        ...styles.aiProgressFill,
                        width: `${scenarioConfig.bar3}%`,
                        background:
                          "linear-gradient(90deg, rgba(155,140,255,0.95), rgba(155,140,255,0.30))",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={styles.chipsRow}>
                <Chip
                  text="Сегодня"
                  active={scenario === "today"}
                  onClick={() => setScenario("today")}
                />
                <Chip
                  text="Неделя"
                  active={scenario === "week"}
                  onClick={() => setScenario("week")}
                />
                <Chip
                  text="Месяц"
                  active={scenario === "month"}
                  onClick={() => setScenario("month")}
                />
              </div>

              <div style={styles.aiDetailText}>{scenarioConfig.detail}</div>

              <div style={styles.tableWrap}>
                <div style={styles.tableHeader}>
                  <span>Фокус</span>
                  <span>PnL</span>
                  <span>Риск</span>
                </div>

                {scenarioConfig.rows.map((row) => (
                  <div key={row.focus} style={styles.tableRow}>
                    <span>{row.focus}</span>
                    <span>{row.pnl}</span>
                    <span>{row.risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(3, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Распределение капитала</div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionSubText}>
                Целевые доли по группам активов с точки зрения AI.
              </div>

              <div style={styles.chipsRow}>
                <Chip
                  text="Сбалансированный"
                  active={portfolioMode === "balanced"}
                  onClick={() => setPortfolioMode("balanced")}
                />
                <Chip
                  text="Защитный"
                  active={portfolioMode === "defensive"}
                  onClick={() => setPortfolioMode("defensive")}
                />
                <Chip
                  text="Агрессивный"
                  active={portfolioMode === "aggressive"}
                  onClick={() => setPortfolioMode("aggressive")}
                />
              </div>

              <div style={styles.allocList}>
                {allocationConfig.rows.map((row) => (
                  <div key={row.title} style={styles.allocRow}>
                    <div style={styles.allocLeft}>
                      <div style={styles.allocMain}>{row.title}</div>
                      <div style={styles.allocSub}>{row.sub}</div>
                    </div>

                    <div style={styles.allocRight}>
                      <div style={styles.allocValue}>
                        цель:{" "}
                        <span style={{ color: row.targetColor }}>{row.target}</span>
                      </div>
                      <div style={styles.allocHint}>сейчас {row.current}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.aiDetailText}>{allocationConfig.text}</div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(4, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Чек-лист AI</div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionSubText}>
                Шаги на ближайшее время для выравнивания риска и удержания профита.
              </div>

              <div style={styles.checkList}>
                {checklist.map((item, index) => (
                  <div key={`${item.text}-${index}`} style={styles.checkItem}>
                    <span
                      style={{
                        ...styles.checkDot,
                        background:
                          item.tone === "ok"
                            ? UI.green
                            : item.tone === "warn"
                            ? UI.yellow
                            : UI.red,
                      }}
                    />
                    <span style={styles.checkText}>{item.text}</span>
                  </div>
                ))}
              </div>

              <div style={styles.aiDetailText}>
                Чек-лист будет обновляться от реальных данных аккаунта после подключения AI API.
              </div>
            </div>
          </section>

          <section style={{ ...styles.block, ...reveal(5, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Базовая настройка AI</div>
            </div>

            <div style={styles.card}>
              <div style={styles.configGrid}>
                <ConfigItem
                  label="Статус подключения"
                  value="Подготовка"
                  color={UI.yellow}
                  sub="Дизайн готов, API подключим следующим этапом"
                />
                <ConfigItem
                  label="AI provider"
                  value="Gemini"
                  color={UI.blue}
                  sub="Можно подключить ваш платный API"
                />
                <ConfigItem
                  label="Режим ответа"
                  value="Консервативный"
                  color={UI.green}
                  sub="Только практичные и понятные рекомендации"
                />
              </div>

              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => router.replace("/home")}
              >
                Вернуться на home
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Chip(props: {
  text: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        ...styles.chip,
        ...(props.active ? styles.chipActive : null),
      }}
    >
      {props.text}
    </button>
  );
}

function ConfigItem(props: {
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <div style={styles.configItem}>
      <div style={styles.configLabel}>{props.label}</div>
      <div style={{ ...styles.configValue, color: props.color }}>{props.value}</div>
      <div style={styles.configSub}>{props.sub}</div>
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
    textAlign: "center",
    fontSize: 18,
    fontWeight: 800,
    color: UI.textMain,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,

  topSpacer: {
    width: 44,
    height: 44,
  } satisfies CSSProperties,

  heroCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 22,
    border: `1px solid ${UI.borderHard}`,
    background:
      "linear-gradient(180deg, rgba(41,121,255,0.09) 0%, rgba(255,255,255,0.025) 100%)",
  } satisfies CSSProperties,

  block: {
    paddingBottom: 20,
    borderBottom: `1px solid ${UI.borderSoft}`,
    marginBottom: 20,
  } satisfies CSSProperties,

  card: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
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
    marginBottom: 8,
  } satisfies CSSProperties,

  sectionSubText: {
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textMuted,
    marginBottom: 12,
  } satisfies CSSProperties,

  summaryGrid: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    padding: "10px 0",
    borderBottom: `1px solid ${UI.borderSoft}`,
  } satisfies CSSProperties,

  summaryLeft: {
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,

  summaryRight: {
    textAlign: "right",
    flexShrink: 0,
  } satisfies CSSProperties,

  summaryMain: {
    fontSize: 13,
    fontWeight: 700,
    color: UI.textMain,
  } satisfies CSSProperties,

  summarySub: {
    marginTop: 3,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.4,
  } satisfies CSSProperties,

  summaryValue: {
    fontSize: 12,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  summaryHint: {
    marginTop: 3,
    fontSize: 11,
    color: UI.textFaint,
  } satisfies CSSProperties,

  healthRow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,

  healthLabel: {
    fontSize: 11,
    color: UI.textSoft,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  healthTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
  } satisfies CSSProperties,

  healthFill: {
    width: "82%",
    height: "100%",
    background:
      "linear-gradient(90deg, rgba(41,121,255,0.35) 0%, rgba(41,121,255,1) 100%)",
  } satisfies CSSProperties,

  healthValue: {
    fontSize: 11,
    fontWeight: 800,
    color: UI.textMain,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  aiProgressList: {
    display: "grid",
    gap: 10,
    marginBottom: 12,
  } satisfies CSSProperties,

  aiProgressItem: {
    display: "grid",
    gap: 5,
  } satisfies CSSProperties,

  aiProgressTitle: {
    fontSize: 11,
    color: UI.textSoft,
    fontWeight: 700,
  } satisfies CSSProperties,

  aiProgressLine: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  } satisfies CSSProperties,

  aiProgressFill: {
    height: "100%",
    borderRadius: 999,
  } satisfies CSSProperties,

  chipsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  } satisfies CSSProperties,

  chip: {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textSoft,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  chipActive: {
    background: "#fff",
    color: "#000",
    border: "1px solid #fff",
  } satisfies CSSProperties,

  aiDetailText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textSoft,
  } satisfies CSSProperties,

  tableWrap: {
    marginTop: 12,
    borderRadius: 14,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.025)",
    overflow: "hidden",
  } satisfies CSSProperties,

  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.7fr 0.7fr 0.7fr",
    gap: 8,
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 800,
    color: UI.textMain,
    background: "rgba(255,255,255,0.04)",
  } satisfies CSSProperties,

  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.7fr 0.7fr 0.7fr",
    gap: 8,
    padding: "10px 12px",
    fontSize: 11,
    color: UI.textSoft,
    borderTop: `1px solid ${UI.borderSoft}`,
  } satisfies CSSProperties,

  allocList: {
    display: "grid",
    gap: 8,
    marginTop: 2,
  } satisfies CSSProperties,

  allocRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.02)",
    padding: 12,
  } satisfies CSSProperties,

  allocLeft: {
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,

  allocRight: {
    flexShrink: 0,
    textAlign: "right",
  } satisfies CSSProperties,

  allocMain: {
    fontSize: 13,
    fontWeight: 700,
    color: UI.textMain,
  } satisfies CSSProperties,

  allocSub: {
    marginTop: 3,
    fontSize: 11,
    color: UI.textMuted,
    lineHeight: 1.4,
  } satisfies CSSProperties,

  allocValue: {
    fontSize: 12,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  allocHint: {
    marginTop: 3,
    fontSize: 11,
    color: UI.textFaint,
  } satisfies CSSProperties,

  checkList: {
    display: "grid",
    gap: 9,
  } satisfies CSSProperties,

  checkItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  } satisfies CSSProperties,

  checkDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    marginTop: 6,
    flexShrink: 0,
  } satisfies CSSProperties,

  checkText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: UI.textSoft,
  } satisfies CSSProperties,

  configGrid: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  configItem: {
    borderRadius: 14,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.02)",
    padding: 12,
  } satisfies CSSProperties,

  configLabel: {
    fontSize: 11,
    color: UI.textMuted,
    marginBottom: 6,
  } satisfies CSSProperties,

  configValue: {
    fontSize: 15,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  configSub: {
    marginTop: 6,
    fontSize: 11,
    color: UI.textFaint,
    lineHeight: 1.4,
  } satisfies CSSProperties,

  primaryButton: {
    marginTop: 14,
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,
};