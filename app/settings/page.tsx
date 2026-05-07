"use client";

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";
import type { ThemeName } from "@/lib/useTheme";

type Settings = {
  timezone: string;
  theme: "dark" | "light";
  notifyTradeOpen: boolean;
  notifyTradeClose: boolean;
  notifyBotStop: boolean;
  notifyBotError: boolean;
  notifySubscription: boolean;
};

const DEFAULT: Settings = {
  timezone: "UTC",
  theme: "dark",
  notifyTradeOpen: true,
  notifyTradeClose: true,
  notifyBotStop: true,
  notifyBotError: true,
  notifySubscription: true,
};

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

async function api(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, {
    cache: "no-store", ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return res.json().catch(() => ({ ok: false, error: "BAD_JSON" }));
}

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" />
    </svg>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 26, borderRadius: 999, border: "none",
        background: on ? "#2979ff" : "rgba(128,128,128,0.25)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: 999, background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { T, theme: currentTheme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [pagePaddingTop, setPagePaddingTop] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api("/api/settings");
      if (json.ok) setSettings({ ...DEFAULT, ...(json.settings ?? {}) });
    } finally { setLoading(false); }
  }, []);

  async function save(patch?: Partial<Settings>) {
    const data = patch ?? settings;
    setSaving(true); setMsg("");
    try {
      const json = await api("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
      if (json.ok) {
        setSettings((s) => ({ ...s, ...(json.settings ?? {}) }));
        setMsg("Сохранено"); setMsgOk(true);
        setTimeout(() => setMsg(""), 2500);
      } else {
        setMsg(json.extra?.message || json.error || "Ошибка"); setMsgOk(false);
      }
    } catch (e: any) { setMsg(e?.message ?? "Ошибка"); setMsgOk(false); }
    finally { setSaving(false); }
  }

  async function toggleBool(field: keyof Settings) {
    const val = !settings[field];
    const updated = { ...settings, [field]: val };
    setSettings(updated);
    await save({ [field]: val });
  }

  function handleTheme(t: ThemeName) {
    setSettings((s) => ({ ...s, theme: t }));
    setTheme(t);
    save({ theme: t });
  }

  useEffect(() => {
    load();
    const tg = (window as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.(); tg?.expand?.();
      tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000");
      if (tg?.isFullscreen) setPagePaddingTop("calc(env(safe-area-inset-top,0px) + 88px)");
    } catch {}
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [load]);

  function reveal(i: number): CSSProperties {
    return mounted
      ? { opacity: 1, animationName: "fadeUp", animationDuration: "560ms", animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)", animationFillMode: "both", animationDelay: `${i * 60}ms` }
      : { opacity: 0, transform: "translate3d(0,14px,0)" };
  }

  const font = 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
  const block: CSSProperties = { padding: 16, borderRadius: 22, border: `1px solid ${T.border}`, background: `linear-gradient(180deg,${T.card} 0%,rgba(255,255,255,0.02) 100%)`, marginBottom: 16 };
  const row: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.borderSoft}` };
  const rowLast: CSSProperties = { ...row, borderBottom: "none" };

  const isBool = (f: keyof Settings) => settings[f] as boolean;
  const isDark = settings.theme === "dark";

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:${T.bg};overflow-x:hidden}
        select,input,button,textarea{font:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font, paddingBottom: "calc(env(safe-area-inset-bottom,0px)+32px)", paddingTop: pagePaddingTop }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <section style={{ ...reveal(0), marginBottom: 22, display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={() => router.replace("/home")} style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${T.borderHard}`, background: T.card, color: T.textMain, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: T.textMain }}>Настройки</div>
            <div />
          </section>

          {loading ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: "40px 0" }}>Загрузка…</div>
          ) : (
            <>
              {/* Theme */}
              <section style={{ ...reveal(1), ...block }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textMain }}>
                      {isDark ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
                    </div>
                    <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>
                      {isDark ? "Переключить на светлую" : "Переключить на тёмную"}
                    </div>
                  </div>
                  <Toggle
                    on={isDark}
                    onChange={(v) => handleTheme(v ? "dark" : "light")}
                  />
                </div>
              </section>

              {/* General */}
              <section style={{ ...reveal(2), ...block }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Основные</div>

                <div style={{ ...rowLast }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.textMain }}>Часовой пояс</div>
                    <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>Для отображения дат и времени</div>
                  </div>
                  <input
                    value={settings.timezone}
                    onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                    placeholder="UTC"
                    disabled={saving}
                    style={{ width: 100, height: 36, borderRadius: 10, border: `1px solid ${T.borderHard}`, background: T.surface, color: T.textMain, padding: "0 10px", fontSize: 13, outline: "none", textAlign: "center" }}
                  />
                </div>
              </section>

              {/* Notifications */}
              <section style={{ ...reveal(3), ...block }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Уведомления Telegram</div>
                <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 14 }}>Что отправлять в ваш Telegram</div>

                {([
                  ["notifyTradeOpen", "Открытие позиции"],
                  ["notifyTradeClose", "Закрытие позиции"],
                  ["notifyBotStop", "Остановка бота"],
                  ["notifyBotError", "Ошибки бота"],
                  ["notifySubscription", "Подписка / система"],
                ] as [keyof Settings, string][]).map(([field, label], i, arr) => (
                  <div key={field} style={i === arr.length - 1 ? rowLast : row}>
                    <div style={{ fontSize: 14, color: T.textMain }}>{label}</div>
                    <Toggle on={isBool(field)} onChange={() => toggleBool(field)} disabled={saving} />
                  </div>
                ))}
              </section>

              {/* Save button */}
              <section style={{ ...reveal(4), marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => save()}
                  disabled={saving}
                  style={{ width: "100%", height: 50, borderRadius: 999, border: "none", background: T.brand, color: "#fff", fontSize: 16, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, WebkitTapHighlightColor: "transparent" }}
                >
                  {saving ? "Сохраняю…" : "Сохранить"}
                </button>
                {msg && (
                  <div style={{ textAlign: "center", fontSize: 13, marginTop: 10, color: msgOk ? T.green : T.red }}>{msg}</div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
