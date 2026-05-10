"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/lib/useTheme";
import { PageShell } from "@/lib/ui/PageShell";
import { Header } from "@/lib/ui/Header";
import { Card } from "@/lib/ui/Card";
import { Button } from "@/lib/ui/Button";
import { ProgressBar } from "@/lib/ui/ProgressBar";
import { EmptyState } from "@/lib/ui/EmptyState";
import { Reveal, RevealStack } from "@/lib/ui/Reveal";
import { Skeleton } from "@/lib/ui/Skeleton";
import { Check, ChevronRight, Play, BookOpen } from "@/lib/ui/icons";

type Lesson = { id: string; title: string; order: number; slideCount: number; completed: boolean };
type Module = { title: string; lessons: Lesson[] };
type CourseData = {
  id: string;
  title: string;
  description: string;
  totalLessons: number;
  completedLessons: number;
  modules: Module[];
};

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

export default function CourseDetailPage() {
  const router = useRouter();
  const { courseId } = useParams() as { courseId: string };
  const { T } = useTheme();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [courseId]);

  if (!loading && !course) {
    return (
      <PageShell withNav={false}>
        <Header title="Курс" back="/course" />
        <EmptyState
          icon={<BookOpen size={28} strokeWidth={1.4} />}
          title="Курс не найден"
          description="Попробуйте вернуться на список курсов."
        />
      </PageShell>
    );
  }

  const pct = course ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const allLessons = course?.modules.flatMap((m) => m.lessons) ?? [];
  const nextLesson = allLessons.find((l) => !l.completed);
  const completed = course && course.completedLessons === course.totalLessons && course.totalLessons > 0;

  return (
    <PageShell withNav={false}>
      <Header title={course?.title ?? "…"} back="/course" />

      <RevealStack childDelay={0.05} style={{ display: "grid", gap: 16, marginTop: 8 }}>
        {loading && (
          <Reveal>
            <Card padding={16}>
              <Skeleton height={20} width="60%" style={{ marginBottom: 14 }} />
              <Skeleton height={8} radius={999} style={{ marginBottom: 14 }} />
              <Skeleton height={44} radius={999} />
            </Card>
          </Reveal>
        )}

        {course && (
          <>
            {/* Progress card */}
            <Reveal>
              <Card padding={16} style={{ borderColor: `${T.brand}40` }}>
                <ProgressBar
                  value={pct}
                  tone={completed ? "success" : "brand"}
                  label="Общий прогресс"
                  rightLabel={`${course.completedLessons} / ${course.totalLessons}`}
                  height={8}
                  style={{ marginBottom: nextLesson ? 14 : 0 }}
                />
                {nextLesson && (
                  <Button
                    variant="primary"
                    size="md"
                    block
                    leadingIcon={<Play size={14} />}
                    onClick={() => router.push(`/course/lesson/${nextLesson.id}`)}
                    tone={completed ? T.green : undefined}
                  >
                    {course.completedLessons === 0 ? "Начать обучение" : "Продолжить"}
                  </Button>
                )}
              </Card>
            </Reveal>

            {/* Modules */}
            {course.modules.map((mod) => (
              <Reveal key={mod.title}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: T.textMuted,
                      marginBottom: 10,
                      paddingLeft: 4,
                    }}
                  >
                    {mod.title}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {mod.lessons.map((lesson) => {
                      const done = lesson.completed;
                      return (
                        <Card
                          key={lesson.id}
                          padding={14}
                          interactive
                          onClick={() => router.push(`/course/lesson/${lesson.id}`)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            borderColor: done ? `${T.green}3a` : T.border,
                            background: done ? `${T.green}0d` : T.card,
                          }}
                        >
                          <div
                            style={{
                              width: 38, height: 38, borderRadius: 12,
                              flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: done ? `${T.green}24` : `${T.brand}1c`,
                              color: done ? T.green : T.brand,
                              fontWeight: 800, fontSize: 13,
                            }}
                          >
                            {done ? <Check size={18} strokeWidth={2.4} /> : lesson.order}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: T.textMain,
                                marginBottom: 2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lesson.title}
                            </div>
                            <div style={{ fontSize: 11, color: T.textFaint }}>
                              {lesson.slideCount} {lesson.slideCount === 1 ? "слайд" : "слайдов"}
                            </div>
                          </div>

                          <ChevronRight size={16} style={{ color: T.textFaint, flexShrink: 0 }} />
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            ))}
          </>
        )}
      </RevealStack>
    </PageShell>
  );
}
