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
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<AnyResp | null>(null);
  const [keys, setKeys] = useState<any[]>([]);

  const [exchange, setExchange] = useState("BINANCE");
  const [keyId, setKeyId] = useState("");
  const [maxActiveSymbols, setMaxActiveSymbols] = useState("10");
  const [budgetPerSymbol, setBudgetPerSymbol] = useState("100");
  const [gridStepPct, setGridStepPct] = useState("5");
  const [takeProfitPct, setTakeProfitPct] = useState("5");

  async function loadKeys() {
    const token = getToken();

    try {
      const res = await fetch("/api/keys", {
        method: "GET",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();
      const list = Array.isArray(data?.keys) ? data.keys : [];
      setKeys(list);

      if (!keyId) {
        const firstForExchange = list.find((k: any) => k.exchange === exchange);
        if (firstForExchange?.id) {
          setKeyId(firstForExchange.id);
        }
      }
    } catch {
      setKeys([]);
    }
  }

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

      const config = data && data.ok ? data.bot?.config : null;
      if (config) {
        setExchange(config.exchange ?? "BINANCE");
        setKeyId(config.keyId ?? "");
        setMaxActiveSymbols(String(config.maxActiveSymbols ?? 10));
        setBudgetPerSymbol(String(config.budgetPerSymbol ?? 100));
        setGridStepPct(String(config.gridStepPct ?? 5));
        setTakeProfitPct(String(config.takeProfitPct ?? 5));
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  async function initBot() {
    setSaving(true);

    const token = getToken();

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange,
          keyId,
          maxActiveSymbols: Number(maxActiveSymbols),
          budgetPerSymbol: Number(budgetPerSymbol),
          gridStepPct: Number(gridStepPct),
          takeProfitPct: Number(takeProfitPct),
        }),
      });

      const data = (await res.json()) as AnyResp;
      setStatus(res.status);
      setResult(data);

      if (data.ok) {
        await loadBot();
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setSaving(false);
    }
  }

  async function changeBotState(action: "start" | "stop") {
    setSwitching(true);

    const token = getToken();

    try {
      const res = await fetch("/api/bot", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json()) as AnyResp;
      setStatus(res.status);
      setResult(data);

      if (data.ok) {
        await loadBot();
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setSwitching(false);
    }
  }

  useEffect(() => {
    loadBot();
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const firstForExchange = keys.find((k: any) => k.exchange === exchange);
    if (firstForExchange?.id) {
      setKeyId(firstForExchange.id);
    } else {
      setKeyId("");
    }
  }, [exchange, keys]);

  const bot = result && result.ok ? result.bot : null;
  const config = bot?.config ?? null;
  const state = bot?.state ?? null;
  const positions = Array.isArray(bot?.positions) ? bot.positions : [];
  const filteredKeys = keys.filter((k: any) => k.exchange === exchange);
  const isEnabled = !!config?.enabled;

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
          <div style={sectionTitle()}>Управление ботом</div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => changeBotState("start")}
              disabled={!config || switching || isEnabled}
              style={btnPrimary(!config || switching || isEnabled)}
            >
              {switching ? "..." : "Start"}
            </button>

            <button
              onClick={() => changeBotState("stop")}
              disabled={!config || switching || !isEnabled}
              style={btnGhostDisabled(!config || switching || !isEnabled)}
            >
              {switching ? "..." : "Stop"}
            </button>
          </div>

          {!config ? (
            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 10 }}>
              Сначала создай конфиг бота ниже.
            </div>
          ) : null}
        </section>

        <section style={card()}>
          <div style={sectionTitle()}>
            {config ? "Редактирование бота" : "Создать бота"}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={fieldWrap()}>
              <span style={fieldLabel()}>Биржа</span>
              <select value={exchange} onChange={(e) => setExchange(e.target.value)} style={input()}>
                <option value="BINANCE">BINANCE</option>
                <option value="BYBIT">BYBIT</option>
                <option value="OKX">OKX</option>
              </select>
            </label>

            <label style={fieldWrap()}>
              <span style={fieldLabel()}>Ключ</span>
              <select value={keyId} onChange={(e) => setKeyId(e.target.value)} style={input()}>
                <option value="">Выбери ключ</option>
                {filteredKeys.map((k: any) => (
                  <option key={k.id} value={k.id}>
                    {k.label ? `${k.label} (${k.exchange})` : `${k.exchange} / ${k.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldWrap()}>
              <span style={fieldLabel()}>Макс. активных монет</span>
              <input
                value={maxActiveSymbols}
                onChange={(e) => setMaxActiveSymbols(e.target.value)}
                inputMode="numeric"
                style={input()}
                placeholder="10"
              />
            </label>

            <label style={fieldWrap()}>
              <span style={fieldLabel()}>Бюджет на монету</span>
              <input
                value={budgetPerSymbol}
                onChange={(e) => setBudgetPerSymbol(e.target.value)}
                inputMode="decimal"
                style={input()}
                placeholder="100"
              />
            </label>

            <label style={fieldWrap()}>
              <span style={fieldLabel()}>Шаг сетки %</span>
              <input
                value={gridStepPct}
                onChange={(e) => setGridStepPct(e.target.value)}
                inputMode="decimal"
                style={input()}
                placeholder="5"
              />
            </label>

            <label style={fieldWrap()}>
              <span style={fieldLabel()}>Take Profit %</span>
              <input
                value={takeProfitPct}
                onChange={(e) => setTakeProfitPct(e.target.value)}
                inputMode="decimal"
                style={input()}
                placeholder="5"
              />
            </label>

            <button onClick={initBot} disabled={saving || !keyId} style={btnPrimary(saving || !keyId)}>
              {saving ? "..." : config ? "Сохранить конфиг" : "Создать бота"}
            </button>

            {!keyId ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Сначала добавь API ключ на странице Keys и выбери его здесь.
              </div>
            ) : null}
          </div>
        </section>

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

function fieldWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
  };
}

function fieldLabel(): React.CSSProperties {
  return {
    fontSize: 13,
    opacity: 0.85,
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#000",
    color: "#fff",
    outline: "none",
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    width: "100%",
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
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnGhostDisabled(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
