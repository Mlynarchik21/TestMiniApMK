"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";
import { PageShell } from "@/lib/ui/PageShell";
import { Header } from "@/lib/ui/Header";
import { Card } from "@/lib/ui/Card";
import { Button } from "@/lib/ui/Button";
import { ProgressBar } from "@/lib/ui/ProgressBar";
import { EmptyState } from "@/lib/ui/EmptyState";
import { Reveal, RevealStack } from "@/lib/ui/Reveal";
import { Skeleton } from "@/lib/ui/Skeleton";
import { GraduationCap, BookOpen, Play, Check } from "@/lib/ui/icons";

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

export default function CoursePage() {
  const router = useRouter();
  const { T } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return (
    <PageShell>
      <Header title="Обучение" back="/home" />

      <RevealStack childDelay={0.06} style={{ display: "grid", gap: 14, marginTop: 8 }}>
        {loading && (
          <Reveal>
            <Card padding={16}>
              <Skeleton height={120} radius={14} style={{ marginBottom: 12 }} />
              <Skeleton height={20} width="70%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="100%" style={{ marginBottom: 16 }} />
              <Skeleton height={44} radius={999} />
            </Card>
          </Reveal>
        )}

        {!loading && courses.length === 0 && (
          <Reveal>
            <EmptyState
              icon={<BookOpen size={28} strokeWidth={1.4} />}
              title="Курсы пока недоступны"
              description="Скоро здесь появятся обучающие материалы."
            />
          </Reveal>
        )}

        {courses.map((c) => {
          const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
          const completed = c.completedLessons === c.totalLessons && c.totalLessons > 0;
          return (
            <Reveal key={c.id}>
              <Card padding={0} style={{ overflow: "hidden" }}>
                {/* Banner — flat tinted with icon */}
                <div
                  style={{
                    width: "100%",
                    height: 110,
                    background: `${T.brand}1c`,
                    borderBottom: `1px solid ${T.brand}28`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: T.brand,
                  }}
                >
                  <GraduationCap size={56} strokeWidth={1.4} />
                </div>

                <div style={{ padding: 16 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color: T.brand,
                      marginBottom: 6,
                    }}
                  >
                    Курс
                  </div>
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      letterSpacing: "-0.025em",
                      color: T.textMain,
                      marginBottom: 6,
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: T.textMuted,
                      lineHeight: 1.45,
                      marginBottom: 14,
                    }}
                  >
                    {c.description}
                  </div>

                  <ProgressBar
                    value={pct}
                    tone={completed ? "success" : "brand"}
                    label="Прогресс"
                    rightLabel={`${c.completedLessons} / ${c.totalLessons} уроков`}
                    height={8}
                    style={{ marginBottom: 16 }}
                  />

                  <Button
                    variant="primary"
                    size="md"
                    block
                    onClick={() => router.push(`/course/${c.id}`)}
                    leadingIcon={completed ? <Check size={16} /> : <Play size={14} />}
                    tone={completed ? T.green : undefined}
                  >
                    {c.completedLessons === 0 ? "Начать обучение" : completed ? "Пройдено" : "Продолжить"}
                  </Button>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </RevealStack>
    </PageShell>
  );
}
