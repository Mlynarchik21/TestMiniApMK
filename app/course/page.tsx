"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type Course = {
  id: string;
  title: string;
  description: string;
  totalLessons: number;
  completedLessons: number;
};

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" />
    </svg>
  );
}

export default function CoursePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pt, setPt] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

  useEffect(() => {
    const token = getToken();
    fetch("/api/course", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setCourses(j.courses); })
      .catch(() => {})
      .finally(() => setLoading(false));

    const tg = (window as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.(); tg?.expand?.();
      tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000");
      if (tg?.isFullscreen) setPt("calc(env(safe-area-inset-top,0px) + 88px)");
    } catch {}

    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const anim = (i: number): CSSProperties =>
    mounted
      ? { opacity: 1, animationName: "fadeUp", animationDuration: "560ms", animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)", animationFillMode: "both", animationDelay: `${i * 80}ms` }
      : { opacity: 0, transform: "translate3d(0,14px,0)" };

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:#000;overflow-x:hidden}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: "#000", color: "#f3f3f3", fontFamily: 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif', paddingBottom: "calc(env(safe-area-inset-bottom,0px)+40px)", paddingTop: pt }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <section style={{ ...anim(0), display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12, marginBottom: 24, marginTop: 8 }}>
            <button type="button" onClick={() => router.replace("/home")} style={{ width: 44, height: 44, borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", color: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: "#fff" }}>Обучение</div>
            <div />
          </section>

          {loading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "60px 0" }}>Загрузка…</div>}

          {!loading && courses.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "60px 0" }}>Курсы пока не доступны</div>
          )}

          {courses.map((c, i) => {
            const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
            return (
              <section key={c.id} style={{ ...anim(i + 1), borderRadius: 22, border: "1px solid rgba(255,255,255,0.10)", background: "linear-gradient(180deg,rgba(41,121,255,0.10) 0%,rgba(41,121,255,0.04) 100%)", marginBottom: 16, overflow: "hidden" }}>
                {/* Placeholder banner */}
                <div style={{ width: "100%", height: 120, background: "linear-gradient(135deg, rgba(41,121,255,0.4) 0%, rgba(100,217,123,0.2) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 52 }}>📚</span>
                </div>

                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(41,121,255,0.8)", marginBottom: 6 }}>КУРС</div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, marginBottom: 14 }}>{c.description}</div>

                  {/* Progress */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Прогресс</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? "#64d97b" : "#8eb2ff" }}>
                      {c.completedLessons} из {c.totalLessons} уроков
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.10)", marginBottom: 14 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: pct === 100 ? "#64d97b" : "#2979ff", transition: "width 0.4s ease" }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/course/${c.id}`)}
                    style={{ width: "100%", height: 46, borderRadius: 14, border: "none", background: "#2979ff", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(41,121,255,0.25)", WebkitTapHighlightColor: "transparent" }}
                  >
                    {c.completedLessons === 0 ? "Начать обучение" : c.completedLessons === c.totalLessons ? "Пройдено ✓" : "Продолжить"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
