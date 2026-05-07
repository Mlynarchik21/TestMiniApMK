"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useParams } from "next/navigation";

type Lesson = { id: string; title: string; order: number; slideCount: number; completed: boolean };
type Module = { title: string; lessons: Lesson[] };
type CourseData = { id: string; title: string; description: string; totalLessons: number; completedLessons: number; modules: Module[] };

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

function ArrowLeft() {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor" /></svg>;
}

export default function CourseDetailPage() {
  const router = useRouter();
  const { courseId } = useParams() as { courseId: string };
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pt, setPt] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

  useEffect(() => {
    const token = getToken();
    fetch(`/api/course/${courseId}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setCourse(j.course); })
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
  }, [courseId]);

  const anim = (i: number): CSSProperties =>
    mounted
      ? { opacity: 1, animationName: "fadeUp", animationDuration: "480ms", animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)", animationFillMode: "both", animationDelay: `${i * 50}ms` }
      : { opacity: 0, transform: "translate3d(0,10px,0)" };

  if (!loading && !course) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Курс не найден
      </main>
    );
  }

  const pct = course ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;

  // Find first uncompleted lesson
  const allLessons = course?.modules.flatMap((m) => m.lessons) ?? [];
  const nextLesson = allLessons.find((l) => !l.completed);

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:#000;overflow-x:hidden}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: "#000", color: "#f3f3f3", fontFamily: 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif', paddingBottom: "calc(env(safe-area-inset-bottom,0px)+40px)", paddingTop: pt }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <section style={{ ...anim(0), display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12, marginBottom: 20, marginTop: 8 }}>
            <button type="button" onClick={() => router.replace("/course")} style={{ width: 44, height: 44, borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", color: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course?.title ?? "…"}</div>
            <div />
          </section>

          {loading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "60px 0" }}>Загрузка…</div>}

          {course && (
            <>
              {/* Progress card */}
              <section style={{ ...anim(1), borderRadius: 20, border: "1px solid rgba(41,121,255,0.20)", background: "linear-gradient(180deg,rgba(41,121,255,0.10) 0%,transparent 100%)", padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Общий прогресс</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? "#64d97b" : "#8eb2ff" }}>{course.completedLessons}/{course.totalLessons} уроков</span>
                </div>
                <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: pct === 100 ? "#64d97b" : "#2979ff", transition: "width 0.5s ease" }} />
                </div>
                {nextLesson && (
                  <button
                    type="button"
                    onClick={() => router.push(`/course/lesson/${nextLesson.id}`)}
                    style={{ width: "100%", marginTop: 14, height: 44, borderRadius: 12, border: "none", background: "#2979ff", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                  >
                    {course.completedLessons === 0 ? "Начать обучение" : "Продолжить"}
                  </button>
                )}
              </section>

              {/* Modules */}
              {course.modules.map((mod, mi) => (
                <section key={mod.title} style={{ ...anim(mi + 2), marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
                    {mod.title}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {mod.lessons.map((lesson, li) => {
                      const done = lesson.completed;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => router.push(`/course/lesson/${lesson.id}`)}
                          style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: done ? "1px solid rgba(100,217,123,0.25)" : "1px solid rgba(255,255,255,0.10)", background: done ? "rgba(100,217,123,0.06)" : "rgba(255,255,255,0.03)", cursor: "pointer", WebkitTapHighlightColor: "transparent", textAlign: "left", width: "100%" }}
                        >
                          {/* Lesson number / status */}
                          <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "rgba(100,217,123,0.18)" : "rgba(41,121,255,0.14)", color: done ? "#64d97b" : "#8eb2ff", fontWeight: 800, fontSize: 13 }}>
                            {done ? <CheckIcon /> : lesson.order}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.title}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                              {lesson.slideCount} {lesson.slideCount === 1 ? "слайд" : "слайда"}
                            </div>
                          </div>

                          <svg viewBox="0 0 24 24" width="14" height="14" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </main>
    </>
  );
}
