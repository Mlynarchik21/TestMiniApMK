"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** API response types */
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function GatePage() {
  const router = useRouter();

  const [status, setStatus] = useState<
    "loading" | "not_tg" | "need_sub" | "ok" | "error"
  >("loading");

  // loading variant: initial vs recheck
  const [loadingVariant, setLoadingVariant] = useState<"init" | "recheck">("init");

  // messages
  const [msg, setMsg] = useState<string>("Инициализация…");
  const [joinUrl, setJoinUrl] = useState<string>("");

  // Progress (0..100)
  const [progress, setProgress] = useState<number>(0);

  // animation control
  const rafRef = useRef<number | null>(null);
  const animStartRef = useRef<number>(0);
  const animFromRef = useRef<number>(0);
  const animToRef = useRef<number>(0);
  const animDurRef = useRef<number>(0);
  const animResolveRef = useRef<null | (() => void)>(null);

  const phasesInit = useMemo(
    () => [
      { at: 8, text: "Инициализация Mini App…" },
      { at: 22, text: "Проверяем контекст Telegram…" },
      { at: 45, text: "Проверяем подписку на канал…" },
      { at: 70, text: "Загружаем ваши данные…" },
      { at: 86, text: "Почти готово. Финальная проверка…" },
    ],
    []
  );

  const setPhaseText = useCallback(
    (p: number) => {
      if (loadingVariant !== "init") return; // при recheck текст фиксированный снизу
      let idx = 0;
      for (let i = 0; i < phasesInit.length; i++) {
        if (p >= phasesInit[i].at) idx = i;
      }
      setMsg(phasesInit[idx].text);
    },
    [loadingVariant, phasesInit]
  );

  const stopAnim = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animResolveRef.current?.();
    animResolveRef.current = null;
  }, []);

  const animateProgress = useCallback(
    (from: number, to: number, durationMs: number) => {
      stopAnim();
      setProgress(from);

      animStartRef.current = performance.now();
      animFromRef.current = from;
      animToRef.current = to;
      animDurRef.current = Math.max(50, durationMs);

      return new Promise<void>((resolve) => {
        animResolveRef.current = resolve;

        const tick = () => {
          const now = performance.now();
          const t = Math.min(1, (now - animStartRef.current) / animDurRef.current);
          const e = easeOutCubic(t);
          const v = animFromRef.current + (animToRef.current - animFromRef.current) * e;

          setProgress(v);
          setPhaseText(v);

          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
            animResolveRef.current?.();
            animResolveRef.current = null;
          }
        };

        rafRef.current = requestAnimationFrame(tick);
      });
    },
    [setPhaseText, stopAnim]
  );

  const waitForInitData = useCallback(async (tg: any, maxMs = 1500) => {
    const started = Date.now();
    while (!tg.initData && Date.now() - started < maxMs) {
      await sleep(80);
    }
  }, []);

  const runGateFlow = useCallback(
    async (variant: "init" | "recheck") => {
      setLoadingVariant(variant);
      setStatus("loading");
      setJoinUrl("");

      // ощущение “дорого”: 4.2с до 92% + 0.65с до 100%
      setMsg(variant === "init" ? phasesInit[0].text : "Проверяем подписку…");
      const minDurationMs = 4200;
      const startTs = Date.now();

      const tg = getTg();
      if (!tg) {
        await animateProgress(0, 100, 900);
        setStatus("not_tg");
        setMsg("Не внутри Telegram. Открой Mini App внутри Telegram (WebApp).");
        return;
      }

      try {
        tg.ready?.();
        tg.expand?.();
      } catch {}

      const progPromise = animateProgress(0, 92, minDurationMs);

      await waitForInitData(tg, 1500);

      if (!tg.initData) {
        await progPromise;
        await animateProgress(92, 100, 650);
        setStatus("error");
        setMsg(
          "initData пустой. Проверь /setdomain в BotFather и запускай Mini App через кнопку WebApp."
        );
        return;
      }

      let json: GateResp | null = null;
      try {
        const res = await fetch("/api/gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: String(tg.initData || "") }),
        });

        json = (await res.json()) as GateResp;
      } catch (e: any) {
        json = { ok: false, error: String(e?.message || e) };
      }

      const elapsed = Date.now() - startTs;
      if (elapsed < minDurationMs) await sleep(minDurationMs - elapsed);

      await progPromise;
      await animateProgress(92, 100, 650);

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

      if (json.subscribed === true) {
        setStatus("ok");
        setMsg("Доступ подтверждён. Переходим…");
        await sleep(150);
        router.replace("/home");
        return;
      }

      setStatus("need_sub");
      setMsg("Подписка не найдена.");
      setJoinUrl(json.joinUrl ?? "");
    },
    [animateProgress, phasesInit, router, waitForInitData]
  );

  useEffect(() => {
    runGateFlow("init");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSubscribe = () => {
    const tg = getTg();
    const url = joinUrl || "https://t.me/";
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  const onRecheck = () => {
    runGateFlow("recheck");
  };

  // ring math
  const pct = Math.round(progress);
  const R = 34;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - pct / 100);

  return (
    <div className="page">
      <div className="wrap">
        <div className="title">Gate / Проверка доступа</div>

        {status === "loading" && (
          <>
            <div className="ring" aria-label="Loading progress">
              <svg viewBox="0 0 80 80">
                <circle className="bg" cx="40" cy="40" r={R}></circle>
                <circle
                  className="fg"
                  cx="40"
                  cy="40"
                  r={R}
                  style={{
                    strokeDasharray: `${C}`,
                    strokeDashoffset: `${dashOffset}`,
                  }}
                ></circle>
              </svg>

              {/* проценты внутри как на скрине */}
              <span className="ringText">
                <span className="ringNum">{pct}</span>
                <span className="ringPct">%</span>
              </span>
            </div>

            {loadingVariant === "init" ? (
              <div className="msg">
                <span className="msgLine">{msg}</span>
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : (
              <div className="msgBottom">
                <span className="msgLine">Проверяем подписку</span>
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}

            <div className="hint">Это займёт несколько секунд</div>
          </>
        )}

        {status === "need_sub" && (
          <>
            <div className="needTitle">Доступ закрыт</div>
            <div className="needText">
              Чтобы пользоваться приложением, нужно быть подписанным на наш канал.
              <br />
              Подпишись и нажми <b>«Проверить»</b>.
            </div>

            <div className="buttons">
              <button className="btnPrimary" onClick={openSubscribe}>
                Подписаться
              </button>
              <button className="btnGhost" onClick={onRecheck}>
                Проверить
              </button>
            </div>
          </>
        )}

        {(status === "not_tg" || status === "error") && (
          <>
            <div className="msgStatic">{msg}</div>
            <button className="btnPrimary" onClick={() => runGateFlow("init")}>
              Повторить
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        :root {
          --bg: #000000;
          --text: #ffffff;
          --muted: #a9a9a9;
          --e: cubic-bezier(0.2, 0.8, 0.2, 1);
          --dur: 200ms;
        }

        .page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font: 14px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Display",
            "SF Pro Text", Inter, Roboto, "Segoe UI", "Noto Sans",
            "Helvetica Neue", Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          text-align: center;
        }

        .wrap {
          width: 100%;
          max-width: 420px;
        }

        .title {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 18px;
          letter-spacing: 0.2px;
        }

        .ring {
          width: 120px;
          height: 120px;
          margin: 0 auto 14px;
          position: relative;
        }

        .ring svg {
          width: 120px;
          height: 120px;
          transform: rotate(-90deg);
         
