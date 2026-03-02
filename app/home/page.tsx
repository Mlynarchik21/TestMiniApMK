"use client";

import { useEffect, useState } from "react";

type MeOk = {
  ok: true;
  user: {
    id: string;
    tgId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt?: string;
  };
};

type MeErr = {
  ok: false;
  error: string;
};

type MeResponse = MeOk | MeErr;

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string>("");

  function getToken() {
    try {
      return localStorage.getItem("sessionToken") || "";
    } catch {
      return "";
    }
  }

  async function checkMe() {
    setLoading(true);
    setResult(null);
    setStatus(null);

    const token = getToken();
    setTokenPreview(token ? `${token.slice(0, 6)}…${token.slice(-6)} (len=${token.length})` : "нет токена");

    try {
      const res = await fetch("/api/me", {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });

      setStatus(res.status);

      const data = (await res.json()) as MeResponse;
      setResult(data);
    } catch (e: any) {
      setStatus(null);
      setResult({ ok: false, error: e?.message ?? "fetch error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Home</h1>

      <button
        onClick={checkMe}
        disabled={loading}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: loading ? "#f5f5f5" : "#fff",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 600,
        }}
      >
        {loading ? "Проверяю..." : "Проверить /api/me"}
      </button>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        <div style={{ marginBottom: 6 }}>
          <b>sessionToken:</b> {tokenPreview || "—"}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>HTTP статус:</b> {status ?? "—"}
        </div>

        <div style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 10 }}>
          {result ? JSON.stringify(result, null, 2) : "—"}
        </div>
      </div>
    </main>
  );
}
