"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";

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

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M3.4 2.1 22 12 3.4 21.9a.5.5 0 0 1-.6-.7L5.5 12 2.8 2.8a.5.5 0 0 1 .6-.7Zm3.1 10.9-1.5 5.6L19.5 12 5 5.4l1.5 5.6h7a1 1 0 0 1 0 2h-7Z" fill="currentColor" />
    </svg>
  );
}

export default function SupportPage() {
  const router = useRouter();
  const { T } = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [pagePaddingTop, setPagePaddingTop] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

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
      } else {
        const saved = (json as any).message as Message;
        setMessages((p) => p.map((m) => m.id === optimistic.id ? saved : m));
      }
    } catch (e: any) {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
      setErr(e?.message ?? "Ошибка");
      setText(t);
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
      tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000");
      if (tg?.isFullscreen) setPagePaddingTop("calc(env(safe-area-inset-top,0px) + 88px)");
    } catch {}
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        textarea{resize:none}
      `}</style>

      <main style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ paddingTop: pagePaddingTop, background: T.bg, position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${T.borderSoft}` }}>
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "8px 16px 12px", display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => router.replace("/home")} style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${T.borderHard}`, background: T.card, color: T.textMain, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: T.textMain }}>Поддержка</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>Ответ придёт в Telegram</div>
            </div>
            <div />
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>

            {loading && <div style={{ textAlign: "center", color: T.textMuted, padding: "40px 0", fontSize: 14 }}>Загрузка…</div>}

            {!loading && messages.length === 0 && (
              <div style={{ ...reveal(0), textAlign: "center", color: T.textMuted, padding: "60px 0 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Напиши нам</div>
                <div style={{ fontSize: 13, color: T.textFaint, maxWidth: 220, margin: "0 auto", lineHeight: 1.5 }}>По любым вопросам — мы ответим в вашем Telegram чате</div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={m.id}
                style={{ ...reveal(i), display: "flex", flexDirection: m.fromUser ? "row-reverse" : "row", marginBottom: 10, gap: 8 }}
              >
                {!m.fromUser && (
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: T.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 4 }}>
                    🛠
                  </div>
                )}
                <div style={{ maxWidth: "78%" }}>
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: m.fromUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: m.fromUser ? T.brand : T.surface,
                    color: m.fromUser ? "#fff" : T.textMain,
                    fontSize: 14,
                    lineHeight: 1.5,
                    border: m.fromUser ? "none" : `1px solid ${T.border}`,
                  }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, textAlign: m.fromUser ? "right" : "left" }}>
                    {formatTime(m.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.bg, borderTop: `1px solid ${T.borderSoft}`, paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 8px)" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
            {err && <div style={{ position: "absolute", bottom: "100%", left: 16, right: 16, fontSize: 12, color: T.red, padding: "6px 10px", background: "rgba(255,106,106,0.08)", borderRadius: 8, marginBottom: 4 }}>{err}</div>}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Напиши сообщение…"
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
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: text.trim() && !sending ? T.brand : T.card,
                border: "none",
                color: text.trim() && !sending ? "#fff" : T.textFaint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: text.trim() && !sending ? "pointer" : "not-allowed",
                flexShrink: 0,
                transition: "background 0.15s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <SendIcon />
            </button>
          </div>
        </div>

      </main>
    </>
  );
}
