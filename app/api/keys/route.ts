"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AnyResp = { ok: true; [k: string]: any } | { ok: false; error: string; message?: string; [k: string]: any };

type KeyRow = {
  id: string;
  exchange: "BINANCE" | "BYBIT" | "OKX";
  label: string | null;
  createdAt: string;
  updatedAt: string;
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

  const json = (await res.json().catch(() => ({ ok: false, error: "BAD_JSON" }))) as AnyResp;
  return { status: res.status, json };
}

export default function KeysPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<AnyResp | null>(null);

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [exchange, setExchange] = useState<"BINANCE" | "BYBIT" | "OKX">("BINANCE");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // balance UI
  const [balLoading, setBalLoading] = useState(false);
  const [balance, setBalance] = useState<any>(null);
  const [balError, setBalError] = useState<string>("");

  const selectedLabel = useMemo(() => {
    const v = label.trim();
    return v.length ? v : null;
  }, [label]);

  async function loadKeys() {
    setLoading(true);
    setLast(null);
    try {
      const { json } = await api("/api/keys", { method: "GET" });
      setLast(json);
      if (json.ok) setKeys(Array.isArray((json as any).keys) ? (json as any).keys : []);
    } finally {
      setLoading(false);
    }
  }

  async function saveKey() {
    setLoading(true);
    setLast(null);
    setBalError("");
    try {
      const body: any = {
        exchange,
        label: selectedLabel,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        passphrase: passphrase.trim() || null,
      };

      const { json } = await api("/api/keys", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setLast(json);

      if (json.ok) {
        // обновим список
        await loadKeys();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteKey(id: string) {
    setLoading(true);
    setLast(null);
    try {
      const { json } = await api(`/api/keys/${id}`, { method: "DELETE" });
      setLast(json);
      await loadKeys();
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance() {
    setBalLoading(true);
    setBalError("");
    setBalance(null);

    try {
      const qs = new URLSearchParams();
      qs.set("exchange", exchange);
      if (selectedLabel) qs.set("label", selectedLabel);

      const token = getToken();
      const res = await fetch(`/api/balance?${qs.toString()}`, {
        cache: "no-store",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const j = await res.json().catch(() => null);
      if (!j || typeof j !== "object") {
        setBalError("Bad server response");
        return;
      }

      if (!j.ok) {
        setBalError(j.message || j.error || "Balance error");
        return;
      }

      setBalance(j);
    } catch (e: any) {
      setBalError(e?.message ?? String(e));
    } finally {
      setBalLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={page}>
      <div style={wrap}>
        <div style={topRow}>
          <div style={h1}>API Keys</div>
          <button style={ghostBtn} onClick={() => router.replace("/home")} disabled={loading}>
            Home
          </button>
        </div>

        <div style={card}>
          <div style={h2}>Add key</div>

          <label style={lbl}>Exchange</label>
          <select style={inp} value={exchange} onChange={(e) => setExchange(e.target.value as any)} disabled={loading}>
            <option value="BINANCE">BINANCE</option>
            <option value="BYBIT">BYBIT</option>
            <option value="OKX">OKX</option>
          </select>

          <label style={lbl}>label (optional)</label>
          <input style={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main" disabled={loading} />

          <label style={lbl}>apiKey</label>
          <textarea style={ta} value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={loading} />

          <label style={lbl}>apiSecret</label>
          <textarea style={ta} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} disabled={loading} />

          <label style={lbl}>passphrase (OKX optional)</label>
          <input style={inp} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} disabled={loading} />

          <button style={primaryBtn(loading)} onClick={saveKey} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>

        <div style={card}>
          <div style={rowBetween}>
            <div style={h2}>Balance</div>
            <button style={ghostBtn} onClick={refreshBalance} disabled={balLoading}>
              {balLoading ? "Обновляем..." : "Обновить баланс"}
            </button>
          </div>

          <div style={muted}>
            Сейчас реализован BINANCE SPOT. Выбери exchange/label выше и нажми “Обновить баланс”.
          </div>

          {balError ? (
            <div style={errBox}>{balError}</div>
          ) : balance ? (
            <div style={pre}>
              {Array.isArray(balance.balances) && balance.balances.length ? (
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    {balance.exchange} {balance.label ? `(${balance.label})` : ""}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {balance.balances.map((b: any) => (
                      <div key={b.asset} style={balRow}>
                        <div style={{ fontWeight: 800 }}>{b.asset}</div>
                        <div style={{ opacity: 0.9 }}>
                          free: {b.free} / locked: {b.locked}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>Баланс пустой (все 0)</div>
              )}
            </div>
          ) : (
            <div style={muted}>Пока нет данных. Нажми “Обновить баланс”.</div>
          )}
        </div>

        <div style={card}>
          <div style={rowBetween}>
            <div style={h2}>Your keys</div>
            <button style={ghostBtn} onClick={loadKeys} disabled={loading}>
              {loading ? "..." : "Refresh list"}
            </button>
          </div>

          {!keys.length ? (
            <div style={muted}>No keys yet</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {keys.map((k) => (
                <div key={k.id} style={keyRow}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{k.exchange}</div>
                    <div style={mutedSmall}>
                      label: {k.label ?? "—"} · id: {k.id.slice(0, 6)}…{k.id.slice(-6)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={ghostBtn}
                      onClick={() => {
                        setExchange(k.exchange);
                        setLabel(k.label ?? "");
                      }}
                      disabled={loading}
                    >
                      Use
                    </button>

                    <button style={dangerBtn} onClick={() => deleteKey(k.id)} disabled={loading}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={h2}>Last response</div>
          <div style={pre}>{last ? JSON.stringify(last, null, 2) : "—"}</div>
        </div>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
  padding: 16,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

const wrap: React.CSSProperties = { maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 };
const topRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const rowBetween: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };

const card: React.CSSProperties = {
  background: "#0b0b0b",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  padding: 14,
};

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 900 };
const h2: React.CSSProperties = { fontSize: 14, fontWeight: 900, marginBottom: 10 };

const lbl: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginTop: 10, display: "block" };
const inp: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "#111",
  color: "#fff",
  outline: "none",
};

const ta: React.CSSProperties = { ...inp, minHeight: 70, resize: "vertical" };

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.85 : 1,
});

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  ...ghostBtn,
  border: "1px solid rgba(255,90,90,0.45)",
  color: "#ff7b7b",
};

const muted: React.CSSProperties = { opacity: 0.75, fontSize: 12, marginBottom: 10 };
const mutedSmall: React.CSSProperties = { opacity: 0.7, fontSize: 12 };

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  background: "#0f0f0f",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  padding: 12,
  minHeight: 60,
};

const keyRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0f0f0f",
};

const balRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0b0b0b",
};

const errBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,90,90,0.35)",
  background: "rgba(255,90,90,0.08)",
  color: "#ffb3b3",
  whiteSpace: "pre-wrap",
};
