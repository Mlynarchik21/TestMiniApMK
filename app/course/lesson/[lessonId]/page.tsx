"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { PageShell } from "@/lib/ui/PageShell";
import { Header } from "@/lib/ui/Header";
import { Card } from "@/lib/ui/Card";
import { Button } from "@/lib/ui/Button";
import { ProgressBar } from "@/lib/ui/ProgressBar";
import { EmptyState } from "@/lib/ui/EmptyState";
import { Reveal } from "@/lib/ui/Reveal";
import { CheckCircle2, X as XIcon, Sparkles, ArrowRight, BookOpen } from "@/lib/ui/icons";
import { haptics } from "@/lib/ui/haptics";

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

export default function LessonPage() {
  const router = useRouter();
  const { lessonId } = useParams() as { lessonId: string };
  const { T } = useTheme();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [lessonId]);

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
    if (correct) {
      setScore((s) => s + 1);
      haptics.notify("success");
    } else {
      haptics.notify("error");
    }
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
      haptics.impact("medium");
    } else {
      setQIdx((i) => i + 1);
      setSelected(null);
      setChecked(false);
      haptics.selection();
    }
  };

  const goBack = () => {
    if (lesson) router.replace(`/course/${lesson.courseId}`);
    else router.back();
  };

  if (!loading && !lesson) {
    return (
      <PageShell withNav={false}>
        <Header title="Урок" back="/course" />
        <EmptyState
          icon={<BookOpen size={28} strokeWidth={1.4} />}
          title="Урок не найден"
        />
      </PageShell>
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
  const passed = score >= Math.ceil(questions.length * 0.7);

  return (
    <PageShell withNav={false}>
      <Header title={lesson?.title ?? "…"} subtitle={lesson?.moduleTitle} back={goBack} />

      <Reveal>
        <ProgressBar
          value={progressPct}
          tone={phase === "results" ? "success" : "brand"}
          height={5}
          rightLabel={
            phase === "slides"
              ? `Слайд ${slideIdx + 1} из ${slides.length}`
              : phase === "quiz"
                ? `Вопрос ${qIdx + 1} из ${questions.length}`
                : "Завершено"
          }
          style={{ marginTop: 4, marginBottom: 18 }}
        />
      </Reveal>

      {loading && (
        <div style={{ textAlign: "center", color: T.textMuted, padding: "60px 0" }}>Загрузка…</div>
      )}

      <AnimatePresence mode="wait">
        {!loading && lesson && phase === "slides" && currentSlide && (
          <motion.div
            key={`slide-${slideIdx}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "grid", gap: 14 }}
          >
            <Card padding={20} style={{ borderColor: `${T.brand}40` }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: T.brand,
                  marginBottom: 12,
                }}
              >
                Изучение
              </div>
              <h2 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: T.textMain, lineHeight: 1.3 }}>
                {currentSlide.title}
              </h2>
              <div style={{ fontSize: 15, color: T.textSoft, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {currentSlide.content}
              </div>
            </Card>

            <Button
              variant="primary"
              size="lg"
              block
              trailingIcon={<ArrowRight size={16} />}
              onClick={() => {
                if (slideIdx < slides.length - 1) {
                  setSlideIdx((i) => i + 1);
                  haptics.selection();
                } else {
                  setPhase("quiz");
                  setQIdx(0);
                  setSelected(null);
                  setChecked(false);
                  haptics.impact("medium");
                }
              }}
            >
              {slideIdx < slides.length - 1 ? "Далее" : "Начать тест"}
            </Button>
          </motion.div>
        )}

        {!loading && lesson && phase === "quiz" && currentQ && (
          <motion.div
            key={`quiz-${qIdx}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "grid", gap: 12 }}
          >
            <AnimatePresence>
              {checked && (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                >
                  <Card
                    padding={14}
                    style={{
                      borderColor: isCorrect ? `${T.green}55` : `${T.red}55`,
                      background: isCorrect ? `${T.green}14` : `${T.red}10`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ color: isCorrect ? T.green : T.red, flexShrink: 0 }}>
                        {isCorrect ? <CheckCircle2 size={22} /> : <XIcon size={22} strokeWidth={2.4} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isCorrect ? T.green : T.red, marginBottom: isWrong ? 2 : 0 }}>
                          {isCorrect ? "Верно!" : "Неверно"}
                        </div>
                        {isWrong && (
                          <div style={{ fontSize: 12, color: T.textSoft }}>
                            Правильный ответ: {currentQ.options.find((o) => o.id === currentQ.answer)?.text}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card padding={18}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: T.textMuted,
                  marginBottom: 12,
                }}
              >
                Вопрос {qIdx + 1}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textMain, lineHeight: 1.45 }}>
                {currentQ.text}
              </div>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currentQ.options.map((opt) => {
                const isSelected = selected === opt.id;
                const isAnswerCorrect = opt.id === currentQ.answer;

                let bg = T.card;
                let border = T.border;
                let color = T.textMain;

                if (checked) {
                  if (isAnswerCorrect) {
                    bg = `${T.green}14`;
                    border = `${T.green}55`;
                    color = T.green;
                  } else if (isSelected && !isAnswerCorrect) {
                    bg = `${T.red}10`;
                    border = `${T.red}55`;
                    color = T.red;
                  }
                } else if (isSelected) {
                  bg = `${T.brand}1c`;
                  border = `${T.brand}80`;
                  color = T.blue;
                }

                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    disabled={checked}
                    onClick={() => {
                      setSelected(opt.id);
                      haptics.selection();
                    }}
                    whileTap={!checked ? { scale: 0.985 } : undefined}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: `1px solid ${border}`,
                      background: bg,
                      color,
                      fontSize: 14,
                      fontWeight: isSelected || (checked && isAnswerCorrect) ? 700 : 500,
                      cursor: checked ? "default" : "pointer",
                      WebkitTapHighlightColor: "transparent",
                      textAlign: "left",
                      transition: "background 160ms, border-color 160ms, color 160ms",
                    }}
                  >
                    {opt.text}
                  </motion.button>
                );
              })}
            </div>

            {!checked ? (
              <Button variant="primary" size="lg" block disabled={!selected} onClick={handleCheck}>
                Проверить
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                block
                loading={saving}
                trailingIcon={qIdx < questions.length - 1 ? <ArrowRight size={16} /> : <CheckCircle2 size={16} />}
                onClick={handleNext}
              >
                {qIdx < questions.length - 1 ? "Следующий вопрос" : "Завершить урок"}
              </Button>
            )}
          </motion.div>
        )}

        {!loading && lesson && phase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            style={{ display: "grid", gap: 14 }}
          >
            <Card padding={28} style={{ borderColor: passed ? `${T.green}40` : `${T.red}40`, textAlign: "center" }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  margin: "0 auto 14px",
                  borderRadius: 999,
                  background: passed ? `${T.green}1c` : `${T.red}14`,
                  border: `1px solid ${passed ? `${T.green}55` : `${T.red}55`}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: passed ? T.green : T.red,
                }}
              >
                {passed ? <CheckCircle2 size={40} strokeWidth={1.6} /> : <XIcon size={36} strokeWidth={2} />}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.textMain, marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
                {score} / {questions.length}
              </div>
              <div style={{ fontSize: 14, color: T.textSoft, marginBottom: 6, display: "inline-flex", gap: 6, alignItems: "center" }}>
                {score === questions.length ? (
                  <>
                    <Sparkles size={14} /> Отлично! Все верно
                  </>
                ) : passed ? (
                  "Хороший результат"
                ) : (
                  "Попробуйте ещё раз"
                )}
              </div>
              <div style={{ fontSize: 12, color: T.textFaint }}>
                {Math.round((score / questions.length) * 100)}% правильных ответов
              </div>
            </Card>

            <div style={{ display: "grid", gap: 10 }}>
              {nextLessonId && (
                <Button
                  variant="primary"
                  size="lg"
                  block
                  trailingIcon={<ArrowRight size={16} />}
                  onClick={() => router.replace(`/course/lesson/${nextLessonId}`)}
                >
                  Следующий урок
                </Button>
              )}
              <Button
                variant="secondary"
                size="lg"
                block
                onClick={() => lesson && router.replace(`/course/${lesson.courseId}`)}
              >
                К списку уроков
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
