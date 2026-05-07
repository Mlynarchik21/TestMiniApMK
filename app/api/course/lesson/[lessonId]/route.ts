// app/api/course/lesson/[lessonId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { lessonId: string } }) {
  let userId: string | null = null;
  try {
    const user = await requireUser(req);
    userId = user.id;
  } catch {}

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        questions: { orderBy: { order: "asc" } },
        course: { select: { id: true, title: true } },
      },
    });

    if (!lesson) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // Find prev/next lessons in same course
    const siblings = await prisma.lesson.findMany({
      where: { courseId: lesson.courseId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });

    const idx = siblings.findIndex((l) => l.id === lesson.id);
    const prevLessonId = idx > 0 ? siblings[idx - 1].id : null;
    const nextLessonId = idx < siblings.length - 1 ? siblings[idx + 1].id : null;

    let progress = null;
    if (userId) {
      progress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        select: { passed: true, score: true, total: true, completedAt: true },
      });
    }

    return NextResponse.json({
      ok: true,
      lesson: {
        id: lesson.id,
        courseId: lesson.courseId,
        courseTitle: lesson.course.title,
        title: lesson.title,
        moduleTitle: lesson.moduleTitle,
        order: lesson.order,
        slides: lesson.slides,
        // answers included intentionally (free course)
        questions: lesson.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          answer: q.answer,
          order: q.order,
        })),
        progress,
      },
      prevLessonId,
      nextLessonId,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "SERVER_ERROR", message: e?.message }, { status: 500 });
  }
}
