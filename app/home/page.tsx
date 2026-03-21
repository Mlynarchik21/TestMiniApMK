"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
        {/* HERO */}
        <section style={styles.hero}>
          <div>
            <div style={styles.label}>Рын. капитализация</div>

            <div style={styles.valueRow}>
              <span style={styles.value}>2.48</span>
              <span style={styles.unit}>T USDT</span>
            </div>

            <div style={styles.delta}>
              <span style={styles.deltaLabel}>Изменение за день</span>
              <span style={styles.deltaRed}>-0.76%</span>
            </div>
          </div>

          <div style={styles.divider} />

          <div>
            <div style={styles.sentimentRow}>
              <div>
                <div style={styles.sentimentTitle}>Жадность и страх</div>
                <div style={styles.sentimentSub}>Рыночное настроение</div>
              </div>

              <div style={styles.badge}>11%</div>
            </div>

            <div style={styles.track}>
              <div style={styles.fill(11)} />
            </div>
          </div>

          <button
            style={styles.primaryBtn}
            onClick={() => router.replace("/profile")}
          >
            Профиль
          </button>
        </section>

        {/* FEAR */}
        <section style={styles.card}>
          <div style={styles.cardLabel}>FEAR & GREED</div>

          <div style={styles.row}>
            <div>
              <div style={{ ...styles.big, color: "#ff5a5a" }}>23</div>
              <div style={styles.sub}>Extreme Fear</div>
            </div>

            <div style={styles.miniTrack}>
              <div style={{ ...styles.miniFill, width: "23%" }} />
            </div>
          </div>
        </section>

        {/* BTC DOM */}
        <section style={styles.card}>
          <div style={styles.cardLabel}>BTC DOMINANCE</div>

          <div style={styles.row}>
            <div>
              <div style={{ ...styles.big, color: "#f5a33a" }}>56.5%</div>
              <div style={styles.sub}>Лидерство BTC</div>
            </div>

            <div style={styles.ringWrap}>
              <div style={styles.ring} />
              <div style={styles.ringText}>56.5%</div>
            </div>
          </div>
        </section>

        {/* LONG SHORT */}
        <section style={styles.card}>
          <div style={styles.cardLabel}>BTC LONG / SHORT</div>

          <div style={styles.split}>
            <div style={styles.long} />
            <div style={styles.short} />
          </div>

          <div style={styles.splitText}>
            <span style={{ color: "#64d97b" }}>61.4%</span>
            <span style={{ color: "#ff6a6a" }}>38.6%</span>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#f3f3f3",
    fontFamily: "Inter, system-ui",
    paddingTop: "calc(env(safe-area-inset-top) + 72px)",
    paddingBottom: 24,
  } as React.CSSProperties,

  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  hero: {
    background: "#070707",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  } as React.CSSProperties,

  label: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 6,
  },

  valueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  },

  value: {
    fontSize: 44,
    fontWeight: 800,
    letterSpacing: "-0.05em",
  },

  unit: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
  },

  delta: {
    marginTop: 12,
    display: "flex",
    gap: 6,
  },

  deltaLabel: {
    color: "rgba(255,255,255,0.6)",
  },

  deltaRed: {
    color: "#ff5a5a",
    fontWeight: 700,
  },

  divider: {
    height: 1,
    background: "rgba(255,255,255,0.06)",
    margin: "16px 0",
  },

  sentimentRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sentimentTitle: {
    fontSize: 14,
    fontWeight: 700,
  },

  sentimentSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },

  badge: {
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,90,90,0.1)",
    border: "1px solid rgba(255,90,90,0.2)",
    color: "#ff6a6a",
    fontWeight: 700,
  },

  track: {
    height: 10,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(99,27,27,0.4), rgba(91,71,20,0.4), rgba(13,58,35,0.4))",
    overflow: "hidden",
  },

  fill: (p: number): React.CSSProperties => ({
    width: `${p}%`,
    height: "100%",
    background: "#ff5a5a",
  }),

  primaryBtn: {
    marginTop: 16,
    width: "100%",
    height: 48,
    borderRadius: 999,
    background: "#377cff",
    border: "none",
    color: "#fff",
    fontWeight: 700,
  },

  card: {
    background: "#080808",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },

  cardLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 10,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  big: {
    fontSize: 32,
    fontWeight: 800,
  },

  sub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },

  miniTrack: {
    width: 100,
    height: 8,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 999,
  },

  miniFill: {
    height: "100%",
    background: "#ff5a5a",
    borderRadius: 999,
  },

  ringWrap: {
    width: 70,
    height: 70,
    position: "relative",
  },

  ring: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(#f5a33a 0 56.5%, rgba(255,255,255,0.1) 56.5% 100%)",
  },

  ringText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
  },

  split: {
    height: 14,
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",
    background: "rgba(255,255,255,0.1)",
  },

  long: {
    width: "61.4%",
    background: "#64d97b",
  },

  short: {
    width: "38.6%",
    background: "#ff6a6a",
  },

  splitText: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 8,
    fontWeight: 700,
  },
};