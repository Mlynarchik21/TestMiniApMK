// app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return ok({ updated: result.count });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
