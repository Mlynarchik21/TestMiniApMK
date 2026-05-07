// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, type: true, title: true, body: true, read: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    return ok({ notifications, unreadCount });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    return ok({ deleted: true });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
