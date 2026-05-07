// app/api/course/[courseId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { courseId: string } }) {
  let userId: string | null = null;
  try {
    const user = await requireUser(req);
    userId = user.id;
  } catch {}

  try {
    const course = await prisma.course.findUnique({
      where: { id: params.courseId, published: true },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, moduleTitle: true, order: true, slides: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    let completedSet = new Set<string>();
    if (userId) {
      const progress = await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: course.lessons.map((l) => l.id) } },
        select: { lessonId: true },
      });
      progress.forEach((p) => completedSet.add(p.lessonId));
    }

    // Group by moduleTitle
    const modulesMap = new Map<string, typeof course.lessons>();
    for (const lesson of course.lessons) {
      const key = lesson.moduleTitle ?? "Уроки";
      if (!modulesMap.has(key)) modulesMap.set(key, []);
      modulesMap.get(key)!.push(lesson);
    }

    const modules = Array.from(modulesMap.entries()).map(([title, lessons]) => ({
      title,
      lessons: lessons.map((l, i) => {
        const slideCount = Array.isArray(l.slides) ? (l.slides as any[]).length : 0;
        return {
          id: l.id,
          title: l.title,
          order: l.order,
          slideCount,
          completed: completedSet.has(l.id),
        };
      }),
    }));

    return NextResponse.json({
      ok: true,
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        totalLessons: course.lessons.length,
        completedLessons: completedSet.size,
        modules,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "SERVER_ERROR", message: e?.message }, { status: 500 });
  }
}
