"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type KeyRow = {
  id: string;
  exchange: "BINANCE" | "BYBIT" | "OKX";
  label: string | null;
  apiKeyMasked: string;
  createdAt: string;
  updatedAt: string;
};

type ListResp = { ok: true; keys: KeyRow[] } | { ok: false; error: string };
type CreateResp = { ok: true; key: KeyRow } | { ok: false; error: string };
type DeleteResp = { ok: true } | { ok: false; error: string };

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; json: T }> {
  const token = getToken();
  const res = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = (await res.json()) as T;
  return { status: res.status, json };
}

export default function KeysPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const [keys, setKeys] = useState<KeyRow[]>([]);

  const [exchange, setExchange] = useState<"BINANCE" | "BYBIT" | "OKX">("BINANCE");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const tokenPreview = useMemo(() => {
    const t = getToken();
    return t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена";
  }, []);

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const { status, json } = await api<ListResp>("/api/keys", { method: "GET" });
      setStatus(status);

      if ((json as any)?.ok === false) {
        setMsg((json as any)?.error || "ERROR");
        return;
      }

      setKeys((json as any).keys || []);
    } catch (e: any) {
      setMsg(e?.message ?? "fetch error");
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    setSaving(true);
    setMsg("");
    try {
      const { status, json } = await api<CreateResp>("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange,
          label: label.trim() || null,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          passphrase: passphrase.trim() || null,
        }),
      });

      setStatus(status);

      if ((json as any)?.ok === false) {
        setMsg((json as any)?.error || "ERROR");
        return;
      }

      setMsg("Сохранено ✅");
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
      setLabel("");

      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "fetch error");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Удалить ключ?")) return;

    setSaving(true);
    setMsg("");
    try {
      const { status, json } = await api<DeleteResp>(`/api/keys/${id}`, { method: "DELETE" });
      setStatus(status);

      if ((json as any)?.ok === false) {
        setMsg((json as any)?.error || "ERROR");
        return;
      }

      setMsg("Удалено ✅");
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "fetch error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ minHeight: "100vh", padding: 16, background: "#000", color: "#fff", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={() => router.replace("/home")} style={btnGhost()} disabled={saving}>
            ← Home
          </button>
          <div style={{ fontSize: 20, fontWeight: 900 }}>API Keys</div>
        </div>

        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
          <div><b>sessionToken:</b> {tokenPreview}</div>
          <div><b>HTTP статус:</b> {status ?? "—"}</div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Добавить ключ</div>

          <label style={labelStyle()}>
            Exchange
            <select value={exchange} onChange={(e) => setExchange(e.target.value as any)} style={input()} disabled={loading || saving}>
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>
          </label>

          <label style={labelStyle()}>
            Label (опционально)
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={input()} disabled={loading || saving} placeholder="Main" />
          </label>

          <label style={labelStyle()}>
            API Key
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={input()} disabled={loading || saving} />
          </label>

          <label style={labelStyle()}>
            API Secret
            <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} style={input()} disabled={loading || saving} />
          </label>

          {exchange === "OKX" && (
            <label style={labelStyle()}>
              Passphrase (OKX)
              <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} style={input()} disabled={loading || saving} />
            </label>
          )}

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <button onClick={createKey} style={btnPrimary()} disabled={loading || saving}>
              {saving ? "Сохраняю…" : "Сохранить ключ"}
            </button>
            <button onClick={load} style={btnGhost()} disabled={loading || saving}>
              Обновить список
            </button>
            {msg && <div style={{ fontSize: 13, opacity: 0.9, textAlign: "center" }}>{msg}</div>}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Ваши ключи</div>

          {keys.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Пока нет ключей.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {keys.map((k) => (
                <div key={k.id} style={row()}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>
                      {k.exchange} {k.label ? `— ${k.label}` : ""}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>apiKey: {k.apiKeyMasked}</div>
                    <div style={{ opacity: 0.6, fontSize: 12 }}>updatedAt: {k.updatedAt}</div>
                  </div>
                  <button onClick={() => del(k.id)} style={danger()} disabled={saving}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return { background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 14 };
}
function row(): React.CSSProperties {
  return {
    background: "#0b0b0b",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };
}
function labelStyle(): React.CSSProperties {
  return { display: "grid", gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 12 };
}
function input(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#0a0a0a",
    color: "#fff",
    padding: "10px 12px",
    outline: "none",
    fontSize: 14,
  };
}
function btnPrimary(): React.CSSProperties {
  return { width: "100%", padding: "12px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "#fff", color: "#000", fontWeight: 900, cursor: "pointer" };
}
function btnGhost(): React.CSSProperties {
  return { width: "100%", padding: "12px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", fontWeight: 900, cursor: "pointer" };
}
function danger(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#ff6b6b", fontWeight: 900, cursor: "pointer" };
}
