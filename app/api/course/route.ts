// app/api/course/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let userId: string | null = null;
  try {
    const user = await requireUser(req);
    userId = user.id;
  } catch {}

  try {
    const courses = await prisma.course.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      include: {
        lessons: {
          select: { id: true },
        },
      },
    });

    let progressMap: Record<string, number> = {};
    if (userId) {
      const progress = await prisma.lessonProgress.findMany({
        where: { userId },
        select: { lessonId: true },
      });
      for (const p of progress) {
        progressMap[p.lessonId] = 1;
      }
    }

    const result = courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      order: c.order,
      totalLessons: c.lessons.length,
      completedLessons: c.lessons.filter((l) => progressMap[l.id]).length,
    }));

    return NextResponse.json({ ok: true, courses: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "SERVER_ERROR", message: e?.message }, { status: 500 });
  }
}
