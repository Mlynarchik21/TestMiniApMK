"use client";

import { useEffect, useState } from "react";

type AnyResp = { ok: true; [k: string]: any } | { ok: false; error: string; [k: string]: any };

export default function KeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [out, setOut] = useState<AnyResp | null>(null);

  const [exchange, setExchange] = useState("binance");
  const [label, setLabel] = useState("Main");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  async function refresh() {
    const r = await fetch("/api/keys", { cache: "no-store" });
    const j = (await r.json()) as AnyResp;
    setOut(j);
    if (j.ok) setKeys(j.keys || []);
  }

  async function createKey() {
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exchange, label, apiKey, apiSecret, passphrase }),
    });
    const j = (await r.json()) as AnyResp;
    setOut(j);
    if (j.ok) {
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
      await refresh();
    }
  }

  async function delKey(id: string) {
    const r = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    const j = (await r.json()) as AnyResp;
    setOut(j);
    if (j.ok) await refresh();
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main style={{ minHeight: "100vh", padding: 16, background: "#000", color: "#fff" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>Exchange Keys</h1>

        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <input value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="exchange (binance/bybit/...)" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (optional)" />
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="apiKey" />
          <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="apiSecret" />
          <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="passphrase (optional)" />

          <button onClick={createKey} style={btnPrimary}>Create</button>
          <button onClick={refresh} style={btnGhost}>Refresh</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          {keys.map((k) => (
            <div key={k.id} style={{ border: "1px solid rgba(255,255,255,0.14)", padding: 12, borderRadius: 12 }}>
              <div style={{ fontWeight: 800 }}>{k.exchange} {k.label ? `— ${k.label}` : ""}</div>
              <div style={{ opacity: 0.8, fontSize: 12 }}>id: {k.id}</div>
              <button onClick={() => delKey(k.id)} style={{ ...btnGhost, marginTop: 8 }}>Delete</button>
            </div>
          ))}
        </div>

        <pre style={{ whiteSpace: "pre-wrap", background: "#111", padding: 12, borderRadius: 12 }}>
          {out ? JSON.stringify(out, null, 2) : "—"}
        </pre>
      </div>
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
