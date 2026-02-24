"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GateOkResponse = {
  ok: true;
  allowed: true;
  user: {
    id: number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
};

type GateFailResponse =
  | { ok: false; error: "NOT_IN_TELEGRAM" }
  | { ok: false; error: "MISSING_INITDATA" }
  | { ok: false; error: "BAD_INITDATA" }
  | { ok: false; error: "NOT_SUBSCRIBED"; inviteUrl?: string | null }
  | { ok: false; error: "SERVER_MISCONFIGURED" }
  | { ok: false; error: "UNKNOWN"; message?: string };

type GateResponse = GateOkResponse | GateFailResponse;

export default function GatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "need_subscribe" | "not_in_telegram" | "error"
  >("loading");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [errText, setErrText] = useState<string>("");

  const tg = useMemo(() => (window as any).Telegram?.WebApp, []);

  async function runGateCheck() {
    setStatus("loading");
    setErrText("");

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

      const json = (await res.json().catch(() => null)) as GateResponse | null;

      if (!json) {
        setStatus("error");
        setErrText("Пустой ответ сервера.");
        return;
      }

      // ✅ сначала разделяем по ok
      if (json.ok) {
        // ok:true значит доступ разрешён
        router.replace("/home");
        return;
      }

      // ok:false => тут точно есть json.error
      if (json.error === "NOT_SUBSCRIBED") {
        setInviteUrl(json.inviteUrl ?? null);
        setStatus("need_subscribe");
        return;
      }

      if (json.error === "NOT_IN_TELEGRAM") {
        setStatus("not_in_telegram");
        setErrText("Открой приложение внутри Telegram.");
        return;
      }

      if (json.error === "SERVER_MISCONFIGURED") {
        setStatus("error");
        setErrText("Сервер не настроен (env).");
        return;
      }

      if (json.error === "BAD_INITDATA") {
        setStatus("error");
        setErrText("initData не прошёл проверку подписи.");
        return;
      }

      if (json.error === "MISSING_INITDATA") {
        setStatus("error");
        setErrText("Не пришёл initData.");
        return;
      }

      setStatus("error");
      setErrText(json.message || "Неизвестная ошибка.");
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
            Чтобы продолжить, подпишись на наш Telegram-канал и нажми “Проверить подписку”.
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
              title={!inviteUrl ? "inviteUrl не задан на сервере" : ""}
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
              На сервере не задана переменная <b>TELEGRAM_CHANNEL_INVITE_URL</b>.
            </div>
          )}
        </>
      )}

      {status === "not_in_telegram" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Не внутри Telegram</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            {errText || "Открой Mini App внутри Telegram (через кнопку в боте/меню)."}
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ошибка</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, lineHeight: 1.5 }}>
            {errText || "Что-то пошло не так."}
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
