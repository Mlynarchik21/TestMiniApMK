// app/api/account/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);

    // Delete user — cascade handles all related records
    await prisma.user.delete({ where: { id: user.id } });

    return ok({ deleted: true });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
