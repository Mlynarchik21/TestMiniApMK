"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { Header } from "@/lib/ui/Header";
import { EmptyState } from "@/lib/ui/EmptyState";
import { FONT_STACK } from "@/lib/ui/tokens";
import { haptics } from "@/lib/ui/haptics";
import { Send, Headphones, AlertCircle, MessageCircle } from "@/lib/ui/icons";

type Message = {
  id: string;
  text: string;
  fromUser: boolean;
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

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SupportPage() {
  const { T, theme } = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [pagePaddingTop, setPagePaddingTop] = useState("calc(env(safe-area-inset-top,0px) + 8px)");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await api("/api/support");
      if (json.ok) setMessages((json as any).messages ?? []);
    } finally { setLoading(false); }
  }, []);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;

    setSending(true);
    haptics.impact("light");
    setErr("");
    const optimistic: Message = { id: `opt-${Date.now()}`, text: t, fromUser: true, createdAt: new Date().toISOString() };
    setMessages((p) => [...p, optimistic]);
    setText("");

    try {
      const { json } = await api("/api/support", { method: "POST", body: JSON.stringify({ text: t }) });
      if (!json.ok) {
        setMessages((p) => p.filter((m) => m.id !== optimistic.id));
        setErr(json.message || json.error || "Ошибка отправки");
        setText(t);
        haptics.notify("error");
      } else {
        const saved = (json as any).message as Message;
        setMessages((p) => p.map((m) => m.id === optimistic.id ? saved : m));
        haptics.notify("success");
      }
    } catch (e: any) {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
      setErr(e?.message ?? "Ошибка");
      setText(t);
      haptics.notify("error");
    } finally { setSending(false); }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  useEffect(() => {
    load();
    const tg = (window as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.(); tg?.expand?.();
      tg?.setHeaderColor?.(theme === "light" ? "#ffffff" : "#000000");
      tg?.setBackgroundColor?.(theme === "light" ? "#f2f2f7" : "#000000");
      if (tg?.isFullscreen) setPagePaddingTop("calc(env(safe-area-inset-top,0px) + 88px)");
    } catch {}
  }, [load, theme]);

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: T.bg,
        color: T.text,
        fontFamily: FONT_STACK,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ paddingTop: pagePaddingTop, position: "sticky", top: 0, zIndex: 10, background: `${T.bg}f0`, backdropFilter: "saturate(140%) blur(16px)", WebkitBackdropFilter: "saturate(140%) blur(16px)", borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 8px" }}>
          <Header title="Поддержка" subtitle="Ответ придёт в Telegram" back="/home" />
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 120px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {loading && (
            <div style={{ textAlign: "center", color: T.textMuted, padding: "40px 0", fontSize: 14 }}>Загрузка…</div>
          )}

          {!loading && messages.length === 0 && (
            <EmptyState
              icon={<MessageCircle size={28} strokeWidth={1.4} />}
              title="Напишите нам"
              description="По любым вопросам — мы ответим в вашем Telegram чате."
            />
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                style={{ display: "flex", flexDirection: m.fromUser ? "row-reverse" : "row", marginBottom: 10, gap: 8 }}
              >
                {!m.fromUser && (
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 999,
                      background: `${T.brand}26`, color: T.brand,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 4,
                    }}
                  >
                    <Headphones size={16} strokeWidth={1.6} />
                  </div>
                )}
                <div style={{ maxWidth: "78%" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: m.fromUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: m.fromUser ? T.brand : T.surface,
                      color: m.fromUser ? "#fff" : T.textMain,
                      fontSize: 14,
                      lineHeight: 1.5,
                      border: m.fromUser ? "none" : `1px solid ${T.border}`,
                    }}
                  >
                    {m.text}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, textAlign: m.fromUser ? "right" : "left" }}>
                    {formatTime(m.createdAt)}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: `${T.bg}f4`,
          backdropFilter: "saturate(140%) blur(16px)",
          WebkitBackdropFilter: "saturate(140%) blur(16px)",
          borderTop: `1px solid ${T.borderSoft}`,
          paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 8px)",
        }}
      >
        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                maxWidth: 560,
                margin: "0 auto",
                padding: "8px 16px 0",
                fontSize: 12,
                color: T.red,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={12} /> {err}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напишите сообщение…"
            rows={1}
            disabled={sending}
            style={{
              flex: 1,
              background: T.surface,
              border: `1px solid ${T.borderHard}`,
              borderRadius: 16,
              color: T.textMain,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
              maxHeight: 120,
              lineHeight: 1.5,
              WebkitAppearance: "none",
              resize: "none",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <motion.button
            type="button"
            onClick={send}
            disabled={!text.trim() || sending}
            whileTap={text.trim() && !sending ? { scale: 0.94 } : undefined}
            style={{
              width: 44, height: 44, borderRadius: 999,
              background: text.trim() && !sending ? T.brand : T.card,
              border: "none",
              color: text.trim() && !sending ? "#fff" : T.textFaint,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: text.trim() && !sending ? "pointer" : "not-allowed",
              flexShrink: 0,
              transition: "background 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label="Отправить"
          >
            <Send size={18} strokeWidth={2} />
          </motion.button>
        </div>
      </div>
    </main>
  );
}
