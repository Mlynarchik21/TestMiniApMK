"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * API response types
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

/**
 * Smooth progress helper (no jumps)
 */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function GatePage() {
  const router = useRouter();

  const [status, setStatus] = useState<
    "loading" | "not_tg" | "need_sub" | "ok" | "error"
  >("loading");
  const [msg, setMsg] = useState<string>("Запуск…");
  const [joinUrl, setJoinUrl] = useState<string>("");

  // loading UI states
  const [progress, setProgress] = useState<number>(6); // %
  const targetRef = useRef<number>(6);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  const initData = useMemo(() => {
    const tg = getTg();
    return tg?.initData ? String(tg.initData) : "";
  }, []);

  const phases = useMemo(
    () => [
      { at: 10, text: "Инициализация Mini App…" },
      { at: 25, text: "Проверяем контекст Telegram…" },
      { at: 45, text: "Проверяем подписку на канал…" },
      { at: 65, text: "Загружаем ваши данные…" },
      { at: 82, text: "Почти готово. Финальная проверка…" },
    ],
    []
  );

  const stopProgressAnim = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startProgressAnim = useCallback(() => {
    stopProgressAnim();
    const tick = () => {
      setProgress((cur) => {
        const target = targetRef.current;
        // smooth approach to target
        const delta = target - cur;
        const step = delta * 0.08; // smoothing factor
        const next = Math.abs(delta) < 0.15 ? target : cur + step;
        return clamp(next, 0, 100);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopProgressAnim]);

  const setPhaseByProgress = useCallback(
    (p: number) => {
      // find highest phase where at <= p
      let idx = 0;
      for (let i = 0; i < phases.length; i++) {
        if (p >= phases[i].at) idx = i;
      }
      if (phaseRef.current !== idx) {
        phaseRef.current = idx;
        setMsg(phases[idx].text);
      }
    },
    [phases]
  );

  const bumpTarget = useCallback(
    (to: number) => {
      targetRef.current = clamp(to, 0, 99);
      setPhaseByProgress(targetRef.current);
    },
    [setPhaseByProgress]
  );

  const resetLoading = useCallback(() => {
    setStatus("loading");
    setJoinUrl("");
    setMsg(phases[0].text);
    setProgress(6);
    targetRef.current = 6;
    phaseRef.current = 0;
    startProgressAnim();
  }, [phases, startProgressAnim]);

  const check = useCallback(async () => {
    resetLoading();

    const tg = getTg();
    if (!tg) {
      stopProgressAnim();
      setStatus("not_tg");
      setMsg("Не внутри Telegram. Открой Mini App внутри Telegram (WebApp).");
      return;
    }

    // Wake up webapp
    try {
      tg.ready?.();
      tg.expand?.();
    } catch {}

    bumpTarget(25);

    // Wait for initData a bit (common in real TG webview)
    const waitInitData = async () => {
      const started = Date.now();
      while (!tg.initData && Date.now() - started < 1500) {
        await new Promise((r) => setTimeout(r, 80));
      }
    };

    await waitInitData();

    if (!tg.initData) {
      stopProgressAnim();
      setStatus("error");
      setMsg(
        "initData пустой. Проверь /setdomain в BotFather и запускай через кнопку WebApp."
      );
      return;
    }

    bumpTarget(45);

    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: String(tg.initData || "") }),
      });

      bumpTarget(70);

      const json = (await res.json()) as GateResp;

      // defensive: unexpected response
      if (!json || typeof json !== "object" || typeof (json as any).ok !== "boolean") {
        stopProgressAnim();
        setStatus("error");
        setMsg("Некорректный ответ сервера. Проверь /api/gate.");
        return;
      }

      if (isGateFail(json)) {
        stopProgressAnim();
        setStatus("error");
        setMsg(json.error ?? "Ошибка проверки.");
        return;
      }

      if (json.subscribed === true) {
        bumpTarget(99);
        setStatus("ok");
        setMsg("Доступ подтверждён. Переходим…");
        // tiny delay for UX (let progress reach ~99 smoothly)
        setTimeout(() => {
          stopProgressAnim();
          router.replace("/home");
        }, 450);
        return;
      }

      // need subscription
      stopProgressAnim();
      setStatus("need_sub");
      setMsg("Подписка не найдена. Подпишись и нажми «Проверить».");
      setJoinUrl(json.joinUrl ?? "");
    } catch (e: any) {
      stopProgressAnim();
      setStatus("error");
      setMsg(String(e?.message || e));
    }
  }, [bumpTarget, resetLoading, router, stopProgressAnim]);

  useEffect(() => {
    // start once
    const tg = getTg();
    if (!tg) {
      setStatus("not_tg");
      setMsg("Не внутри Telegram. Открой Mini App внутри Telegram (WebApp).");
      return;
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep phase text synced while progress animates
  useEffect(() => {
    if (status !== "loading") return;
    setPhaseByProgress(progress);
  }, [progress, setPhaseByProgress, status]);

  const openSubscribe = () => {
    const tg = getTg();
    const url = joinUrl || "https://t.me/";
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
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
              <span className="ringText">{pct}%</span>
            </div>

            <div className="msg">
              <span className="msgLine">{msg}</span>
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="hint">Это займёт несколько секунд</div>
          </>
        )}

        {status === "need_sub" && (
          <>
            <div className="msgStatic">{msg}</div>

            <div className="buttons">
              <button className="btnPrimary" onClick={openSubscribe}>
                Подписаться
              </button>
              <button className="btnGhost" onClick={check}>
                Проверить
              </button>
            </div>
          </>
        )}

        {(status === "not_tg" || status === "error") && (
          <>
            <div className="msgStatic">{msg}</div>
            <button className="btnPrimary" onClick={check}>
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
          --panel: #000000;
          --panel-soft: #050505;
          --border-soft: rgba(255, 255, 255, 0.16);
          --r: 18px;
          --e: cubic-bezier(0.2, 0.8, 0.2, 1);
          --dur: 200ms;
          --sp-16: 16px;
          --green: #00c853;
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
          width: 110px;
          height: 110px;
          margin: 0 auto 16px;
          position: relative;
        }

        .ring svg {
          width: 110px;
          height: 110px;
          transform: rotate(-90deg);
          overflow: visible;
        }

        .ring circle {
          fill: none;
          stroke-width: 7;
          stroke-linecap: round;
        }

        .ring .bg {
          stroke: rgba(255, 255, 255, 0.12);
        }

        .ring .fg {
          stroke: #78d06a;
          transition: stroke-dashoffset 420ms var(--e);
          filter: drop-shadow(0 0 8px rgba(120, 208, 106, 0.25));
        }

        .ringText {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .msg {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 24px;
          margin: 0 auto 6px;
          color: #eaeaea;
          opacity: 0.95;
        }

        .msgLine {
          display: inline-block;
          transform-origin: 50% 50%;
          animation: msgIn 460ms var(--e) both;
        }

        /* subtle “lift-in” animation when message changes */
        @keyframes msgIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dots {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          height: 10px;
        }

        .dots i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.7);
          display: inline-block;
          animation: dot 900ms var(--e) infinite;
        }
        .dots i:nth-child(2) {
          animation-delay: 120ms;
          opacity: 0.7;
        }
        .dots i:nth-child(3) {
          animation-delay: 240ms;
          opacity: 0.55;
        }

        @keyframes dot {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .hint {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 14px;
        }

        .msgStatic {
          opacity: 0.92;
          line-height: 1.5;
          margin-bottom: 16px;
          color: #eaeaea;
        }

        .buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btnPrimary {
          width: 100%;
          padding: 14px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: #fff;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 120ms var(--e), background var(--dur) var(--e),
            border-color var(--dur) var(--e);
        }

        .btnPrimary:active {
          transform: translateY(1px) scale(0.985);
          background: #f2f2f2;
          border-color: #fff;
        }

        .btnGhost {
          width: 100%;
          padding: 14px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: transparent;
          color: #fff;
          font-size: 16px;
          fontWeight: 700;
          cursor: pointer;
          transition: transform 120ms var(--e), background var(--dur) var(--e),
            border-color var(--dur) var(--e);
        }

        .btnGhost:active {
          transform: translateY(1px) scale(0.985);
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.6);
        }

        @media (min-width: 720px) {
          .wrap {
            max-width: 480px;
          }
        }
      `}</style>
    </div>
  );
}
