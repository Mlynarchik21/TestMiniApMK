"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { PageShell } from "@/lib/ui/PageShell";
import { Header } from "@/lib/ui/Header";
import { Card } from "@/lib/ui/Card";
import { Button } from "@/lib/ui/Button";
import { EmptyState } from "@/lib/ui/EmptyState";
import { SkeletonStack } from "@/lib/ui/Skeleton";
import { Reveal, RevealStack } from "@/lib/ui/Reveal";
import { BellOff, Trash2, CheckCircle2, AlertTriangle } from "@/lib/ui/icons";
import { haptics } from "@/lib/ui/haptics";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
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
  const json = await res.json().catch(() => ({ ok: false, error: "BAD_JSON" }));
  return { status: res.status, json };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин. назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч. назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн. назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function typeLabel(type: string) {
  if (type === "TRADE") return "Сделка";
  if (type === "BOT") return "Бот";
  if (type === "SUBSCRIPTION") return "Подписка";
  return "Система";
}

export default function NotificationsPage() {
  const { T } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { json } = await api("/api/notifications");
      if (!json.ok) { setErr(json.message || json.error); return; }
      setItems((json as any).notifications ?? []);
      setUnreadCount((json as any).unreadCount ?? 0);
    } catch (e: any) { setErr(e?.message ?? "Error"); }
    finally { setLoading(false); }
  }, []);

  async function markRead(id: string, read: boolean) {
    haptics.selection();
    await api(`/api/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read }) });
    setItems((p) => p.map((n) => n.id === id ? { ...n, read } : n));
    setUnreadCount((c) => read ? Math.max(0, c - 1) : c + 1);
  }

  async function deleteOne(id: string) {
    haptics.impact("light");
    await api(`/api/notifications/${id}`, { method: "DELETE" });
    const wasUnread = items.find((n) => n.id === id)?.read === false;
    setItems((p) => p.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    haptics.notify("success");
    await api("/api/notifications/read-all", { method: "POST" });
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function deleteAll() {
    haptics.impact("medium");
    await api("/api/notifications", { method: "DELETE" });
    setItems([]);
    setUnreadCount(0);
  }

  useEffect(() => { load(); }, [load]);

  return (
    <PageShell withNav={false}>
      <Header title="Уведомления" back="/home" badge={unreadCount > 0 ? unreadCount : undefined} />

      <RevealStack childDelay={0.04} style={{ display: "grid", gap: 12, marginTop: 8 }}>
        {/* Action bar */}
        {!loading && items.length > 0 && (
          <Reveal>
            <div style={{ display: "flex", gap: 8 }}>
              {unreadCount > 0 && (
                <Button variant="secondary" size="sm" block leadingIcon={<CheckCircle2 size={14} />} onClick={markAllRead}>
                  Прочитать все
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                block
                tone={T.red}
                leadingIcon={<Trash2 size={14} />}
                onClick={deleteAll}
                style={{ borderColor: `${T.red}40`, color: T.red, background: `${T.red}0d` }}
              >
                Удалить все
              </Button>
            </div>
          </Reveal>
        )}

        {/* Error */}
        {err && (
          <Reveal>
            <Card padding={14} style={{ borderColor: `${T.red}40`, background: `${T.red}0d` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.red, fontSize: 13 }}>
                <AlertTriangle size={14} /> {err}
              </div>
            </Card>
          </Reveal>
        )}

        {/* Loading */}
        {loading && (
          <Reveal>
            <Card padding={16}><SkeletonStack count={3} /></Card>
          </Reveal>
        )}

        {/* Empty */}
        {!loading && !err && items.length === 0 && (
          <Reveal>
            <EmptyState
              icon={<BellOff size={28} strokeWidth={1.4} />}
              title="Нет уведомлений"
              description="Здесь появятся системные сообщения: статус подписки, важные события бота."
            />
          </Reveal>
        )}

        {/* List */}
        {!loading && items.length > 0 && (
          <AnimatePresence initial={false}>
            {items.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 30, height: 0, marginTop: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card
                  padding={14}
                  interactive={!n.read}
                  onClick={() => !n.read && markRead(n.id, true)}
                  style={{
                    borderColor: n.read ? T.border : T.borderHard,
                    background: n.read ? T.card : T.surface,
                    position: "relative",
                  }}
                >
                  {!n.read && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute", top: 14, right: 14,
                        width: 8, height: 8, borderRadius: 999, background: T.brand,
                        boxShadow: `0 0 0 4px ${T.brand}24`,
                      }}
                    />
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: T.textMuted, textTransform: "uppercase" }}>{typeLabel(n.type)}</span>
                    <span style={{ fontSize: 11, color: T.textFaint }}>·</span>
                    <span style={{ fontSize: 11, color: T.textFaint }}>{timeAgo(n.createdAt)}</span>
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 700, color: T.textMain, marginBottom: 4, paddingRight: 16 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: T.textSoft, lineHeight: 1.45 }}>{n.body}</div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                    {n.read ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); markRead(n.id, false); }}
                        style={{ fontSize: 12, color: T.textFaint, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      >
                        Отметить непрочитанным
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); markRead(n.id, true); }}
                        style={{ fontSize: 12, color: T.blue, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      >
                        Прочитано
                      </button>
                    )}
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                      style={{ color: T.red, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", opacity: 0.78 }}
                      aria-label="Удалить"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </RevealStack>
    </PageShell>
  );
}
