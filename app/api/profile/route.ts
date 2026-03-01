// app/api/profile/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }

  const tokenHash = sha256hex(token);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      userId: session.user.id,
      tgId: session.user.tgId,
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      // временно нет отдельной таблицы profile
      settings: {},
    },
  });
}
