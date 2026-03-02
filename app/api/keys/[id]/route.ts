import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const { user } = await requireUser();
    const id = String(ctx?.params?.id || "");

    const row = await prisma.userKey.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    await prisma.userKey.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status });
  }
}
