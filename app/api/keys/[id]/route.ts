import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  const { user } = await requireUser();
  const id = ctx.params.id;

  const found = await prisma.userKey.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!found) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  await prisma.userKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
