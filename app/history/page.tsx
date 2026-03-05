"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Trade = {
  id: string;
  exchange: string;
  symbol: string;
  side: string;
  status: string;
  qty: string;
  entryPrice: string | null;
  exitPrice: string | null;
  realizedPnl: string | null;
  openedAt: string;
  closedAt: string | null;
};

export default function HistoryPage() {
  const router = useRouter();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadTrades() {
    setLoading(true);

    try {
      const token = localStorage.getItem("sessionToken");

      const res = await fetch("/api/trades", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const json = await res.json();

      if (json.ok) {
        setTrades(json.trades || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrades();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 20,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h1>Trades History</h1>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => router.push("/home")}>Home</button>
            <button onClick={() => router.push("/keys")}>Keys</button>
          </div>
        </div>

        {loading && <div>Loading...</div>}

        {!loading && trades.length === 0 && (
          <div style={{ opacity: 0.7 }}>
            Нет сделок. Следующим шагом добавим кнопку Add Trade.
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {trades.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 14,
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {t.exchange} · {t.symbol} · {t.side}
              </div>

              <div style={{ opacity: 0.8, fontSize: 14 }}>
                qty: {t.qty}
              </div>

              <div style={{ opacity: 0.8, fontSize: 14 }}>
                entry: {t.entryPrice ?? "-"} | exit: {t.exitPrice ?? "-"}
              </div>

              <div style={{ opacity: 0.6, fontSize: 12 }}>
                opened: {new Date(t.openedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
