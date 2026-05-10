"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { Button } from "@/lib/ui/Button";
import { ShieldAlert, ShieldCheck, Sparkles, AlertTriangle, RotateCw } from "@/lib/ui/icons";

type GateOkSubscribed = { ok: true; subscribed: true; sessionToken?: string };
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
  const { T } = useTheme();

  const [status, setStatus] = useState<"loading" | "not_tg" | "need_sub" | "ok" | "error">("loading");
  const [loadingVariant, setLoadingVariant] = useState<"init" | "recheck">("init");
  const [msg, setMsg] = useState<string>("Инициализация…");
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);

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

  const setPhaseText = useCallback((p: number) => {
    if (loadingVariant !== "init") return;
    let idx = 0;
    for (let i = 0; i < phasesInit.length; i++) if (p >= phasesInit[i].at) idx = i;
    setMsg(phasesInit[idx].text);
  }, [loadingVariant, phasesInit]);

  const stopAnim = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animResolveRef.current?.();
    animResolveRef.current = null;
  }, []);

  const animateProgress = useCallback((from: number, to: number, durationMs: number) => {
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
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else {
          rafRef.current = null;
          animResolveRef.current?.();
          animResolveRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    });
  }, [setPhaseText, stopAnim]);

  const waitForInitData = useCallback(async (tg: any, maxMs = 1500) => {
    const started = Date.now();
    while (!tg.initData && Date.now() - started < maxMs) await sleep(80);
  }, []);

  const runGateFlow = useCallback(async (variant: "init" | "recheck") => {
    setLoadingVariant(variant);
    setStatus("loading");
    setJoinUrl("");
    setMsg(variant === "init" ? phasesInit[0].text : "Проверяем подписку…");

    const minDurationMs = 4200;
    const startTs = Date.now();
    const tg = getTg();
    if (!tg) {
      await animateProgress(0, 100, 900);
      setStatus("not_tg");
      setMsg("Не внутри Telegram. Откройте Mini App из бота через WebApp-кнопку.");
      return;
    }

    try { tg.ready?.(); tg.expand?.(); } catch {}

    const progPromise = animateProgress(0, 92, minDurationMs);
    await waitForInitData(tg, 1500);

    if (!tg.initData) {
      await progPromise;
      await animateProgress(92, 100, 650);
      setStatus("error");
      setMsg("initData пустой. Проверьте /setdomain в BotFather и запускайте Mini App через кнопку WebApp.");
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
      setMsg("Некорректный ответ сервера. Проверьте /api/gate.");
      return;
    }

    if (isGateFail(json)) {
      setStatus("error");
      setMsg(json.error ?? "Ошибка проверки.");
      return;
    }

    if (json.subscribed === true) {
      const st = (json as GateOkSubscribed).sessionToken;
      if (typeof st === "string" && st.length > 0) {
        try { localStorage.setItem("sessionToken", st); } catch {}
      }
      setStatus("ok");
      setMsg("Доступ подтверждён. Переходим…");
      await sleep(180);
      router.replace("/home");
      return;
    }

    setStatus("need_sub");
    setMsg("Подписка не найдена.");
    setJoinUrl((json as GateOkNeedSub).joinUrl ?? "");
  }, [animateProgress, phasesInit, router, waitForInitData]);

  useEffect(() => {
    runGateFlow("init");
    return () => stopAnim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSubscribe = () => {
    const tg = getTg();
    const url = joinUrl || "https://t.me/";
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  const pct = Math.round(progress);
  const R = 38;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - pct / 100);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: T.bg,
        color: T.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        textAlign: "center",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <AnimatePresence mode="wait">
          {status === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div style={{ width: 132, height: 132, margin: "0 auto 18px", position: "relative" }}>
                <svg viewBox="0 0 96 96" width="132" height="132" style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
                  <circle cx="48" cy="48" r={R} fill="none" stroke={T.borderSoft} strokeWidth={6} />
                  <circle
                    cx="48"
                    cy="48"
                    r={R}
                    fill="none"
                    stroke={T.green}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={dashOffset}
                    style={{
                      transition: "stroke-dashoffset 120ms cubic-bezier(0.22,1,0.36,1)",
                      filter: `drop-shadow(0 0 10px ${T.green}55)`,
                    }}
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: T.textMain,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{pct}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginTop: -10, marginLeft: 1 }}>%</span>
                </div>
              </div>

              <motion.div
                key={msg}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  color: T.textSoft,
                  minHeight: 22,
                }}
              >
                <span>{loadingVariant === "init" ? msg : "Проверяем подписку"}</span>
                <Dots />
              </motion.div>
            </motion.div>
          )}

          {status === "need_sub" && (
            <motion.div
              key="need_sub"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  margin: "0 auto 18px",
                  borderRadius: 24,
                  background: `${T.yellow}1a`,
                  border: `1px solid ${T.yellow}55`,
                  color: T.yellow,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldAlert size={32} strokeWidth={1.6} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", color: T.textMain, marginBottom: 8 }}>
                Доступ закрыт
              </div>
              <div style={{ fontSize: 14, color: T.textSoft, lineHeight: 1.55, marginBottom: 24 }}>
                Чтобы пользоваться приложением, нужно быть подписанным на наш канал.<br />
                Подпишитесь и нажмите <b>«Проверить»</b>.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <Button variant="primary" size="lg" block onClick={openSubscribe}>
                  Подписаться
                </Button>
                <Button variant="secondary" size="lg" block onClick={() => runGateFlow("recheck")}>
                  Проверить
                </Button>
              </div>
            </motion.div>
          )}

          {(status === "not_tg" || status === "error") && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  margin: "0 auto 18px",
                  borderRadius: 24,
                  background: `${T.red}1a`,
                  border: `1px solid ${T.red}55`,
                  color: T.red,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={30} strokeWidth={1.6} />
              </div>
              <div style={{ fontSize: 14, color: T.textSoft, lineHeight: 1.5, marginBottom: 22 }}>{msg}</div>
              <Button
                variant="primary"
                size="lg"
                block
                leadingIcon={<RotateCw size={16} />}
                onClick={() => runGateFlow("init")}
              >
                Повторить
              </Button>
            </motion.div>
          )}

          {status === "ok" && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  margin: "0 auto 14px",
                  borderRadius: 999,
                  background: `${T.green}1c`,
                  border: `1px solid ${T.green}55`,
                  color: T.green,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={36} strokeWidth={1.6} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.textMain, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={16} />
                {msg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Dots() {
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.95, repeat: Infinity, delay: i * 0.14, ease: "easeInOut" }}
          style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor", display: "inline-block" }}
        />
      ))}
    </span>
  );
}
