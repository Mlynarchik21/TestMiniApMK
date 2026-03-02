"use client";

import { useEffect, useState } from "react";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; [k: string]: any };

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnyResp | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string>("");

  function getToken() {
    try {
      return localStorage.getItem("sessionToken") || "";
    } catch {
      return "";
    }
  }

  async function run(path: string, init?: RequestInit) {
    setLoading(true);
    setResult(null);
    setStatus(null);

    const token = getToken();
    setTokenPreview(
      token ? `${token.slice(0, 6)}…${token.slice(-6)} (len=${token.length})` : "нет токена"
    );

    try {
      const res = await fetch(path, {
        cache: "no-store",
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setStatus(res.status);

      const data = (await res.json()) as AnyResp;
      setResult(data);
    } catch (e: any) {
      setStatus(null);
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  // /api/me
  const checkMe = () => run("/api/me", { method: "GET" });

  // /api/settings
  const getSettings = () => run("/api/settings", { method: "GET" });

  const setRiskConservative = () =>
    run("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskMode: "conservative" }),
    });

  const setRiskNormal = () =>
    run("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskMode: "normal" }),
    });

  const setRiskAggressive = () =>
    run("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskMode: "aggressive" }),
    });

  useEffect(() => {
    // автопроверка /api/me при заходе
    checkMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Home</h1>

      <div style={{ marginBottom: 12, fontSize: 14 }}>
        <div style={{ marginBottom: 6 }}>
          <b>sessionToken:</b> {tokenPreview || "—"}
        </div>
        <div style={{ marginBottom: 6 }}>
          <b>HTTP статус:</b> {status ?? "—"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <button
          onClick={checkMe}
          disabled={loading}
          style={btnStyle(loading)}
        >
          {loading ? "..." : "Проверить /api/me"}
        </button>

        <button
          onClick={getSettings}
          disabled={loading}
          style={btnStyle(loading)}
        >
          {loading ? "..." : "GET /api/settings"}
        </button>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <button
            onClick={setRiskNormal}
            disabled={loading}
            style={btnStyle(loading)}
          >
            PATCH risk=normal
          </button>
          <button
            onClick={setRiskConservative}
            disabled={loading}
            style={btnStyle(loading)}
          >
            PATCH risk=conservative
          </button>
          <button
            onClick={setRiskAggressive}
            disabled={loading}
            style={btnStyle(loading)}
          >
            PATCH risk=aggressive
          </button>
        </div>
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          background: "#f7f7f7",
          padding: 12,
          borderRadius: 10,
          minHeight: 140,
        }}
      >
        {result ? JSON.stringify(result, null, 2) : "—"}
      </div>
    </main>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: disabled ? "#f5f5f5" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
  };
}
