"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "loading" | "need_subscribe" | "not_in_telegram" | "error";

export default function GatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [errText, setErrText] = useState<string>("");

  async function runGateCheck() {
    setStatus("loading");
    setErrText("");

    const tg = (globalThis as any)?.Telegram?.WebApp;

    if (!tg) {
      setStatus("not_in_telegram");
      setErrText("Открой Mini App внутри Telegram.");
      return;
    }

    try {
      tg.ready?.();

      const initData: string = tg.initData || "";
      if (!initData) {
        setStatus("error");
        setErrText("initData пустой. Открывай Mini App через кнопку в боте.");
        return;
      }

      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const json: any = await res.json().catch(() => null);

      if (!json) {
        setStatus("error");
        setErrText("Пустой ответ сервера.");
        return;
      }

      // ✅ подписка ок
      if (json.ok === true && json.allowed === true) {
        router.replace("/home");
        return;
      }

      // ❌ подписки нет
      if (json.ok === false && json.error === "NOT_SUBSCRIBED") {
        setInviteUrl(json.inviteUrl ?? null);
        setStatus("need_subscribe");
        return;
      }

      // ❌ остальные ошибки
      setStatus("error");
      setErrText(String(json.error || json.message || "Ошибка проверки."));
    } catch (e: any) {
      setStatus("error");
      setErrText(e?.message || "Ошибка сети/кода.");
    }
  }

  useEffect(() => {
    runGateCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openChannel = () => {
    if (!inviteUrl) return;
    const tg = (globalThis as any)?.Telegram?.WebApp;

    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(inviteUrl);
      else window.open(inviteUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.open(inviteUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,Roboto,"Segoe UI",Arial,sans-serif',
      }}
    >
      {status === "loading" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Загрузка…</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
            Проверяем подписку…
          </div>
        </div>
      )}

      {status === "need_subscribe" && (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Нужна подписка</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            Подпишись на Telegram-канал и нажми “Проверить подписку”.
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={openChannel}
              disabled={!inviteUrl}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.32)",
                background: "#000",
                color: "#fff",
                padding: "10px 14px",
                fontSize: 13,
                cursor: inviteUrl ? "pointer" : "not-allowed",
              }}
            >
              Подписаться
            </button>

            <button
              onClick={runGateCheck}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.32)",
                background: "#fff",
                color: "#000",
                padding: "10px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Проверить подписку
            </button>
          </div>

          {!inviteUrl && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Сервер не прислал inviteUrl — проверь переменную{" "}
              <b>TELEGRAM_CHANNEL_INVITE_URL</b> в Vercel.
            </div>
          )}
        </div>
      )}

      {status === "not_in_telegram" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Не внутри Telegram</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            {errText}
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ошибка</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            {errText}
          </div>

          <button
            onClick={runGateCheck}
            style={{
              marginTop: 14,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.32)",
              background: "#000",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      )}
    </div>
  );
}
