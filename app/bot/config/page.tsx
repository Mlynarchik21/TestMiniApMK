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

export default function Page() {
  const router = useRouter();

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [config, setConfig] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [keysRes, botRes] = await Promise.all([
        api("/api/keys"),
        api("/api/bot"),
      ]);

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

    const r = await api("/api/bot/clear-history", { method: "POST" });

    if (!r.json.ok) setErr(humanizeError(r.json));
    else setMsg("История очищена");
  }

  async function forceClose() {
    if (!confirm("Закрыть всё и удалить историю?")) return;

    const r = await api("/api/bot/force-close", { method: "POST" });

    if (!r.json.ok) setErr(humanizeError(r.json));
    else setMsg("Все сделки закрыты");
  }

  async function deleteKey(id: string) {
    if (!confirm("Удалить API?")) return;

    const r = await api(`/api/keys/${id}`, { method: "DELETE" });

    if (!r.json.ok) setErr(humanizeError(r.json));
    else {
      setMsg("Удалено");
      await load();
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeKey = useMemo(
    () => keys.find((k) => k.id === config?.keyId),
    [keys, config]
  );

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={() => router.replace("/bot")} style={styles.back}>
            ←
          </button>
          <div style={styles.title}>Настройки бота</div>
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
          >
            <option value="">Выбери</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.exchange} · {getDisplayLabel(k)}
              </option>
            ))}
          </select>

          <button onClick={save} style={styles.btn}>
            {saving ? "..." : "Сохранить"}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>Мои API</div>

          {keys.map((k) => {
            const active = config?.keyId === k.id;

            return (
              <div key={k.id} style={styles.apiRow}>
                <div>
                  <b>{k.exchange}</b>{" "}
                  {isDemoKey(k) && <span style={styles.demo}>DEMO</span>}
                  <div>{getDisplayLabel(k)}</div>
                </div>

                <div>
                  <div style={{ color: active ? "#4ade80" : "#aaa" }}>
                    {active ? "Активный" : "Не активный"}
                  </div>

                  <button onClick={() => deleteKey(k.id)} style={styles.del}>
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.card}>
          <button onClick={clearHistory} style={styles.warn}>
            Очистить историю
          </button>

          <button onClick={forceClose} style={styles.danger}>
            Закрыть всё и очистить
          </button>
        </div>

        {msg && <div style={{ color: "#4ade80" }}>{msg}</div>}
        {err && <div style={{ color: "#f87171" }}>{err}</div>}

        {loading && <div>Загрузка...</div>}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    padding: 16,
  },
  container: { maxWidth: 500, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  back: { borderRadius: 20, padding: "6px 10px" },
  title: { fontWeight: 900, fontSize: 20 },

  card: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  label: { opacity: 0.6, fontSize: 12 },
  value: { fontWeight: 800, fontSize: 16 },

  input: {
    width: "100%",
    marginTop: 8,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    background: "#111",
    color: "#fff",
  },

  btn: {
    width: "100%",
    padding: 10,
    borderRadius: 999,
    background: "#fff",
    color: "#000",
    fontWeight: 900,
  },

  apiRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
    borderTop: "1px solid rgba(255,255,255,0.1)",
    paddingTop: 10,
  },

  demo: {
    marginLeft: 6,
    color: "#60a5fa",
  },

  del: {
    marginTop: 6,
    fontSize: 12,
    color: "#f87171",
  },

  warn: {
    width: "100%",
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
  },

  danger: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    background: "#f87171",
  },
};