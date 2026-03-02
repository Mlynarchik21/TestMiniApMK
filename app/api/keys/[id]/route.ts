// app/api/keys/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  const user = await requireUser(); // ✅ requireUser возвращает User, не { user: User }

  const id = ctx.params.id;

  // удаляем только свой ключ
  const found = await prisma.userKey.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!found) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await prisma.userKey.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
