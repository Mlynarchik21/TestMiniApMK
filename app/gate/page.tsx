"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "loading" | "need_subscribe" | "ok" | "error" | "not_in_telegram";

export default function GatePage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  // безопасно проверяем Telegram WebApp только на клиенте
  const isTelegramWebApp = useMemo(() => {
    if (typeof window === "undefined") return false;
    const tg = (window as any).Telegram?.WebApp;
    return !!tg;
  }, []);

  // helper: получить initData
  const getInitData = () => {
    const tg = (window as any).Telegram?.WebApp;
    return tg?.initData || "";
  };

  async function checkSubscription() {
    try {
      setStatus("loading");
      setMsg("Идёт проверка подписки...");

      const initData = getInitData();
      if (!initData) {
        setStatus("not_in_telegram");
        setMsg("Telegram.WebApp не найден или initData пустой.");
        return;
      }

      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const json: any = await res.json().catch(() => null);

      if (!json || json.ok !== true) {
        // ожидаем, что API может вернуть { ok:false, error:"NOT_SUBSCRIBED", inviteUrl:"..." }
        if (json?.error === "NOT_SUBSCRIBED") {
          setInviteUrl(json?.inviteUrl ?? null);
          setStatus("need_subscribe");
          setMsg("Подпишись на канал и нажми «Проверить подписку» ещё раз.");
          return;
        }

        setStatus("error");
        setMsg(json?.error ? String(json.error) : "Ошибка проверки подписки");
        return;
      }

      // ok
      setStatus("ok");
      setMsg("ОК. Перенаправляю на /home ...");
      router.replace("/home");
    } catch (e: any) {
      setStatus("error");
      setMsg(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    // запускаем автопроверку при входе
    if (!isTelegramWebApp) {
      setStatus("not_in_telegram");
      setMsg("Не внутри Telegram. Открой Mini App внутри Telegram (WebApp).");
      return;
    }

    // Telegram UI фичи (не обязательно)
    try {
      const tg = (window as any).Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
    } catch {}

    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        textAlign: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
          {status === "loading" ? "Загрузка..." : "Gate / Проверка доступа"}
        </div>

        <div style={{ opacity: 0.85, lineHeight: 1.5, marginBottom: 16 }}>
          {msg}
        </div>

        {status === "need_subscribe" && (
          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={() => {
                if (inviteUrl) window.open(inviteUrl, "_blank");
              }}
              style={{
                height: 44,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.25)",
                background: "#111",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Подписаться
            </button>

            <button
              onClick={checkSubscription}
              style={{
                height: 44,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.35)",
                background: "#fff",
                color: "#000",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Проверить подписку
            </button>
          </div>
        )}

        {(status === "error" || status === "not_in_telegram") && (
          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={checkSubscription}
              style={{
                height: 44,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.35)",
                background: "#fff",
                color: "#000",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Повторить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
