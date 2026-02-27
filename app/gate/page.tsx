"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function GatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "need_subscribe" | "not_in_telegram" | "error">(
    "loading"
  );
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [errText, setErrText] = useState<string>("");

  async function runGateCheck() {
    setStatus("loading");
    setErrText("");

    // ✅ window используем только внутри функции, которая вызывается из useEffect/клиента
    const tg = (globalThis as any)?.Telegram?.WebApp;

    if (!tg) {
      setStatus("not_in_telegram");
      setErrText("Открой приложение внутри Telegram.");
      return;
    }

    try {
      tg.ready?.();

      const initData: string = tg.initData || "";
      if (!initData) {
        setStatus("error");
        setErrText("initData пустой. Открывай Mini App через кнопку в боте/меню.");
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

      if (json.ok === true && json.allowed === true) {
        router.replace("/home");
        return;
      }

      const errorCode = json.error as string | undefined;

      if (errorCode === "NOT_SUBSCRIBED") {
        setInviteUrl((json.inviteUrl as string | null) ?? null);
        setStatus("need_subscribe");
        return;
      }

      if (errorCode === "NOT_IN_TELEGRAM") {
        setStatus("not_in_telegram");
        setErrText("Открой приложение внутри Telegram.");
        return;
      }

      setStatus("error");
      setErrText(String(json.message || errorCode || "Неизвестная ошибка."));
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
        padding: 16,
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,Roboto,"Segoe UI",Arial,sans-serif',
      }}
    >
      {status === "loading" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Загрузка…</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
            Проверяем подписку и загружаем данные…
          </div>
        </>
      )}

      {status === "need_subscribe" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Нужна подписка</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            Подпишись на Telegram-канал и нажми “Проверить подписку”.
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={openChannel}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.32)",
                background: "#000",
                color: "#fff",
                padding: "10px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
              disabled={!inviteUrl}
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
              Сервер не прислал inviteUrl (позже добавим env).
            </div>
          )}
        </>
      )}

      {status === "not_in_telegram" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Не внутри Telegram</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            {errText}
          </div>
        </>
      )}

      {status === "error" && (
        <>
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
        </>
      )}
    </div>
  );
}
