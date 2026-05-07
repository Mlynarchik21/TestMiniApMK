"use client";

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter, useParams } from "next/navigation";

type Slide = { title: string; content: string };
type Option = { id: string; text: string };
type Question = { id: string; text: string; options: Option[]; answer: string; order: number };
type LessonData = {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  moduleTitle: string;
  order: number;
  slides: Slide[];
  questions: Question[];
  progress: { passed: boolean; score: number; total: number } | null;
};

type Phase = "slides" | "quiz" | "results";

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

function ArrowLeft() {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" /></svg>;
}

function CheckCircle() {
  return <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden><circle cx="12" cy="12" r="10" fill="rgba(100,217,123,0.18)" /><path d="M9 12.5l2.5 2.5 4.5-5" stroke="#64d97b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
}

function XCircle() {
  return <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden><circle cx="12" cy="12" r="10" fill="rgba(255,80,80,0.15)" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#ff5050" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>;
}

export default function LessonPage() {
  const router = useRouter();
  const { lessonId } = useParams() as { lessonId: string };
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pt, setPt] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

  // Phase machine
  const [phase, setPhase] = useState<Phase>("slides");
  const [slideIdx, setSlideIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`/api/course/lesson/${lessonId}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setLesson(j.lesson);
          setNextLessonId(j.nextLessonId ?? null);
        }
      })
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
  }, [lessonId]);

  const anim = (i: number): CSSProperties =>
    mounted
      ? { opacity: 1, animationName: "fadeUp", animationDuration: "480ms", animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)", animationFillMode: "both", animationDelay: `${i * 50}ms` }
      : { opacity: 0, transform: "translate3d(0,10px,0)" };

  const completeLesson = useCallback(async (finalScore: number) => {
    if (!lesson) return;
    setSaving(true);
    const token = getToken();
    try {
      await fetch(`/api/course/lesson/${lessonId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ score: finalScore, total: lesson.questions.length }),
      });
    } catch {}
    setSaving(false);
  }, [lesson, lessonId]);

  const handleCheck = () => {
    if (!selected || !lesson) return;
    const correct = lesson.questions[qIdx].answer === selected;
    if (correct) setScore((s) => s + 1);
    setChecked(true);
  };

  const handleNext = async () => {
    if (!lesson) return;
    const isLast = qIdx === lesson.questions.length - 1;
    if (isLast) {
      const finalScore = lesson.questions[qIdx].answer === selected ? score + 1 : score;
      await completeLesson(finalScore);
      setScore(finalScore);
      setPhase("results");
    } else {
      setQIdx((i) => i + 1);
      setSelected(null);
      setChecked(false);
    }
  };

  const goBack = () => {
    if (lesson) router.replace(`/course/${lesson.courseId}`);
    else router.back();
  };

  if (!loading && !lesson) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Урок не найден
      </main>
    );
  }

  const slides = lesson?.slides ?? [];
  const questions = lesson?.questions ?? [];
  const currentSlide = slides[slideIdx];
  const currentQ = questions[qIdx];
  const totalSteps = slides.length + questions.length;
  const progressStep = phase === "slides" ? slideIdx + 1 : phase === "quiz" ? slides.length + qIdx + 1 : totalSteps;
  const progressPct = totalSteps > 0 ? Math.round((progressStep / totalSteps) * 100) : 0;

  const isCorrect = checked && currentQ && selected === currentQ.answer;
  const isWrong = checked && currentQ && selected !== currentQ.answer;

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:#000;overflow-x:hidden}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
        @keyframes slideIn{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: "#000", color: "#f3f3f3", fontFamily: 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif', paddingBottom: "calc(env(safe-area-inset-bottom,0px)+40px)", paddingTop: pt, display: "flex", flexDirection: "column" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <section style={{ ...anim(0), display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 8 }}>
            <button type="button" onClick={goBack} style={{ width: 44, height: 44, borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", color: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson?.title ?? "…"}</div>
              {lesson?.moduleTitle && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{lesson.moduleTitle}</div>
              )}
            </div>
            <div />
          </section>

          {/* Progress bar */}
          {!loading && lesson && (
            <div style={{ ...anim(1), marginBottom: 24 }}>
              <div style={{ width: "100%", height: 5, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 999, background: phase === "results" ? "#64d97b" : "#2979ff", transition: "width 0.4s ease" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "right" }}>
                {phase === "slides" ? `Слайд ${slideIdx + 1} из ${slides.length}` : phase === "quiz" ? `Вопрос ${qIdx + 1} из ${questions.length}` : "Завершено"}
              </div>
            </div>
          )}

          {loading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "60px 0" }}>Загрузка…</div>}

          {/* ── SLIDES PHASE ── */}
          {!loading && lesson && phase === "slides" && currentSlide && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 360ms cubic-bezier(0.22,1,0.36,1) both" }}>
              <div style={{ flex: 1, borderRadius: 22, border: "1px solid rgba(41,121,255,0.20)", background: "linear-gradient(160deg,rgba(41,121,255,0.10) 0%,rgba(0,0,0,0) 60%)", padding: "24px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(41,121,255,0.8)", marginBottom: 14 }}>
                  {phase === "slides" ? "Изучение" : ""}
                </div>
                <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.3 }}>
                  {currentSlide.title}
                </h2>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {currentSlide.content}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (slideIdx < slides.length - 1) {
                    setSlideIdx((i) => i + 1);
                  } else {
                    setPhase("quiz");
                    setQIdx(0);
                    setSelected(null);
                    setChecked(false);
                  }
                }}
                style={{ width: "100%", height: 52, borderRadius: 16, border: "none", background: "#2979ff", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}
              >
                {slideIdx < slides.length - 1 ? "Далее →" : "Начать тест"}
              </button>
            </div>
          )}

          {/* ── QUIZ PHASE ── */}
          {!loading && lesson && phase === "quiz" && currentQ && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 360ms cubic-bezier(0.22,1,0.36,1) both" }}>
              {/* Feedback overlay */}
              {checked && (
                <div style={{ borderRadius: 16, padding: "14px 16px", marginBottom: 14, background: isCorrect ? "rgba(100,217,123,0.12)" : "rgba(255,80,80,0.10)", border: `1px solid ${isCorrect ? "rgba(100,217,123,0.35)" : "rgba(255,80,80,0.30)"}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{isCorrect ? "✅" : "❌"}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isCorrect ? "#64d97b" : "#ff6060", marginBottom: 2 }}>{isCorrect ? "Верно!" : "Неверно"}</div>
                    {isWrong && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                        Правильный ответ: {currentQ.options.find((o) => o.id === currentQ.answer)?.text}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", padding: "20px 18px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Вопрос {qIdx + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.45 }}>{currentQ.text}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, marginBottom: 16 }}>
                {currentQ.options.map((opt) => {
                  const isSelected = selected === opt.id;
                  const isAnswerCorrect = opt.id === currentQ.answer;
                  let bg = "rgba(255,255,255,0.04)";
                  let border = "1px solid rgba(255,255,255,0.12)";
                  let color = "#f3f3f3";

                  if (checked) {
                    if (isAnswerCorrect) { bg = "rgba(100,217,123,0.12)"; border = "1px solid rgba(100,217,123,0.40)"; color = "#64d97b"; }
                    else if (isSelected && !isAnswerCorrect) { bg = "rgba(255,80,80,0.10)"; border = "1px solid rgba(255,80,80,0.35)"; color = "#ff6060"; }
                  } else if (isSelected) {
                    bg = "rgba(41,121,255,0.16)"; border = "1px solid rgba(41,121,255,0.55)"; color = "#8eb2ff";
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={checked}
                      onClick={() => setSelected(opt.id)}
                      style={{ padding: "14px 16px", borderRadius: 14, border, background: bg, color, fontSize: 14, fontWeight: isSelected || (checked && isAnswerCorrect) ? 700 : 500, cursor: checked ? "default" : "pointer", WebkitTapHighlightColor: "transparent", textAlign: "left", transition: "all 0.15s ease" }}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              {!checked ? (
                <button
                  type="button"
                  disabled={!selected}
                  onClick={handleCheck}
                  style={{ width: "100%", height: 52, borderRadius: 16, border: "none", background: selected ? "#2979ff" : "rgba(255,255,255,0.08)", color: selected ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 15, fontWeight: 800, cursor: selected ? "pointer" : "default", WebkitTapHighlightColor: "transparent", flexShrink: 0, transition: "all 0.2s ease" }}
                >
                  Проверить
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  style={{ width: "100%", height: 52, borderRadius: 16, border: "none", background: "#2979ff", color: "#fff", fontSize: 15, fontWeight: 800, cursor: saving ? "default" : "pointer", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}
                >
                  {saving ? "Сохранение…" : qIdx < questions.length - 1 ? "Следующий вопрос →" : "Завершить урок"}
                </button>
              )}
            </div>
          )}

          {/* ── RESULTS PHASE ── */}
          {!loading && lesson && phase === "results" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "slideIn 480ms cubic-bezier(0.22,1,0.36,1) both" }}>
              <div style={{ width: "100%", borderRadius: 24, border: "1px solid rgba(100,217,123,0.25)", background: "linear-gradient(180deg,rgba(100,217,123,0.10) 0%,rgba(0,0,0,0) 100%)", padding: "36px 24px", textAlign: "center", marginBottom: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  {score >= Math.ceil(questions.length * 0.7) ? <CheckCircle /> : <XCircle />}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                  {score} из {questions.length}
                </div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
                  {score === questions.length ? "Отлично! Все верно 🎉" : score >= Math.ceil(questions.length * 0.7) ? "Хороший результат!" : "Попробуй ещё раз"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  {Math.round((score / questions.length) * 100)}% правильных ответов
                </div>
              </div>

              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                {nextLessonId && (
                  <button
                    type="button"
                    onClick={() => router.replace(`/course/lesson/${nextLessonId}`)}
                    style={{ width: "100%", height: 52, borderRadius: 16, border: "none", background: "#2979ff", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                  >
                    Следующий урок →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => lesson && router.replace(`/course/${lesson.courseId}`)}
                  style={{ width: "100%", height: 52, borderRadius: 16, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#f3f3f3", fontSize: 15, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                >
                  К списку уроков
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
