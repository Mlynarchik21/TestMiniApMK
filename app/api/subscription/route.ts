// app/api/subscription/route.ts
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

    const sub = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: { userId: user.id, plan: "free", status: "active" },
      update: {},
      select: { id: true, plan: true, status: true, expiresAt: true, vipExpiresAt: true, createdAt: true, updatedAt: true },
    });

    return ok({ subscription: sub });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
