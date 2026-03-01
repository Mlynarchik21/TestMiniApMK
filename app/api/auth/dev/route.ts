// app/api/auth/dev/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST() {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? "30");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // dev-user (фиксированный tgId)
  const user = await prisma.user.upsert({
    where: { tgId: "999999999" },
    update: {},
    create: {
      tgId: "999999999",
      username: "dev",
      firstName: "Dev",
      lastName: "User",
    },
  });

  const token = crypto.randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const res = NextResponse.json({ ok: true });

  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return res;
}
