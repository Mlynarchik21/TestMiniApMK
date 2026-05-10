"use client";

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, type ThemeName } from "@/lib/useTheme";
import { PageShell } from "@/lib/ui/PageShell";
import { Header } from "@/lib/ui/Header";
import { Card, CardTitle } from "@/lib/ui/Card";
import { Button } from "@/lib/ui/Button";
import { Toggle } from "@/lib/ui/Toggle";
import { Reveal, RevealStack } from "@/lib/ui/Reveal";
import { SkeletonStack } from "@/lib/ui/Skeleton";
import { Sun, Moon, Globe, CheckCircle2, AlertTriangle } from "@/lib/ui/icons";

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

export default function SettingsPage() {
  const { T, theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api("/api/settings");
      if (json.ok) setSettings({ ...DEFAULT, ...(json.settings ?? {}) });
    } finally { setLoading(false); }
  }, []);

  async function save(patch?: Partial<Settings>) {
    const data = patch ?? settings;
    setSaving(true);
    setMsg(null);
    try {
      const json = await api("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
      if (json.ok) {
        setSettings((s) => ({ ...s, ...(json.settings ?? {}) }));
        setMsg({ text: "Сохранено", ok: true });
        setTimeout(() => setMsg(null), 2200);
      } else {
        setMsg({ text: json.extra?.message || json.error || "Ошибка", ok: false });
      }
    } catch (e: any) {
      setMsg({ text: e?.message ?? "Ошибка", ok: false });
    } finally { setSaving(false); }
  }

  async function toggleBool(field: keyof Settings) {
    const val = !settings[field];
    setSettings((s) => ({ ...s, [field]: val }));
    await save({ [field]: val });
  }

  function handleTheme(t: ThemeName) {
    setSettings((s) => ({ ...s, theme: t }));
    setTheme(t);
    save({ theme: t });
  }

  useEffect(() => { load(); }, [load]);

  const isDark = theme === "dark";

  return (
    <PageShell withNav={false}>
      <Header title="Настройки" back="/home" />

      <RevealStack childDelay={0.05} style={{ display: "grid", gap: 14, marginTop: 8 }}>
        {loading ? (
          <Reveal>
            <Card padding={16}><SkeletonStack count={3} /></Card>
          </Reveal>
        ) : (
          <>
            {/* Theme */}
            <Reveal>
              <Card padding={16}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: T.card, border: `1px solid ${T.borderSoft}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isDark ? T.blue : T.yellow,
                    }}
                  >
                    {isDark ? <Moon size={20} strokeWidth={1.6} /> : <Sun size={20} strokeWidth={1.6} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textMain }}>
                      {isDark ? "Тёмная тема" : "Светлая тема"}
                    </div>
                    <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>
                      {isDark ? "Переключить на светлую" : "Переключить на тёмную"}
                    </div>
                  </div>
                  <Toggle on={isDark} onChange={(v) => handleTheme(v ? "dark" : "light")} ariaLabel="Тема" />
                </div>
              </Card>
            </Reveal>

            {/* General */}
            <Reveal>
              <Card padding={16}>
                <CardTitle>Основные</CardTitle>
                <div style={rowStyle(T, true)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Globe size={16} strokeWidth={1.6} style={{ color: T.textMuted }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.textMain }}>Часовой пояс</div>
                      <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>Для отображения дат и времени</div>
                    </div>
                  </div>
                  <input
                    value={settings.timezone}
                    onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                    placeholder="UTC"
                    disabled={saving}
                    style={{
                      width: 110, height: 38, borderRadius: 10,
                      border: `1px solid ${T.borderHard}`,
                      background: T.surface, color: T.textMain,
                      padding: "0 12px", fontSize: 13, outline: "none",
                      textAlign: "center",
                      transition: "border-color 160ms",
                    }}
                  />
                </div>
              </Card>
            </Reveal>

            {/* Notifications */}
            <Reveal>
              <Card padding={16}>
                <CardTitle>Уведомления Telegram</CardTitle>
                <div style={{ fontSize: 12, color: T.textFaint, marginTop: -8, marginBottom: 12 }}>
                  Что отправлять в ваш Telegram
                </div>

                {([
                  ["notifyTradeOpen", "Открытие позиции"],
                  ["notifyTradeClose", "Закрытие позиции"],
                  ["notifyBotStop", "Остановка бота"],
                  ["notifyBotError", "Ошибки бота"],
                  ["notifySubscription", "Подписка / система"],
                ] as [keyof Settings, string][]).map(([field, label], i, arr) => (
                  <div key={field} style={rowStyle(T, i === arr.length - 1)}>
                    <div style={{ fontSize: 14, color: T.textMain }}>{label}</div>
                    <Toggle on={settings[field] as boolean} onChange={() => toggleBool(field)} disabled={saving} ariaLabel={label} />
                  </div>
                ))}
              </Card>
            </Reveal>

            {/* Save */}
            <Reveal>
              <Button variant="primary" size="lg" block loading={saving} onClick={() => save()}>
                Сохранить
              </Button>
              <AnimatePresence>
                {msg && (
                  <motion.div
                    key={msg.text}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      marginTop: 10,
                      color: msg.ok ? T.green : T.red,
                      display: "inline-flex",
                      gap: 6,
                      width: "100%",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {msg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {msg.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </Reveal>
          </>
        )}
      </RevealStack>
    </PageShell>
  );
}

function rowStyle(T: ReturnType<typeof useTheme>["T"], last: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: last ? "none" : `1px solid ${T.borderSoft}`,
  };
}
