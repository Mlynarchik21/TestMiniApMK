"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string };

type KeyRow = {
  id: string;
  exchange: "BINANCE" | "BYBIT" | "OKX";
  label: string | null;
};

const UI = {
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.09)",
  borderHard: "rgba(255,255,255,0.16)",
  textMain: "#fff",
  textSoft: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.6)",
  textFaint: "rgba(255,255,255,0.42)",
  blue: "#8eb2ff",
  green: "#64d97b",
  red: "#ff6a6a",
  brand: "#2979ff",
  yellow: "#f3d709",
};

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api(path: string, init?: RequestInit) {
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

  const json = await res.json().catch(() => ({
    ok: false,
    error: "BAD_RESPONSE",
  }));

  return { status: res.status, json };
}

function humanizeError(r: AnyResp) {
  if (!r || (r as any).ok) return "";
  return `${r.error}${r.message ? ": " + r.message : ""}`;
}

function hasWord(label: string | null | undefined, word: string) {
  return new RegExp(word, "i").test(label || "");
}

function getDisplayLabel(key: KeyRow) {
  const raw = (key.label || "").trim();
  return raw.replace(/\[demo\]\s*/i, "").replace(/\[testnet\]\s*/i, "");
}

function isDemoKey(key: KeyRow) {
  return hasWord(key.label, "demo");
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Page() {
  const router = useRouter();

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [config, setConfig] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<"" | "clear" | "force" | "delete">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  async function load() {
    setLoading(true);
    try {
      const [keysRes, botRes] = await Promise.all([api("/api/keys"), api("/api/bot")]);

      if (keysRes.json.ok) setKeys((keysRes.json as any).keys || []);
      if (botRes.json.ok) {
        setConfig((botRes.json as any).config);
        setSelectedKeyId((botRes.json as any).config?.keyId || "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selectedKeyId) return;

    setSaving(true);
    setMsg("");
    setErr("");

    try {
      const key = keys.find((k) => k.id === selectedKeyId);

      const r = await api("/api/bot", {
        method: "PATCH",
        body: JSON.stringify({
          exchange: key?.exchange,
          keyId: selectedKeyId,
        }),
      });

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      setMsg("Сохранено");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function clearHistory() {
    if (!confirm("Очистить историю?")) return;

    setActionLoading("clear");
    setMsg("");
    setErr("");

    try {
      const r = await api("/api/bot/clear-history", { method: "POST" });

      if (!r.json.ok) setErr(humanizeError(r.json));
      else setMsg("История очищена");
    } finally {
      setActionLoading("");
    }
  }

  async function forceClose() {
    if (!confirm("Закрыть всё и удалить историю?")) return;

    setActionLoading("force");
    setMsg("");
    setErr("");

    try {
      const r = await api("/api/bot/force-close", { method: "POST" });

      if (!r.json.ok) setErr(humanizeError(r.json));
      else setMsg("Все сделки закрыты");
    } finally {
      setActionLoading("");
    }
  }

  async function deleteKey(id: string) {
    if (!confirm("Удалить API?")) return;

    setActionLoading("delete");
    setMsg("");
    setErr("");

    try {
      const r = await api(`/api/keys/${id}`, { method: "DELETE" });

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
      } else {
        setMsg("Удалено");
        await load();
      }
    } finally {
      setActionLoading("");
    }
  }

  useEffect(() => {
    load();

    const tg = (window as any)?.Telegram?.WebApp;

    const updateLayout = () => {
      if (tg?.isFullscreen) {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 88px)");
      } else {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 15px)");
      }
    };

    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#000000");
      tg?.setBackgroundColor?.("#000000");
      updateLayout();
      tg?.onEvent?.("fullscreen_changed", updateLayout);
    } catch {}
  }, []);

  const activeKey = useMemo(
    () => keys.find((k) => k.id === config?.keyId),
    [keys, config]
  );

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #000;
          overflow-x: hidden;
        }

        select,
        input,
        button,
        textarea {
          font: inherit;
        }
      `}</style>

      <main style={{ ...styles.page, paddingTop: pagePaddingTop }}>
        <div style={styles.container}>
          <div style={styles.topBar}>
            <button onClick={() => router.replace("/bot")} style={styles.backBtn}>
              <ArrowLeftIcon />
            </button>

            <div style={styles.title}>Конфигурация бота</div>
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Активный API</div>
            <div style={styles.value}>
              {activeKey
                ? `${activeKey.exchange} · ${getDisplayLabel(activeKey)}`
                : "Не выбран"}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Выбор API</div>

            <select
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              style={styles.input}
              disabled={loading || saving}
            >
              <option value="">Выбери API</option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.exchange} · {getDisplayLabel(k)}
                </option>
              ))}
            </select>

            <button
              onClick={save}
              style={{
                ...styles.primary,
                opacity: saving || !selectedKeyId ? 0.7 : 1,
                cursor: saving || !selectedKeyId ? "not-allowed" : "pointer",
              }}
              disabled={saving || !selectedKeyId}
            >
              {saving ? "Сохраняю..." : "Сохранить"}
            </button>
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Мои API</div>

            {!keys.length ? (
              <div style={styles.emptyText}>Нет сохранённых API.</div>
            ) : (
              <div style={styles.apiList}>
                {keys.map((k) => {
                  const active = config?.keyId === k.id;

                  return (
                    <div key={k.id} style={styles.apiRow}>
                      <div style={styles.apiLeft}>
                        <div style={styles.apiTopLine}>
                          <span style={styles.apiExchange}>{k.exchange}</span>
                          {isDemoKey(k) ? <span style={styles.demo}>DEMO</span> : null}
                        </div>

                        <div style={styles.apiLabelText}>{getDisplayLabel(k)}</div>
                      </div>

                      <div style={styles.apiRight}>
                        <div
                          style={{
                            ...styles.statusText,
                            color: active ? UI.green : UI.textMuted,
                          }}
                        >
                          {active ? "Активный" : "Не активный"}
                        </div>

                        <button
                          onClick={() => deleteKey(k.id)}
                          style={styles.del}
                          disabled={actionLoading === "delete"}
                        >
                          {actionLoading === "delete" ? "..." : "Удалить"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Сервисные действия</div>

            <button
              onClick={clearHistory}
              style={styles.warn}
              disabled={actionLoading === "clear" || actionLoading === "force"}
            >
              {actionLoading === "clear" ? "Очищаю..." : "Очистить историю"}
            </button>

            <button
              onClick={forceClose}
              style={styles.danger}
              disabled={actionLoading === "clear" || actionLoading === "force"}
            >
              {actionLoading === "force"
                ? "Выполняю..."
                : "Закрыть всё и очистить"}
            </button>
          </div>

          {msg ? <div style={styles.successText}>{msg}</div> : null}
          {err ? <div style={styles.errorText}>{err}</div> : null}

          {loading ? <div style={styles.loading}>Загрузка...</div> : null}
        </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
  } satisfies CSSProperties,

  container: {
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
  } satisfies CSSProperties,

  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  } satisfies CSSProperties,

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  } satisfies CSSProperties,

  title: {
    fontSize: 18,
    fontWeight: 800,
    color: UI.textMain,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,

  card: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    background: "rgba(255,255,255,0.03)",
  } satisfies CSSProperties,

  label: {
    fontSize: 12,
    color: UI.textMuted,
    marginBottom: 8,
  } satisfies CSSProperties,

  value: {
    fontSize: 16,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1.35,
  } satisfies CSSProperties,

  input: {
    width: "100%",
    marginTop: 2,
    marginBottom: 10,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#000",
    border: `1px solid ${UI.border}`,
    color: "#fff",
    outline: "none",
  } satisfies CSSProperties,

  primary: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    background: UI.brand,
    color: "#fff",
    fontWeight: 800,
    border: "none",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  apiList: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  apiRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 10,
    borderTop: "1px solid rgba(255,255,255,0.1)",
  } satisfies CSSProperties,

  apiLeft: {
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,

  apiTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  } satisfies CSSProperties,

  apiExchange: {
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  apiLabelText: {
    fontSize: 14,
    color: UI.textSoft,
    lineHeight: 1.35,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  apiRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
  } satisfies CSSProperties,

  statusText: {
    fontSize: 12,
    fontWeight: 700,
  } satisfies CSSProperties,

  demo: {
    display: "inline-flex",
    alignItems: "center",
    height: 22,
    padding: "0 8px",
    borderRadius: 999,
    color: UI.blue,
    background: "rgba(41,121,255,0.12)",
    border: "1px solid rgba(142,178,255,0.24)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.04em",
  } satisfies CSSProperties,

  del: {
    border: "none",
    background: "transparent",
    fontSize: 12,
    color: UI.red,
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
  } satisfies CSSProperties,

  warn: {
    width: "100%",
    marginTop: 2,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontWeight: 800,
    cursor: "pointer",
  } satisfies CSSProperties,

  danger: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.24)",
    background: "rgba(255,106,106,0.10)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  } satisfies CSSProperties,

  successText: {
    marginTop: 4,
    marginBottom: 12,
    color: UI.green,
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
  } satisfies CSSProperties,

  errorText: {
    marginTop: 4,
    marginBottom: 12,
    color: UI.red,
    fontSize: 13,
    lineHeight: 1.5,
    textAlign: "center",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  loading: {
    textAlign: "center",
    marginTop: 20,
    opacity: 0.6,
    color: UI.textMuted,
    fontSize: 13,
  } satisfies CSSProperties,

  emptyText: {
    fontSize: 13,
    color: UI.textMuted,
    lineHeight: 1.5,
  } satisfies CSSProperties,
} satisfies Record<string, CSSProperties>;