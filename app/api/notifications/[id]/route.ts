// app/api/notifications/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const id = String(ctx.params?.id || "").trim();
    if (!id) return fail(400, "BAD_REQUEST");

    const body = await req.json().catch(() => null);
    const read = typeof body?.read === "boolean" ? body.read : true;

    const row = await prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!row) return fail(404, "NOT_FOUND");

    await prisma.notification.update({ where: { id }, data: { read } });
    return ok({});
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const id = String(ctx.params?.id || "").trim();
    if (!id) return fail(400, "BAD_REQUEST");

    const result = await prisma.notification.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return fail(404, "NOT_FOUND");
    return ok({});
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
