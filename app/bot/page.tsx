"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type KeyRow = {
  id: string;
  exchange: string;
  label: string | null;
};

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api(path: string, init?: RequestInit): Promise<{ status: number; json: AnyResp }> {
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

  let json: AnyResp = { ok: false, error: "BAD_RESPONSE", message: "Invalid JSON response" };
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

export default function BotPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AnyResp | null>(null);
  const [err, setErr] = useState("");

  const [keys, setKeys] = useState<KeyRow[]>([]);

  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);

  const [exchange, setExchange] = useState("BINANCE");
  const [keyId, setKeyId] = useState("");
  const [maxActiveSymbols, setMaxActiveSymbols] = useState("10");
  const [budgetPerSymbol, setBudgetPerSymbol] = useState("50");
  const [maxTotalBudget, setMaxTotalBudget] = useState("");
  const [syncIntervalMin, setSyncIntervalMin] = useState("5");

  async function loadKeys() {
    const r = await api("/api/keys", { method: "GET" });
    if (r.json.ok) {
      setKeys(((r.json as any).keys ?? []) as KeyRow[]);
    }
  }

  async function loadBot() {
    setLoading(true);
    setErr("");
    try {
      const r = await api("/api/bot", { method: "GET" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      const c = (r.json as any).config ?? null;
      const s = (r.json as any).state ?? null;
      const p = (r.json as any).positions ?? [];

      setConfig(c);
      setState(s);
      setPositions(p);

      if (c) {
        setExchange(c.exchange ?? "BINANCE");
        setKeyId(c.keyId ?? "");
        setMaxActiveSymbols(String(c.maxActiveSymbols ?? 10));
        setBudgetPerSymbol(String(c.budgetPerSymbol ?? "50"));
        setMaxTotalBudget(c.maxTotalBudget != null ? String(c.maxTotalBudget) : "");
        setSyncIntervalMin(String(c.syncIntervalMin ?? 5));
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setLoading(true);
    setErr("");
    try {
      const body: any = {
        exchange,
        keyId: keyId || null,
        maxActiveSymbols: Number(maxActiveSymbols),
        budgetPerSymbol,
        syncIntervalMin: Number(syncIntervalMin),
      };

      if (maxTotalBudget.trim()) {
        body.maxTotalBudget = maxTotalBudget.trim();
      } else {
        body.maxTotalBudget = null;
      }

      const r = await api("/api/bot", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await loadBot();
    } finally {
      setLoading(false);
    }
  }

  async function startBot() {
    setLoading(true);
    setErr("");
    try {
      const r = await api("/api/bot/start", { method: "POST" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await loadBot();
    } finally {
      setLoading(false);
    }
  }

  async function stopBot() {
    setLoading(true);
    setErr("");
    try {
      const r = await api("/api/bot/stop", { method: "POST" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      await loadBot();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
    loadBot();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Bot</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.replace("/home")} style={btnGhost()}>
              Home
            </button>
            <button onClick={() => router.replace("/history")} style={btnGhost()}>
              History
            </button>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Bot status</div>

          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              <b>Config enabled:</b> {config?.enabled ? "YES" : "NO"}
            </div>
            <div>
              <b>Run status:</b> {state?.status ?? "IDLE"}
            </div>
            <div>
              <b>Last sync:</b> {state?.lastSyncAt ?? "—"}
            </div>
            <div>
              <b>Last error:</b> {state?.lastError ?? "—"}
            </div>
            <div>
              <b>Active positions:</b> {positions.length}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button disabled={loading} onClick={startBot} style={btnPrimary(loading)}>
              {loading ? "..." : "Start bot"}
            </button>
            <button disabled={loading} onClick={stopBot} style={btnDanger()}>
              Stop bot
            </button>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Bot config</div>

          <div style={{ display: "grid", gap: 8 }}>
            <select value={exchange} onChange={(e) => setExchange(e.target.value)} style={input()}>
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>

            <select value={keyId} onChange={(e) => setKeyId(e.target.value)} style={input()}>
              <option value="">Select API key</option>
              {keys
                .filter((k) => k.exchange === exchange)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.exchange} {k.label ? `· ${k.label}` : `· ${k.id.slice(0, 8)}`}
                  </option>
                ))}
            </select>

            <input
              value={maxActiveSymbols}
              onChange={(e) => setMaxActiveSymbols(e.target.value)}
              placeholder="maxActiveSymbols (1..10)"
              style={input()}
            />

            <input
              value={budgetPerSymbol}
              onChange={(e) => setBudgetPerSymbol(e.target.value)}
              placeholder="budgetPerSymbol"
              style={input()}
            />

            <input
              value={maxTotalBudget}
              onChange={(e) => setMaxTotalBudget(e.target.value)}
              placeholder="maxTotalBudget (optional)"
              style={input()}
            />

            <input
              value={syncIntervalMin}
              onChange={(e) => setSyncIntervalMin(e.target.value)}
              placeholder="syncIntervalMin (1..60)"
              style={input()}
            />

            <button disabled={loading} onClick={saveConfig} style={btnPrimary(loading)}>
              {loading ? "..." : "Save config"}
            </button>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Active positions</div>

          {!positions.length ? (
            <div style={{ opacity: 0.7 }}>Пока пусто. Trading Engine ещё не подключён.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {positions.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {p.exchange} · {p.symbol} · {p.status}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    avgPrice: {p.avgPrice} · qty: {p.qty} · tpPrice: {p.tpPrice}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    addsCount: {p.addsCount} · openedAt: {p.openedAt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && (
          <div style={errorBox()}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Ошибка</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{err}</pre>
          </div>
        )}

        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Last response</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {resp ? JSON.stringify(resp, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#000",
    color: "#fff",
    outline: "none",
  };
}

function errorBox(): React.CSSProperties {
  return {
    background: "rgba(255,0,0,0.08)",
    border: "1px solid rgba(255,0,0,0.25)",
    borderRadius: 12,
    padding: 10,
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
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnDanger(): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}