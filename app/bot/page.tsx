"use client";

import { useEffect, useState } from "react";
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

export default function BotPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<AnyResp | null>(null);

  async function loadBot() {
    setLoading(true);
    setStatus(null);

    const token = getToken();

    try {
      const res = await fetch("/api/bot", {
        method: "GET",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = (await res.json()) as AnyResp;
      setStatus(res.status);
      setResult(data);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBot();
  }, []);

  const bot = result && result.ok ? result.bot : null;
  const config = bot?.config ?? null;
  const state = bot?.state ?? null;
  const positions = Array.isArray(bot?.positions) ? bot.positions : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={() => router.replace("/home")} style={btnGhost()}>
            Home
          </button>
          <button onClick={loadBot} disabled={loading} style={btnPrimary(loading)}>
            {loading ? "..." : "Обновить"}
          </button>
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Bot</div>

        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 14 }}>
          <div>
            <b>HTTP статус:</b> {status ?? "—"}
          </div>
        </div>

        <section style={card()}>
          <div style={sectionTitle()}>Состояние</div>

          <div style={row()}>
            <span style={label()}>Статус</span>
            <span>{state?.status ?? "STOPPED"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Включен</span>
            <span>{config?.enabled ? "YES" : "NO"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Последняя синхронизация</span>
            <span>{state?.lastSyncAt ?? "—"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Последняя ошибка</span>
            <span>{state?.lastError ?? "—"}</span>
          </div>
        </section>

        <section style={card()}>
          <div style={sectionTitle()}>Конфиг</div>

          <div style={row()}>
            <span style={label()}>Биржа</span>
            <span>{config?.exchange ?? "—"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Key ID</span>
            <span>{config?.keyId ?? "—"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Макс. активных монет</span>
            <span>{config?.maxActiveSymbols ?? "—"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Бюджет на монету</span>
            <span>{config?.budgetPerSymbol ?? "—"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Шаг сетки %</span>
            <span>{config?.gridStepPct ?? "—"}</span>
          </div>

          <div style={row()}>
            <span style={label()}>Take Profit %</span>
            <span>{config?.takeProfitPct ?? "—"}</span>
          </div>
        </section>

        <section style={card()}>
          <div style={sectionTitle()}>Активные позиции</div>

          {positions.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Пока пусто</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {positions.map((p: any) => (
                <div key={p.id} style={positionCard()}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{p.symbol}</div>
                  <div style={smallRow()}>
                    <span style={label()}>Статус</span>
                    <span>{p.status}</span>
                  </div>
                  <div style={smallRow()}>
                    <span style={label()}>Qty</span>
                    <span>{p.qty}</span>
                  </div>
                  <div style={smallRow()}>
                    <span style={label()}>Avg Price</span>
                    <span>{p.avgPrice}</span>
                  </div>
                  <div style={smallRow()}>
                    <span style={label()}>TP Price</span>
                    <span>{p.tpPrice}</span>
                  </div>
                  <div style={smallRow()}>
                    <span style={label()}>Adds Count</span>
                    <span>{p.addsCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={card()}>
          <div style={sectionTitle()}>Raw JSON</div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              background: "#111",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              minHeight: 160,
            }}
          >
            {result ? JSON.stringify(result, null, 2) : "—"}
          </div>
        </section>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    background: "#0f0f0f",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 12,
  };
}

function row(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
}

function smallRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "4px 0",
  };
}

function label(): React.CSSProperties {
  return {
    opacity: 0.7,
  };
}

function positionCard(): React.CSSProperties {
  return {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}
