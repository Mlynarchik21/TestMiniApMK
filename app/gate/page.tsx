"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "loading" | "need_subscribe" | "not_in_telegram" | "error" | "debug";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function GatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [errText, setErrText] = useState<string>("");
  const [debug, setDebug] = useState<string>("");

  async function getTelegramWebAppWithWait() {
    for (let i = 0; i < 20; i++) {
      const tg = (globalThis as any)?.Telegram?.WebApp;
      if (tg) return tg;
      await sleep(100);
    }
    return null;
  }

  async function runGateCheck() {
    setStatus("loading");
    setErrText("");
    setInviteUrl(null);
    setDebug("");

    const tg = await getTelegramWebAppWithWait();

    if (!tg) {
      setStatus("not_in_telegram");
      setErrText("Открой Mini App внутри Telegram (WebApp).");
      return;
    }

    try {
      tg.ready?.();

      const initData: string = tg.initData || "";
      if (!initData) {
        setStatus("error");
        setErrText("initData пустой. Открывай Mini App через WebApp-кнопку в боте.");
        return;
      }

      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const text = await res.text(); // читаем как текст, чтобы поймать даже не-JSON
      setDebug(`HTTP ${res.status}\n\n${text}`);

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // оставим json = null
      }

      if (json && json.ok === true && json.allowed === true) {
        router.replace("/home");
        return;
      }

      if (json && json.ok === false && json.error === "NOT_SUBSCRIBED") {
        setInviteUrl(json.inviteUrl ?? null);
        setStatus("need_subscribe");
        return;
      }

      // иначе покажем debug экран
      setStatus("debug");
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>Идёт проверка подписки…</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
            Подожди пару секунд
          </div>
        </div>
      )}

      {status === "need_subscribe" && (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Нужна подписка</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            Подпишись на канал и нажми “Проверить подписку”.
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

      {status === "debug" && (
        <div style={{ width: "100%", maxWidth: 520 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>DEBUG: ответ /api/gate</div>
          <pre
            style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.2)",
              background: "#050505",
              fontSize: 12,
              lineHeight: 1.45,
              opacity: 0.95,
            }}
          >
            {debug || "нет данных"}
          </pre>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              Повторить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
