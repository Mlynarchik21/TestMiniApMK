import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../lib/db";
import { cookies } from "next/headers";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

  const tokenHash = sha256hex(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
  if (session.expiresAt < new Date()) {
    // можно удалить протухшую
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "session expired" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: session.user.id,
      tgId: session.user.tgId.toString(), // BigInt в JSON нельзя
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      createdAt: session.user.createdAt,
    },
  });
}
