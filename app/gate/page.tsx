"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Дискриминированный union:
 * ok — строго true/false (литералы), чтобы TS гарантированно сужал типы.
 */
type GateOkSubscribed = { ok: true; subscribed: true };
type GateOkNeedSub = { ok: true; subscribed: false; joinUrl?: string };
type GateFail = { ok: false; error?: string };
type GateResp = GateOkSubscribed | GateOkNeedSub | GateFail;

function getTg() {
  if (typeof window === "undefined") return null;
  return (window as any)?.Telegram?.WebApp ?? null;
}

function isGateFail(x: GateResp): x is GateFail {
  return x.ok === false;
}

export default function GatePage() {
  const router = useRouter();

  const [status, setStatus] = useState<
    "loading" | "not_tg" | "need_sub" | "ok" | "error"
  >("loading");
  const [msg, setMsg] = useState<string>("Идёт проверка подписки…");
  const [joinUrl, setJoinUrl] = useState<string>("");

  // Просто для удобства (не критично), initData всё равно берём из tg в check()
  const initData = useMemo(() => {
    const tg = getTg();
    return tg?.initData ? String(tg.initData) : "";
  }, []);

  const check = useCallback(async () => {
    setStatus("loading");
    setMsg("Идёт проверка подписки…");

    const tg = getTg();
    if (!tg) {
      setStatus("not_tg");
      setMsg("Telegram.WebApp не найден.");
      return;
    }

    // Важно: попытаться “разбудить” WebApp
    try {
      tg.ready?.();
      tg.expand?.();
    } catch {}

    // Фолбэк: если initData не появится — покажем подсказку
    const timerId = window.setTimeout(() => {
      if (!tg.initData) {
        setStatus("error");
        setMsg(
          "initData пустой. Проверь /setdomain в BotFather и открывай Mini App из кнопки WebApp."
        );
      }
    }, 600);

    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: String(tg.initData || "") }),
      });

      // Даже если сервер вернул 4xx/5xx — попробуем прочитать тело
      const json = (await res.json()) as GateResp;

      window.clearTimeout(timerId);

      // Если сервер упал и вернул не-наш формат — тоже обработаем
      if (!json || typeof json !== "object" || typeof (json as any).ok !== "boolean") {
        setStatus("error");
        setMsg("Некорректный ответ сервера. Проверь /api/gate.");
        return;
      }

      if (isGateFail(json)) {
        setStatus("error");
        setMsg(json.error ?? "Ошибка проверки.");
        return;
      }

      if (json.subscribed) {
        setStatus("ok");
        setMsg("Доступ подтверждён. Переходим…");
        router.replace("/home");
        return;
      }

      setStatus("need_sub");
      setMsg("Подписка не найдена. Подпишись и нажми «Проверить».");
      setJoinUrl(json.joinUrl ?? "");
    } catch (e: any) {
      window.clearTimeout(timerId);
      setStatus("error");
      setMsg(String(e?.message || e));
    }
  }, [router]);

  useEffect(() => {
    const tg = getTg();
    if (!tg) {
      setStatus("not_tg");
      setMsg("Не внутри Telegram. Открой Mini App внутри Telegram (WebApp).");
      return;
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check]);

  const openSubscribe = () => {
    const tg = getTg();
    const url = joinUrl || "https://t.me/";
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
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
        textAlign: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
          Gate / Проверка доступа
        </div>

        <div style={{ opacity: 0.9, lineHeight: 1.5, marginBottom: 18 }}>
          {msg}
        </div>

        {status === "need_sub" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={openSubscribe}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.25)",
                background: "#fff",
                color: "#000",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Подписаться
            </button>

            <button
              onClick={check}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.25)",
                background: "transparent",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Проверить
            </button>
          </div>
        )}

        {(status === "not_tg" || status === "error") && (
          <button
            onClick={check}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.25)",
              background: "#fff",
              color: "#000",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Повторить
          </button>
        )}
      </div>
    </div>
  );
}
