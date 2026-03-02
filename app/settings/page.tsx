"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  timezone: string;
  currency: string;
  riskMode: "normal" | "conservative" | "aggressive";
  createdAt?: string;
  updatedAt?: string;
};

type ApiOk = { ok: true; settings: Settings };
type ApiFail = { ok: false; error: string };
type ApiResp = ApiOk | ApiFail;

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

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<number | null>(null);
  const [msg, setMsg] = useState<string>("");

  const [settings, setSettings] = useState<Settings>({
    timezone: "UTC",
    currency: "USD",
    riskMode: "normal",
  });

  const tokenPreview = useMemo(() => {
    const t = getToken();
    return t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена";
  }, []);

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const { status, json } = await api<ApiResp>("/api/settings", { method: "GET" });
      setStatus(status);

      if (!json || typeof json !== "object") {
        setMsg("Некорректный ответ сервера");
        return;
      }

      if ((json as ApiFail).ok === false) {
        const err = (json as ApiFail).error || "ERROR";
        setMsg(err);
        return;
      }

      setSettings((json as ApiOk).settings);
    } catch (e: any) {
      setMsg(e?.message ?? "fetch error");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const { status, json } = await api<ApiResp>("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: settings.timezone,
          currency: settings.currency,
          riskMode: settings.riskMode,
        }),
      });

      setStatus(status);

      if ((json as ApiFail).ok === false) {
        setMsg((json as ApiFail).error || "ERROR");
        return;
      }

      setSettings((json as ApiOk).settings);
      setMsg("Сохранено ✅");
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
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button
            onClick={() => router.replace("/home")}
            style={btnGhost()}
            disabled={saving}
          >
            ← Home
          </button>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Settings</div>
        </div>

        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
          <div>
            <b>sessionToken:</b> {tokenPreview}
          </div>
          <div>
            <b>HTTP статус:</b> {status ?? "—"}
          </div>
        </div>

        <div style={card()}>
          <label style={label()}>
            Timezone
            <input
              value={settings.timezone}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
              placeholder="UTC"
              style={input()}
              disabled={loading || saving}
            />
          </label>

          <label style={label()}>
            Currency
            <select
              value={settings.currency}
              onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
              style={input()}
              disabled={loading || saving}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UAH">UAH</option>
              <option value="RUB">RUB</option>
            </select>
          </label>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Risk mode</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <button
                onClick={() => setSettings((s) => ({ ...s, riskMode: "normal" }))}
                style={pill(settings.riskMode === "normal")}
                disabled={loading || saving}
              >
                normal
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, riskMode: "conservative" }))}
                style={pill(settings.riskMode === "conservative")}
                disabled={loading || saving}
              >
                conservative
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, riskMode: "aggressive" }))}
                style={pill(settings.riskMode === "aggressive")}
                disabled={loading || saving}
              >
                aggressive
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <button onClick={save} style={btnPrimary()} disabled={loading || saving}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>

            <button onClick={load} style={btnGhost()} disabled={loading || saving}>
              Обновить
            </button>

            {msg && (
              <div style={{ fontSize: 13, opacity: 0.9, textAlign: "center" }}>{msg}</div>
            )}
          </div>
        </div>

        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 12, textAlign: "center" }}>
          createdAt: {settings.createdAt ?? "—"} <br />
          updatedAt: {settings.updatedAt ?? "—"}
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

function label(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
  };
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
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
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

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: active ? "#fff" : "transparent",
    color: active ? "#000" : "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}
