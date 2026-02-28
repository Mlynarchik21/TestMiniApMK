"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GateOk = { ok: true; subscribed: true };
type GateNeedSub = { ok: true; subscribed: false; joinUrl?: string };
type GateErr = { ok: false; error: string };
type GateResp = GateOk | GateNeedSub | GateErr;

function getTg() {
  return (window as any)?.Telegram?.WebApp ?? null;
}

export default function GatePage() {
  const router = useRouter();

  const [status, setStatus] = useState<
    "loading" | "not_tg" | "need_sub" | "ok" | "error"
  >("loading");
  const [msg, setMsg] = useState<string>("Идёт проверка подписки…");
  const [joinUrl, setJoinUrl] = useState<string>("");

  const initData = useMemo(() => {
    const tg = typeof window !== "undefined" ? getTg() : null;
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

    // важно: подождать готовности webapp
    try {
      tg.ready?.();
      tg.expand?.();
    } catch {}

    const id = setTimeout(() => {
      // если initData всё ещё пустой — покажем ошибку
      if (!tg.initData) {
        setStatus("error");
        setMsg("initData пустой. Проверь /setdomain в BotFather и открывай из кнопки WebApp.");
      }
    }, 600);

    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: String(tg.initData || "") })
      });

      const json = (await res.json()) as GateResp;

      clearTimeout(id);

      if (!json.ok) {
        setStatus("error");
        setMsg(json.error || "Ошибка проверки.");
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
      setJoinUrl(json.joinUrl || "");
    } catch (e: any) {
      clearTimeout(id);
      setStatus("error");
      setMsg(String(e?.message || e));
    }
  }, [router]);

  useEffect(() => {
    // если вообще не в TG — покажем экран
    const tg = typeof window !== "undefined" ? getTg() : null;
    if (!tg) {
      setStatus("not_tg");
      setMsg("Не внутри Telegram. Открой Mini App внутри Telegram (WebApp).");
      return;
    }
    check();
  }, [check]);

  const openSubscribe = () => {
    const tg = getTg();
    const url = joinUrl || "https://t.me/";
    // внутри TG лучше так
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
        textAlign: "center"
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
                fontWeight: 700
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
                fontWeight: 700
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
              fontWeight: 700
            }}
          >
            Повторить
          </button>
        )}
      </div>
    </div>
  );
}
