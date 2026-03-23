"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AiResp =
  | {
      ok: true;
      answer?: string;
      sessionId?: string;
      expired?: boolean;
      [k: string]: any;
    }
  | {
      ok: false;
      error?: string;
      message?: string;
      sessionId?: string;
      expired?: boolean;
      [k: string]: any;
    };

type ChatItem = {
  id: string;
  role: "user" | "ai";
  text: string;
  time: string;
  imageUrl?: string | null;
  pinned?: boolean;
};

const UI = {
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.08)",
  borderHard: "rgba(255,255,255,0.16)",
  text: "#f3f3f3",
  textMain: "rgba(255,255,255,0.96)",
  textSoft: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.36)",
  green: "#64d97b",
  red: "#ff6a6a",
  blue: "#8eb2ff",
  brand: "#2979ff",
  yellow: "#f3d709",
  panel: "#101010",
  panelSoft: "#0a0a0a",
};

const CHAT_SESSION_KEY = "aiSessionId";
const CHAT_LAST_ACTIVITY_KEY = "aiLastActivityAt";
const CHAT_EXPIRE_MS = 60 * 60 * 1000;

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

function formatNowTime() {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function reveal(index: number, mounted: boolean): CSSProperties {
  return mounted
    ? {
        opacity: 1,
        animationName: "fadeUp",
        animationDuration: "480ms",
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        animationFillMode: "both",
        animationDelay: `${index * 45}ms`,
        willChange: "transform, opacity",
      }
    : {
        opacity: 0,
        transform: "translate3d(0, 10px, 0)",
      };
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M5 19l14-7L5 5v5l8 2-8 2z"
        stroke="currentColor"
        strokeWidth="1.9"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AiPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [showGreeting, setShowGreeting] = useState(true);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [systemNote, setSystemNote] = useState("");

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisibleText, setPlaceholderVisibleText] = useState("");

  const chatRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const initialViewportHeightRef = useRef<number | null>(null);

  const quickPrompts = [
    "что произошло за 24 часа",
    "solusdt уровни и новости",
    "xrpusdt уровни и новости",
  ];

  const rotatingPlaceholders = useMemo(
    () => [
      "Напиши вопрос по рынку",
      "Загрузи скрин графика",
      "Спроси про btc или sol",
      "Попроси обзор новостей",
    ],
    []
  );

  const pinnedMessages = messages.filter((m) => m.role === "ai" && m.pinned);

  function clearExpiredChatLocally() {
    setMessages([]);
    setSessionId(null);
    setShowGreeting(true);
    setShowQuickPrompts(true);
    setSystemNote("Прошло больше часа. Начат новый чат.");

    try {
      localStorage.removeItem(CHAT_SESSION_KEY);
      localStorage.removeItem(CHAT_LAST_ACTIVITY_KEY);
    } catch {}
  }

  function markActivity(nextSessionId?: string | null) {
    try {
      const sid = nextSessionId ?? sessionId;
      if (sid) localStorage.setItem(CHAT_SESSION_KEY, sid);
      localStorage.setItem(CHAT_LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {}
  }

  async function sendMessage(presetText?: string) {
    const text = (presetText ?? input).trim();

    if (!text && !attachedFile) return;
    if (sending) return;

    const imageUrl = attachedPreview || null;

    if (showGreeting) setShowGreeting(false);
    if (showQuickPrompts) setShowQuickPrompts(false);
    setSystemNote("");

    const userMessage: ChatItem = {
      id: makeId(),
      role: "user",
      text,
      time: formatNowTime(),
      imageUrl,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    const currentFile = attachedFile;
    setAttachedFile(null);
    setAttachedPreview(null);

    if (textAreaRef.current) {
      textAreaRef.current.style.height = "24px";
    }

    try {
      const token = getToken();
      const form = new FormData();

      form.append("message", text || "");
      if (sessionId) form.append("sessionId", sessionId);
      if (currentFile) form.append("image", currentFile);

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
        cache: "no-store",
      });

      let data: AiResp = { ok: false, error: "BAD_RESPONSE" };

      try {
        data = (await res.json()) as AiResp;
      } catch {}

      if (data?.expired) {
        clearExpiredChatLocally();
      }

      const answer =
        data?.ok && data.answer
          ? data.answer
          : "Не удалось получить ответ от AI. Попробуй ещё раз.";

      if (data?.sessionId) {
        setSessionId(data.sessionId);
        markActivity(data.sessionId);
      } else {
        markActivity();
      }

      const aiMessage: ChatItem = {
        id: makeId(),
        role: "ai",
        text: answer,
        time: formatNowTime(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const aiMessage: ChatItem = {
        id: makeId(),
        role: "ai",
        text: "Ошибка соединения с сервером. Попробуй ещё раз позже.",
        time: formatNowTime(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 80);
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = chatRef.current;
      if (!el) return;
      el.scrollTo({
        top: el.scrollHeight + 800,
        behavior: "smooth",
      });
    });
  }

  function onPickFile(file: File | null) {
    if (!file) {
      setAttachedFile(null);
      setAttachedPreview(null);
      return;
    }

    setAttachedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);

    setShowGreeting(false);
    setShowQuickPrompts(false);

    setTimeout(() => {
      textAreaRef.current?.focus();
      scrollToBottom();
    }, 60);
  }

  function togglePin(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m))
    );
  }

  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg_${id}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate(
      [
        { boxShadow: "0 0 0 0 rgba(41,121,255,0)" },
        { boxShadow: "0 0 0 1px rgba(41,121,255,0.9)" },
        { boxShadow: "0 0 0 0 rgba(41,121,255,0)" },
      ],
      { duration: 900, easing: "ease" }
    );
  }

  function handleBack() {
    router.replace("/home");
  }

  useEffect(() => {
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

    const id = requestAnimationFrame(() => setMounted(true));

    return () => {
      cancelAnimationFrame(id);
      try {
        tg?.offEvent?.("fullscreen_changed", updateLayout);
      } catch {}
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, keyboardOpen, keyboardInset]);

  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "24px";
    el.style.height = `${Math.min(el.scrollHeight, 118)}px`;
  }, [input]);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(CHAT_SESSION_KEY);
      const savedLastActivity = Number(localStorage.getItem(CHAT_LAST_ACTIVITY_KEY) || "0");

      if (!savedSession || !savedLastActivity) return;

      const expired = Date.now() - savedLastActivity > CHAT_EXPIRE_MS;

      if (expired) {
        localStorage.removeItem(CHAT_SESSION_KEY);
        localStorage.removeItem(CHAT_LAST_ACTIVITY_KEY);
        setSystemNote("Прошло больше часа после последнего сообщения. Начат новый чат.");
        return;
      }

      setSessionId(savedSession);
    } catch {}
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;

    const updateKeyboardState = () => {
      const currentHeight = vv?.height ?? window.innerHeight;

      if (initialViewportHeightRef.current == null) {
        initialViewportHeightRef.current = currentHeight;
      }

      const baseHeight = initialViewportHeightRef.current ?? currentHeight;
      const diff = baseHeight - currentHeight;

      setKeyboardOpen(diff > 120);
      setKeyboardInset(diff > 0 ? diff : 0);
    };

    updateKeyboardState();

    vv?.addEventListener("resize", updateKeyboardState);
    window.addEventListener("resize", updateKeyboardState);

    return () => {
      vv?.removeEventListener("resize", updateKeyboardState);
      window.removeEventListener("resize", updateKeyboardState);
    };
  }, []);

  useEffect(() => {
    if (input.trim()) {
      setPlaceholderVisibleText("");
      return;
    }

    const phrase = rotatingPlaceholders[placeholderIndex];
    let i = 0;
    setPlaceholderVisibleText("");

    const typeTimer = setInterval(() => {
      i += 1;
      setPlaceholderVisibleText(phrase.slice(0, i));
      if (i >= phrase.length) {
        clearInterval(typeTimer);
      }
    }, 42);

    const swapTimer = setTimeout(() => {
      setPlaceholderIndex((prev) => (prev + 1) % rotatingPlaceholders.length);
    }, 2600);

    return () => {
      clearInterval(typeTimer);
      clearTimeout(swapTimer);
    };
  }, [placeholderIndex, rotatingPlaceholders, input]);

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
          overflow: hidden;
        }

        textarea,
        input,
        button {
          font: inherit;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes pulseDots {
          0%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }

        @keyframes softGlow {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(41, 121, 255, 0);
          }
          50% {
            box-shadow: 0 0 20px rgba(41, 121, 255, 0.15);
          }
        }
      `}</style>

      <main style={{ ...styles.page, paddingTop: pagePaddingTop }}>
        <div style={styles.container}>
          <section style={{ ...styles.topBar, ...reveal(0, mounted) }}>
            <button
              type="button"
              aria-label="Назад"
              style={styles.backButton}
              onClick={handleBack}
            >
              <ArrowLeftIcon />
            </button>

            <div style={styles.topTitleWrap}>
              <div style={styles.topTitle}>Крипто ассистент</div>
              <div style={styles.topTitleSub}>AI для обзора рынка и скринов</div>
            </div>

            <div style={styles.topSpacer} />
          </section>

          {!keyboardOpen ? (
            <section style={{ ...styles.pinnedWrap, ...reveal(1, mounted) }}>
              <div style={styles.pinnedTitle}>Закреплённые ответы</div>

              {!pinnedMessages.length ? (
                <div style={styles.pinnedEmpty}>Пока ничего не закреплено.</div>
              ) : (
                <div style={styles.pinnedList}>
                  {pinnedMessages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      style={styles.pinnedItem}
                      onClick={() => jumpToMessage(m.id)}
                    >
                      {(m.text || "").length > 140
                        ? `${m.text.slice(0, 137)}…`
                        : m.text}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section
            style={{
              ...styles.chatArea,
              paddingBottom: keyboardOpen ? 12 : 0,
            }}
          >
            {systemNote ? <div style={styles.systemNote}>{systemNote}</div> : null}

            {!keyboardOpen && showGreeting ? (
              <div style={{ ...styles.greetingCard, ...reveal(2, mounted) }}>
                <div style={styles.greetingHeading}>
                  Привет, я твой крипто ассистент.
                </div>

                <div style={styles.greetingItem}>
                  <span style={styles.greetingIcon}>🛠️</span>
                  <span>
                    Сейчас я в активной разработке и могу опираться на неполные
                    данные.
                  </span>
                </div>

                <div style={styles.greetingItem}>
                  <span style={styles.greetingIcon}>⚠️</span>
                  <span>
                    Я работаю в тестовом режиме и могу ошибаться, особенно в
                    быстро меняющемся рынке.
                  </span>
                </div>

                <div style={styles.greetingItem}>
                  <span style={styles.greetingIcon}>💡</span>
                  <span>
                    Все ответы носят исключительно информационный характер и не
                    являются финансовой рекомендацией.
                  </span>
                </div>

                <button
                  type="button"
                  style={styles.greetingCta}
                  onClick={() => setShowQuickPrompts((v) => !v)}
                >
                  {showQuickPrompts ? "Скрыть примеры запросов" : "Показать примеры запросов"}
                </button>
              </div>
            ) : null}

            {!keyboardOpen && showQuickPrompts ? (
              <div style={styles.quickStack}>
                {quickPrompts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    style={styles.quickInline}
                    onClick={() => sendMessage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              ref={chatRef}
              style={{
                ...styles.chatList,
                paddingBottom: keyboardOpen ? 26 : 10,
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  id={`msg_${m.id}`}
                  style={{
                    ...styles.row,
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  {m.role === "ai" ? <div style={styles.aiAvatar}>AI</div> : null}

                  <div
                    style={{
                      ...styles.bubbleWrap,
                      marginLeft: m.role === "user" ? "auto" : 0,
                    }}
                  >
                    <div
                      style={{
                        ...styles.bubble,
                        ...(m.role === "user" ? styles.userBubble : styles.aiBubble),
                      }}
                    >
                      {m.text}

                      {m.imageUrl ? (
                        <img
                          src={m.imageUrl}
                          alt="attachment"
                          style={styles.bubbleImage}
                          onClick={() => setLightboxSrc(m.imageUrl || null)}
                        />
                      ) : null}
                    </div>

                    <div style={styles.metaRow}>
                      <span>{m.time}</span>

                      {m.role === "ai" ? (
                        <button
                          type="button"
                          style={{
                            ...styles.pinBtn,
                            ...(m.pinned ? styles.pinBtnActive : null),
                          }}
                          onClick={() => togglePin(m.id)}
                        >
                          📌 {m.pinned ? "закреплён" : "закрепить"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {sending ? (
                <div style={styles.typingRow}>
                  <span>AI анализирует запрос</span>
                  <div style={styles.typingDots}>
                    <span style={{ ...styles.typingDot, animationDelay: "0ms" }} />
                    <span style={{ ...styles.typingDot, animationDelay: "140ms" }} />
                    <span style={{ ...styles.typingDot, animationDelay: "280ms" }} />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section
            style={{
              ...styles.bottomBar,
              paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${
                keyboardOpen ? 10 : 18
              }px)`,
              marginBottom: keyboardOpen ? Math.max(0, keyboardInset - 6) : 0,
            }}
          >
            {attachedPreview ? (
              <div style={styles.attachPreviewWrap}>
                <img
                  src={attachedPreview}
                  alt="preview"
                  style={styles.attachPreview}
                  onClick={() => setLightboxSrc(attachedPreview)}
                />
                <button
                  type="button"
                  style={styles.removeAttachBtn}
                  onClick={() => {
                    setAttachedFile(null);
                    setAttachedPreview(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  ✕
                </button>
              </div>
            ) : null}

            <div style={styles.inputRow}>
              <button
                type="button"
                style={styles.circleBtn}
                onClick={() => fileRef.current?.click()}
                aria-label="Прикрепить"
              >
                <PlusIcon />
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />

              <div style={styles.inputShell}>
                <textarea
                  ref={textAreaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                  }}
                  placeholder={input ? "" : placeholderVisibleText}
                  style={styles.textarea}
                  rows={1}
                  onFocus={() => {
                    setShowGreeting(false);
                    setShowQuickPrompts(false);
                    setTimeout(scrollToBottom, 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </div>

              <button
                type="button"
                style={{
                  ...styles.sendBtn,
                  ...((!input.trim() && !attachedFile) || sending
                    ? styles.sendBtnDisabled
                    : null),
                }}
                onClick={() => sendMessage()}
                aria-label="Отправить"
              >
                <SendIcon />
              </button>
            </div>

            {!keyboardOpen ? (
              <div style={styles.footerNote}>
                Ответы ИИ носят информационный характер и не являются финансовой
                рекомендацией.
              </div>
            ) : null}
          </section>
        </div>
      </main>

      {lightboxSrc ? (
        <div style={styles.lightbox} onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="full" style={styles.lightboxImage} />
        </div>
      ) : null}
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: UI.text,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    overflow: "hidden",
  } satisfies CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  topBar: {
    marginTop: 8,
    marginBottom: 14,
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.04)",
    color: UI.textMain,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  topTitleWrap: {
    textAlign: "center",
  } satisfies CSSProperties,

  topTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1.05,
  } satisfies CSSProperties,

  topTitleSub: {
    marginTop: 3,
    fontSize: 10,
    color: UI.textFaint,
    lineHeight: 1.1,
  } satisfies CSSProperties,

  topSpacer: {
    width: 44,
    height: 44,
  } satisfies CSSProperties,

  pinnedWrap: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeft: "2px solid rgba(255,255,255,0.08)",
  } satisfies CSSProperties,

  pinnedTitle: {
    fontSize: 10,
    color: UI.textFaint,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    marginBottom: 6,
    marginLeft: 4,
  } satisfies CSSProperties,

  pinnedEmpty: {
    fontSize: 11,
    color: "rgba(255,255,255,0.34)",
    marginLeft: 4,
  } satisfies CSSProperties,

  pinnedList: {
    display: "grid",
    gap: 6,
  } satisfies CSSProperties,

  pinnedItem: {
    width: "100%",
    textAlign: "left",
    borderRadius: 14,
    background: "#0c0c0c",
    border: "1px solid rgba(255,255,255,0.12)",
    color: UI.textSoft,
    padding: "8px 10px",
    fontSize: 12,
    cursor: "pointer",
  } satisfies CSSProperties,

  chatArea: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  systemNote: {
    marginBottom: 10,
    border: `1px solid ${UI.border}`,
    background: "rgba(41,121,255,0.10)",
    color: UI.textSoft,
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 12,
    lineHeight: 1.45,
  } satisfies CSSProperties,

  greetingCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#000",
    animation: "softGlow 3.6s ease-in-out infinite",
  } satisfies CSSProperties,

  greetingHeading: {
    fontSize: 14,
    fontWeight: 700,
    color: UI.textMain,
    marginBottom: 10,
  } satisfies CSSProperties,

  greetingItem: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    fontSize: 13,
    color: UI.textSoft,
    lineHeight: 1.5,
    marginBottom: 6,
  } satisfies CSSProperties,

  greetingIcon: {
    flexShrink: 0,
  } satisfies CSSProperties,

  greetingCta: {
    marginTop: 8,
    border: "none",
    borderRadius: 999,
    padding: "9px 14px",
    background: UI.brand,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(41,121,255,0.35)",
  } satisfies CSSProperties,

  quickStack: {
    display: "grid",
    gap: 6,
    marginBottom: 12,
  } satisfies CSSProperties,

  quickInline: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#050505",
    color: "rgba(255,255,255,0.74)",
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 11.5,
    lineHeight: 1.15,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,

  chatList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingBottom: 8,
    scrollbarWidth: "none",
  } satisfies CSSProperties,

  row: {
    display: "flex",
    margin: "6px 0",
  } satisfies CSSProperties,

  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "linear-gradient(135deg, #2d7dff, #5f9bff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "#fff",
    marginRight: 6,
    flexShrink: 0,
  } satisfies CSSProperties,

  bubbleWrap: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "78%",
  } satisfies CSSProperties,

  bubble: {
    padding: "10px 12px",
    borderRadius: 18,
    fontSize: 14,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    transition: "transform 180ms ease, box-shadow 180ms ease",
  } satisfies CSSProperties,

  userBubble: {
    background: UI.brand,
    color: "#fff",
    borderBottomRightRadius: 5,
  } satisfies CSSProperties,

  aiBubble: {
    background: "#161616",
    color: "#f5f5f5",
  } satisfies CSSProperties,

  bubbleImage: {
    display: "block",
    marginTop: 8,
    width: "100%",
    maxWidth: 260,
    borderRadius: 14,
    cursor: "pointer",
  } satisfies CSSProperties,

  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    fontSize: 10,
    color: "#707070",
  } satisfies CSSProperties,

  pinBtn: {
    border: "none",
    background: "transparent",
    color: "#8a8a8a",
    borderRadius: 999,
    padding: "2px 6px",
    fontSize: 11,
    cursor: "pointer",
  } satisfies CSSProperties,

  pinBtnActive: {
    background: "rgba(45,125,255,.10)",
    color: "#c8dcff",
  } satisfies CSSProperties,

  typingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: UI.textMuted,
    fontSize: 12,
    padding: "6px 4px 8px",
  } satisfies CSSProperties,

  typingDots: {
    display: "inline-flex",
    gap: 4,
  } satisfies CSSProperties,

  typingDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: UI.textMuted,
    opacity: 0.3,
    animationName: "pulseDots",
    animationDuration: "1100ms",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  } satisfies CSSProperties,

  bottomBar: {
    paddingTop: 12,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.80) 18%, rgba(0,0,0,0.98) 58%)",
  } satisfies CSSProperties,

  attachPreviewWrap: {
    position: "relative",
    width: 74,
    marginBottom: 10,
  } satisfies CSSProperties,

  attachPreview: {
    width: 74,
    height: 74,
    objectFit: "cover",
    borderRadius: 14,
    border: `1px solid ${UI.border}`,
    cursor: "pointer",
  } satisfies CSSProperties,

  removeAttachBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#101010",
    color: "#fff",
    fontSize: 11,
    cursor: "pointer",
  } satisfies CSSProperties,

  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
  } satisfies CSSProperties,

  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    border: "none",
    background: "#151515",
    color: "#e0e0e0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  } satisfies CSSProperties,

  inputShell: {
    flex: 1,
    display: "flex",
    alignItems: "flex-end",
    padding: "9px 18px",
    borderRadius: 28,
    background: "#111111",
    border: "1px solid rgba(255,255,255,.18)",
    minHeight: 48,
  } satisfies CSSProperties,

  textarea: {
    flex: 1,
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    color: "#fff",
    fontSize: 16,
    lineHeight: 1.42,
    minHeight: 24,
    maxHeight: 118,
    padding: "4px 0",
  } satisfies CSSProperties,

  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    border: "none",
    background: UI.brand,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "0 8px 18px rgba(41,121,255,0.35)",
  } satisfies CSSProperties,

  sendBtnDisabled: {
    opacity: 0.45,
    pointerEvents: "none",
    boxShadow: "none",
  } satisfies CSSProperties,

  footerNote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 10,
    color: "#555",
    padding: "0 10px",
  } satisfies CSSProperties,

  lightbox: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  } satisfies CSSProperties,

  lightboxImage: {
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: 12,
  } satisfies CSSProperties,
};