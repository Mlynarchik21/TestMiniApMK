"use client";

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";

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
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path d="M9 3h6l1 2H8L9 3Zm-5 3h16v2H4V6ZM6 9h12l-1 11H7L6 9Zm4 2v7h1v-7h-1Zm3 0v7h1v-7h-1Z" fill="currentColor" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
      <path d="M12 4a4 4 0 0 0-4 4v.1L5.3 5.4a1 1 0 0 0-1.4 1.4l15 15a1 1 0 0 0 1.4-1.4L18 18V8a6 6 0 0 0-6-6Zm-7 9.5L6 14.5c-.4.7.1 1.5.9 1.5H16l-2-2H5Zm9.3 5.5H6.7A2.5 2.5 0 0 0 9.7 20h4.6a2.5 2.5 0 0 0 3-1.5h-.3Z" fill="currentColor" />
    </svg>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { T } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [err, setErr] = useState("");
  const [pagePaddingTop, setPagePaddingTop] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

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
    await api(`/api/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read }) });
    setItems((p) => p.map((n) => n.id === id ? { ...n, read } : n));
    setUnreadCount((c) => read ? Math.max(0, c - 1) : c + 1);
  }

  async function deleteOne(id: string) {
    await api(`/api/notifications/${id}`, { method: "DELETE" });
    const wasUnread = items.find((n) => n.id === id)?.read === false;
    setItems((p) => p.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await api("/api/notifications/read-all", { method: "POST" });
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function deleteAll() {
    await api("/api/notifications", { method: "DELETE" });
    setItems([]);
    setUnreadCount(0);
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

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:${T.bg};overflow-x:hidden}
        select,input,button,textarea{font:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font, paddingBottom: "calc(env(safe-area-inset-bottom,0px)+24px)", paddingTop: pagePaddingTop }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <section style={{ ...reveal(0), marginBottom: 20, display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={() => router.replace("/home")} style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${T.borderHard}`, background: T.card, color: T.textMain, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: T.textMain }}>Уведомления</span>
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, background: T.brand, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 7px", verticalAlign: "middle" }}>{unreadCount}</span>
              )}
            </div>
            <div />
          </section>

          {/* Action buttons */}
          {items.length > 0 && (
            <section style={{ ...reveal(1), display: "flex", gap: 8, marginBottom: 16 }}>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} style={{ flex: 1, height: 38, borderRadius: 12, border: `1px solid ${T.borderHard}`, background: T.card, color: T.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  Прочитать все
                </button>
              )}
              <button type="button" onClick={deleteAll} style={{ flex: 1, height: 38, borderRadius: 12, border: `1px solid rgba(255,106,106,0.22)`, background: "rgba(255,106,106,0.06)", color: T.red, fontSize: 13, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                Удалить все
              </button>
            </section>
          )}

          {/* Error */}
          {err && <div style={{ ...reveal(1), color: T.red, fontSize: 13, marginBottom: 12, padding: "10px 14px", borderRadius: 12, border: `1px solid rgba(255,106,106,0.22)`, background: "rgba(255,106,106,0.06)" }}>{err}</div>}

          {/* Loading */}
          {loading && (
            <div style={{ ...reveal(1), textAlign: "center", color: T.textMuted, padding: "40px 0" }}>Загрузка…</div>
          )}

          {/* Empty */}
          {!loading && !err && items.length === 0 && (
            <section style={{ ...reveal(1), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 14, color: T.textMuted }}>
              <span style={{ opacity: 0.35 }}><BellOffIcon /></span>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Нет уведомлений</div>
              <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", maxWidth: 240 }}>Здесь появятся системные сообщения: статус подписки, важные события бота</div>
            </section>
          )}

          {/* List */}
          {!loading && items.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {items.map((n, i) => (
                <div
                  key={n.id}
                  style={{ ...reveal(i + 2), position: "relative", padding: "14px 16px", borderRadius: 18, border: `1px solid ${n.read ? T.border : T.borderHard}`, background: n.read ? T.card : T.surface, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                  onClick={() => !n.read && markRead(n.id, true)}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <span style={{ position: "absolute", top: 16, right: 16, width: 8, height: 8, borderRadius: 999, background: T.brand }} />
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
                      <button type="button" onClick={(e) => { e.stopPropagation(); markRead(n.id, false); }} style={{ fontSize: 12, color: T.textFaint, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        Отметить непрочитанным
                      </button>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); markRead(n.id, true); }} style={{ fontSize: 12, color: T.blue, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        Прочитано
                      </button>
                    )}
                    <span style={{ flex: 1 }} />
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }} style={{ color: T.red, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", opacity: 0.7 }}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
