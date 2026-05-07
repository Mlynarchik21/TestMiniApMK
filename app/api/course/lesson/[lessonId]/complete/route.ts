// app/api/course/lesson/[lessonId]/complete/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { lessonId: string } }) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const score: number = typeof body.score === "number" ? body.score : 0;
    const total: number = typeof body.total === "number" ? body.total : 0;

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.lessonId },
      select: { id: true },
    });

    if (!lesson) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: params.lessonId } },
      create: { userId: user.id, lessonId: params.lessonId, passed: true, score, total, completedAt: new Date() },
      update: { passed: true, score, total, completedAt: new Date() },
    });

    return NextResponse.json({ ok: true, progress });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json({ ok: false, error: s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message }, { status: s });
  }
}
