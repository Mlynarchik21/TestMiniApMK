"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type KeyRow = {
  id: string;
  exchange: "BINANCE" | "BYBIT" | "OKX";
  label: string | null;
};

const UI = {
  border: "rgba(255,255,255,0.12)",
  textMain: "#fff",
  textMuted: "rgba(255,255,255,0.6)",
  blue: "#8eb2ff",
  green: "#64d97b",
  red: "#ff6a6a",
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json().catch(() => ({ ok: false }));
  return { json };
}

export default function Page() {
  const router = useRouter();

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [config, setConfig] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  async function load() {
    setLoading(true);

    const [k, b] = await Promise.all([
      api("/api/keys"),
      api("/api/bot"),
    ]);

    if (k.json.ok) setKeys(k.json.keys || []);
    if (b.json.ok) {
      setConfig(b.json.config);
      setSelectedKeyId(b.json.config?.keyId || "");
    }

    setLoading(false);
  }

  async function save() {
    if (!selectedKeyId) return;

    const key = keys.find((k) => k.id === selectedKeyId);

    await api("/api/bot", {
      method: "PATCH",
      body: JSON.stringify({
        exchange: key?.exchange,
        keyId: selectedKeyId,
      }),
    });

    await load();
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
      updateLayout();

      tg?.onEvent?.("fullscreen_changed", updateLayout);
    } catch {}
  }, []);

  const activeKey = keys.find((k) => k.id === config?.keyId);

  return (
    <main style={{ ...styles.page, paddingTop: pagePaddingTop }}>
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.topBar}>
          <button onClick={() => router.replace("/bot")} style={styles.backBtn}>
            ←
          </button>

          <div style={styles.title}>Конфигурация бота</div>
        </div>

        {/* ACTIVE API */}
        <div style={styles.card}>
          <div style={styles.label}>Активный API</div>
          <div style={styles.value}>
            {activeKey
              ? `${activeKey.exchange} · ${activeKey.label || ""}`
              : "Не выбран"}
          </div>
        </div>

        {/* SELECT */}
        <div style={styles.card}>
          <div style={styles.label}>Выбор API</div>

          <select
            value={selectedKeyId}
            onChange={(e) => setSelectedKeyId(e.target.value)}
            style={styles.input}
          >
            <option value="">Выбери API</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.exchange} · {k.label || ""}
              </option>
            ))}
          </select>

          <button onClick={save} style={styles.primary}>
            Сохранить
          </button>
        </div>

        {loading && <div style={styles.loading}>Загрузка...</div>}
      </div>
    </main>
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
  } satisfies CSSProperties,

  title: {
    fontSize: 18,
    fontWeight: 800,
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
  } satisfies CSSProperties,

  value: {
    fontSize: 16,
    fontWeight: 800,
    marginTop: 4,
  } satisfies CSSProperties,

  input: {
    width: "100%",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    background: "#000",
    border: `1px solid ${UI.border}`,
    color: "#fff",
  } satisfies CSSProperties,

  primary: {
    marginTop: 10,
    width: "100%",
    padding: 12,
    borderRadius: 14,
    background: "#2979ff",
    color: "#fff",
    fontWeight: 800,
  } satisfies CSSProperties,

  loading: {
    textAlign: "center",
    marginTop: 20,
    opacity: 0.6,
  } satisfies CSSProperties,
};