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

  // баланс по keyId
  const [balancesByKey, setBalancesByKey] = useState<Record<string, any[]>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>(
    {}
  );

  const [exchange, setExchange] = useState<Exchange>("BINANCE" as Exchange);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const tokenPreview = useMemo(() => {
    const t = getToken();
    return t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена";
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const r = await api("/api/keys", { method: "GET" });
      setResp(r.json);
      if (r.json.ok) setKeys(r.json.keys ?? []);
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
      // чистим баланс в UI
      setBalancesByKey((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      await reload();
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance(keyId: string) {
    setBalanceLoading((m) => ({ ...m, [keyId]: true }));
    try {
      const r = await api(`/api/balance?keyId=${encodeURIComponent(keyId)}`, {
        method: "GET",
      });
      setResp(r.json);

      if (r.json.ok) {
        setBalancesByKey((m) => ({ ...m, [keyId]: r.json.balances ?? [] }));
      }
    } finally {
      setBalanceLoading((m) => ({ ...m, [keyId]: false }));
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>API Keys</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={loading} onClick={reload} style={btnGhost()}>
              Обновить список
            </button>
            <button onClick={() => router.replace("/home")} style={btnGhost()}>
              Home
            </button>
          </div>
        </div>

        <div style={{ opacity: 0.85, fontSize: 13 }}>
          <b>sessionToken:</b> {tokenPreview}
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Add key</div>

          <div style={{ display: "grid", gap: 8 }}>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as Exchange)}
              style={input()}
            >
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>

            <input
              placeholder="label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={input()}
            />
            <input
              placeholder="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={input()}
            />
            <input
              placeholder="apiSecret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              style={input()}
            />
            <input
              placeholder="passphrase (OKX optional)"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              style={input()}
            />

            <button disabled={loading} onClick={addKey} style={btnPrimary(loading)}>
              {loading ? "..." : "Save"}
            </button>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Your keys</div>

          <div style={{ display: "grid", gap: 10 }}>
            {keys.map((k) => {
              const b = balancesByKey[k.id] || [];
              const bl = !!balanceLoading[k.id];

              return (
                <div
                  key={k.id}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "grid" }}>
                      <div style={{ fontWeight: 900 }}>
                        {k.exchange} {k.label ? `· ${k.label}` : ""}
                      </div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{k.id}</div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={loading || bl}
                        onClick={() => refreshBalance(k.id)}
                        style={btnGhost()}
                      >
                        {bl ? "..." : "Обновить баланс"}
                      </button>
                      <button disabled={loading} onClick={() => delKey(k.id)} style={btnDanger()}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800 }}>Баланс (Spot)</div>
                    {!b.length ? (
                      <div style={{ opacity: 0.7, fontSize: 13 }}>
                        Нажми “Обновить баланс” — если ключ рабочий, тут появятся монеты.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        {b.slice(0, 20).map((x: any) => (
                          <div
                            key={x.asset}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.10)",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{x.asset}</div>
                            <div style={{ opacity: 0.9 }}>
                              free: {x.free} · locked: {x.locked}
                            </div>
                          </div>
                        ))}
                        {b.length > 20 && (
                          <div style={{ opacity: 0.7, fontSize: 12 }}>
                            Показано 20 из {b.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!keys.length && <div style={{ opacity: 0.7 }}>No keys yet</div>}
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Last response</div>
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