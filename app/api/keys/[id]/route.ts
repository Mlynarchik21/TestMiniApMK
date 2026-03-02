// app/api/keys/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  const user = await requireUser();

  const id = String(ctx.params?.id || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  // удаляем только свой ключ (одним запросом)
  const result = await prisma.userKey.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
