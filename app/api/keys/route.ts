"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exchange } from "@prisma/client";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; [k: string]: any };

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api(
  path: string,
  init?: RequestInit
): Promise<{ status: number; json: AnyResp }> {
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
  const json = (await res.json()) as AnyResp;
  return { status: res.status, json };
}

export default function KeysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AnyResp | null>(null);
  const [keys, setKeys] = useState<any[]>([]);

  const [exchange, setExchange] = useState<Exchange>("BINANCE" as Exchange);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // баланс
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [balance, setBalance] = useState<any>(null);

  const tokenPreview = useMemo(() => {
    const t = getToken();
    return t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена";
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const r = await api("/api/keys", { method: "GET" });
      setResp(r.json);
      if (r.json.ok) {
        const list = r.json.keys ?? [];
        setKeys(list);

        // автоселект первого ключа
        if (!selectedKeyId && list.length) setSelectedKeyId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function addKey() {
    setLoading(true);
    try {
      const r = await api("/api/keys", {
        method: "POST",
        body: JSON.stringify({
          exchange,
          label: label || null,
          apiKey,
          apiSecret,
          passphrase: passphrase || null,
        }),
      });
      setResp(r.json);
      if (r.json.ok) {
        setApiKey("");
        setApiSecret("");
        setPassphrase("");
        await reload();
      }
    } finally {
      setLoading(false);
    }
  }

  async function delKey(id: string) {
    setLoading(true);
    try {
      const r = await api(`/api/keys/${id}`, { method: "DELETE" });
      setResp(r.json);
      await reload();
      if (selectedKeyId === id) {
        setSelectedKeyId("");
        setBalance(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance() {
    if (!selectedKeyId) return;

    setLoading(true);
    try {
      const r = await api(`/api/balance?keyId=${encodeURIComponent(selectedKeyId)}`, {
        method: "GET",
      });
      setResp(r.json);
      if (r.json.ok) setBalance(r.json.balance);
      else setBalance(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedKey = keys.find((k) => k.id === selectedKeyId);

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
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>API Keys</div>
          <button onClick={() => router.replace("/home")} style={btnGhost()}>
            Home
          </button>
        </div>

        <div style={{ opacity: 0.85, fontSize: 13 }}>
          <b>sessionToken:</b> {tokenPreview}
        </div>

        {/* ✅ БАЛАНС */}
        <div style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Balance check</div>
            <button disabled={loading || !selectedKeyId} onClick={refreshBalance} style={btnPrimarySmall(loading)}>
              {loading ? "..." : "Обновить баланс"}
            </button>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <select
              value={selectedKeyId}
              onChange={(e) => {
                setSelectedKeyId(e.target.value);
                setBalance(null);
              }}
              style={input()}
            >
              <option value="">— выбери ключ —</option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.exchange} {k.label ? `· ${k.label}` : ""} ({k.id.slice(0, 6)}…)
                </option>
              ))}
            </select>

            <div style={{ opacity: 0.8, fontSize: 13 }}>
              <b>Selected:</b>{" "}
              {selectedKey ? `${selectedKey.exchange}${selectedKey.label ? ` · ${selectedKey.label}` : ""}` : "—"}
            </div>

            <div style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
              {balance ? (
                <>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    {balance.exchange} / {balance.accountType}
                  </div>

                  {Array.isArray(balance.nonZero) && balance.nonZero.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {balance.nonZero.slice(0, 25).map((b: any) => (
                        <div
                          key={b.asset}
                          style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.92 }}
                        >
                          <span style={{ fontWeight: 800 }}>{b.asset}</span>
                          <span>
                            free: {b.free}{" "}
                            {Number(b.locked) > 0 ? <span style={{ opacity: 0.8 }}> / locked: {b.locked}</span> : null}
                          </span>
                        </div>
                      ))}
                      {balance.nonZero.length > 25 && (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>… ещё {balance.nonZero.length - 25}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.75 }}>Баланс нулевой (nonZero пустой)</div>
                  )}
                </>
              ) : (
                <div style={{ opacity: 0.75 }}>
                  Нажми <b>«Обновить баланс»</b> — если ключ рабочий, ты увидишь активы.
                  <div style={{ opacity: 0.65, marginTop: 6 }}>
                    Сейчас реализовано: <b>BINANCE SPOT</b>.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add key */}
        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Add key</div>

          <div style={{ display: "grid", gap: 8 }}>
            <select value={exchange} onChange={(e) => setExchange(e.target.value as Exchange)} style={input()}>
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>

            <input placeholder="label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} style={input()} />
            <input placeholder="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={input()} />
            <input placeholder="apiSecret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} style={input()} />
            <input placeholder="passphrase (OKX optional)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} style={input()} />

            <button disabled={loading} onClick={addKey} style={btnPrimary(loading)}>
              {loading ? "..." : "Save"}
            </button>
          </div>
        </div>

        {/* List keys */}
        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Your keys</div>
          <div style={{ display: "grid", gap: 8 }}>
            {keys.map((k) => (
              <div
                key={k.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div style={{ display: "grid" }}>
                  <div style={{ fontWeight: 800 }}>
                    {k.exchange} {k.label ? `· ${k.label}` : ""}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{k.id}</div>
                </div>
                <button disabled={loading} onClick={() => delKey(k.id)} style={btnDanger()}>
                  Delete
                </button>
              </div>
            ))}
            {!keys.length && <div style={{ opacity: 0.7 }}>No keys yet</div>}
          </div>
        </div>

        {/* Debug */}
        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Last response</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{resp ? JSON.stringify(resp, null, 2) : "—"}</pre>
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

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
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

function btnPrimarySmall(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
    whiteSpace: "nowrap",
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
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}
